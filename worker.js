/**
 * Q08 Prediction Markets Trading System
 * Main Cloudflare Worker Entry Point
 * 
 * Extends Q08 signal engine for automated prediction market trading
 */

import { handleSignalAggregation } from './signal-aggregator/index.mjs';
import { detectArbitrage } from './strategy-engine/arbitrage.mjs';
import { handleWhaleTracking } from './signal-aggregator/whale-tracker.mjs';
import { analyzeCohorts } from './packages/workers/src/analytics/cohort-analyzer.mjs';
// import { handlePerformanceReport } from './reporting/performance.mjs'; // TODO: Implement

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (path.startsWith('/api/')) {
        return await handleAPI(path, request, env, corsHeaders);
      }

      // Health check
      if (path === '/health') {
        return jsonResponse({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development'
        }, corsHeaders);
      }

      // Dashboard (serve from static or redirect to frontend)
      if (path === '/' || path === '/dashboard') {
        return new Response(getDashboardHTML(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }

      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ 
        error: 'Internal server error',
        message: error.message 
      }, corsHeaders, 500);
    }
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;
    console.log('Cron triggered:', cron);

    try {
      // Every minute: Arbitrage detection
      if (cron === '*/1 * * * *') {
        ctx.waitUntil(detectArbitrage(env));
      }

      // Every 5 minutes: Signal aggregation
      if (cron === '*/5 * * * *') {
        ctx.waitUntil(handleSignalAggregation(env));
      }

      // Every 6 hours: Whale wallet refresh
      if (cron === '0 */6 * * *') {
        ctx.waitUntil(handleWhaleTracking(env));
      }

      // Daily: Performance report
      if (cron === '0 0 * * *') {
        // TODO: Implement performance report
        console.log('[Cron] Performance report - not yet implemented');
      }

    } catch (error) {
      console.error('Cron error:', error);
    }
  }
};

/**
 * Handle API requests
 */
async function handleAPI(path, request, env, corsHeaders) {
  const method = request.method;

  // Signals endpoint
  if (path === '/api/signals' || path === '/api/signals/latest') {
    if (method === 'GET') {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const source = url.searchParams.get('source');
      
      let query = `
        SELECT * FROM market_signals 
        WHERE 1=1
        ${source ? `AND source = ?` : ''}
        ORDER BY detected_at DESC 
        LIMIT ?
      `;
      
      const params = source ? [source, limit] : [limit];
      const result = await env.SIGNALS_DB.prepare(query).bind(...params).all();
      
      return jsonResponse({
        signals: result.results.map(s => ({
          ...s,
          metadata: s.metadata ? JSON.parse(s.metadata) : null,
          price_data: s.price_data ? JSON.parse(s.price_data) : null
        })),
        total: result.results.length
      }, corsHeaders);
    }
  }

  // Trades endpoint
  if (path === '/api/trades' || path === '/api/trades/active') {
    if (method === 'GET') {
      const status = path.includes('active') ? 'open' : null;
      
      let query = `
        SELECT t.*, s.name as strategy_name
        FROM trades t
        LEFT JOIN strategies s ON t.strategy_id = s.id
        ${status ? `WHERE t.status = ?` : ''}
        ORDER BY t.opened_at DESC
        LIMIT 100
      `;
      
      const params = status ? [status] : [];
      const result = await env.TRADES_DB.prepare(query).bind(...params).all();
      
      return jsonResponse({
        trades: result.results.map(t => ({
          ...t,
          signal_ids: t.signal_ids ? JSON.parse(t.signal_ids) : [],
          signal_metadata: t.signal_metadata ? JSON.parse(t.signal_metadata) : null
        })),
        total: result.results.length
      }, corsHeaders);
    }
  }

  // Strategies endpoint
  if (path === '/api/strategies') {
    if (method === 'GET') {
      const result = await env.TRADES_DB.prepare(`
        SELECT * FROM strategies 
        ORDER BY total_pnl DESC
      `).all();
      
      return jsonResponse({
        strategies: result.results.map(s => ({
          ...s,
          config: s.config ? JSON.parse(s.config) : {}
        }))
      }, corsHeaders);
    }
  }

  // Performance endpoint
  if (path === '/api/performance') {
    if (method === 'GET') {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');
      
      const result = await env.TRADES_DB.prepare(`
        SELECT * FROM performance_metrics 
        ORDER BY date DESC 
        LIMIT ?
      `).bind(days).all();
      
      // Calculate aggregate stats
      const totalPnl = result.results.reduce((sum, m) => sum + (m.total_pnl || 0), 0);
      const avgWinRate = result.results.reduce((sum, m) => sum + (m.win_rate || 0), 0) / result.results.length;
      
      return jsonResponse({
        daily: result.results.map(m => ({
          ...m,
          metadata: m.metadata ? JSON.parse(m.metadata) : null
        })),
        aggregate: {
          total_pnl: totalPnl,
          avg_win_rate: avgWinRate,
          days: result.results.length
        }
      }, corsHeaders);
    }
  }

  // Whales endpoint
  if (path === '/api/whales') {
    if (method === 'GET') {
      const result = await env.SIGNALS_DB.prepare(`
        SELECT * FROM whale_wallets 
        WHERE active = 1
        ORDER BY performance_score DESC 
        LIMIT 50
      `).all();
      
      return jsonResponse({
        whales: result.results.map(w => ({
          ...w,
          metadata: w.metadata ? JSON.parse(w.metadata) : null
        }))
      }, corsHeaders);
    }
  }

  // Arbitrage opportunities endpoint
  if (path === '/api/arbitrage') {
    if (method === 'GET') {
      const result = await env.SIGNALS_DB.prepare(`
        SELECT * FROM arbitrage_opportunities 
        WHERE executed = 0 
        AND datetime(expires_at) > datetime('now')
        ORDER BY spread_pct DESC 
        LIMIT 20
      `).all();
      
      return jsonResponse({
        opportunities: result.results
      }, corsHeaders);
    }
  }

  // Dashboard stats endpoint
  if (path === '/api/stats') {
    if (method === 'GET') {
      // Get latest metrics
      const [openTrades, totalTrades, todayMetrics, strategies] = await Promise.all([
        env.TRADES_DB.prepare(`SELECT COUNT(*) as count FROM trades WHERE status = 'open'`).first(),
        env.TRADES_DB.prepare(`SELECT COUNT(*) as count, SUM(pnl) as total_pnl FROM trades WHERE status = 'closed'`).first(),
        env.TRADES_DB.prepare(`SELECT * FROM performance_metrics WHERE date = date('now') LIMIT 1`).first(),
        env.TRADES_DB.prepare(`SELECT COUNT(*) as count FROM strategies WHERE enabled = 1`).first()
      ]);

      return jsonResponse({
        open_positions: openTrades.count || 0,
        total_trades: totalTrades.count || 0,
        total_pnl: totalTrades.total_pnl || 0,
        today_pnl: todayMetrics?.total_pnl || 0,
        today_trades: todayMetrics?.trades_executed || 0,
        active_strategies: strategies.count || 0,
        timestamp: new Date().toISOString()
      }, corsHeaders);
    }
  }

  // Cohort analysis endpoint (NEW - Phase 1 implementation)
  if (path === '/api/analytics/cohorts') {
    if (method === 'GET') {
      const url = new URL(request.url);
      const strategyId = url.searchParams.get('strategy_id');
      const minSampleSize = parseInt(url.searchParams.get('min_sample') || '10');
      
      try {
        const analysis = await analyzeCohorts(env, strategyId, minSampleSize);
        return jsonResponse(analysis, corsHeaders);
      } catch (error) {
        console.error('[Cohort Analysis] Error:', error);
        return jsonResponse({ 
          error: 'Cohort analysis failed', 
          message: error.message 
        }, corsHeaders, 500);
      }
    }
  }

  return jsonResponse({ error: 'Endpoint not found' }, corsHeaders, 404);
}

/**
 * JSON response helper
 */
function jsonResponse(data, corsHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Basic dashboard HTML (will be replaced with Next.js frontend)
 */
function getDashboardHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Q08 Prediction Markets</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white">
  <div class="container mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-4xl font-bold mb-2">Q08 Prediction Markets</h1>
      <p class="text-gray-400">Automated prediction market trading system</p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" id="stats">
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-gray-400 text-sm mb-1">Open Positions</div>
        <div class="text-2xl font-bold" id="open-positions">-</div>
      </div>
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-gray-400 text-sm mb-1">Total Trades</div>
        <div class="text-2xl font-bold" id="total-trades">-</div>
      </div>
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-gray-400 text-sm mb-1">Total P&L</div>
        <div class="text-2xl font-bold" id="total-pnl">-</div>
      </div>
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-gray-400 text-sm mb-1">Active Strategies</div>
        <div class="text-2xl font-bold" id="active-strategies">-</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <section>
        <h2 class="text-2xl font-bold mb-4">Latest Signals</h2>
        <div id="signals-feed" class="space-y-2">
          <div class="text-gray-400">Loading...</div>
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold mb-4">Active Trades</h2>
        <div id="trades-feed" class="space-y-2">
          <div class="text-gray-400">Loading...</div>
        </div>
      </section>
    </div>

    <footer class="mt-12 text-center text-gray-500 text-sm">
      <p>Q08 Prediction Markets v1.0 | Built with Cloudflare Workers</p>
      <p class="mt-2">API: <a href="/api/stats" class="text-blue-400 hover:underline">/api/stats</a> | 
      <a href="/api/signals" class="text-blue-400 hover:underline">/api/signals</a> | 
      <a href="/api/trades" class="text-blue-400 hover:underline">/api/trades</a></p>
    </footer>
  </div>

  <script>
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('open-positions').textContent = data.open_positions;
        document.getElementById('total-trades').textContent = data.total_trades;
        document.getElementById('total-pnl').textContent = '$' + (data.total_pnl || 0).toFixed(2);
        document.getElementById('active-strategies').textContent = data.active_strategies;
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }

    async function loadSignals() {
      try {
        const res = await fetch('/api/signals?limit=10');
        const data = await res.json();
        const feed = document.getElementById('signals-feed');
        
        if (data.signals && data.signals.length > 0) {
          feed.innerHTML = data.signals.map(s => \`
            <div class="bg-gray-800 p-4 rounded">
              <div class="flex justify-between items-start mb-2">
                <span class="font-semibold">\${s.signal_type}</span>
                <span class="text-xs text-gray-400">\${new Date(s.detected_at).toLocaleString()}</span>
              </div>
              <div class="text-sm text-gray-300">\${s.market_title || s.market_slug || 'N/A'}</div>
              <div class="text-xs text-gray-500 mt-1">Source: \${s.source} | Strength: \${(s.signal_strength * 100).toFixed(0)}%</div>
            </div>
          \`).join('');
        } else {
          feed.innerHTML = '<div class="text-gray-400">No signals yet</div>';
        }
      } catch (err) {
        console.error('Failed to load signals:', err);
      }
    }

    async function loadTrades() {
      try {
        const res = await fetch('/api/trades/active');
        const data = await res.json();
        const feed = document.getElementById('trades-feed');
        
        if (data.trades && data.trades.length > 0) {
          feed.innerHTML = data.trades.map(t => \`
            <div class="bg-gray-800 p-4 rounded">
              <div class="flex justify-between items-start mb-2">
                <span class="font-semibold">\${t.market_title || t.market_slug}</span>
                <span class="text-xs text-gray-400">\${new Date(t.opened_at).toLocaleString()}</span>
              </div>
              <div class="text-sm text-gray-300">
                \${t.side.toUpperCase()} @ $\${t.entry_price.toFixed(2)} | Size: $\${t.amount.toFixed(2)}
              </div>
              <div class="text-xs text-gray-500 mt-1">Strategy: \${t.strategy_name || t.strategy_id}</div>
            </div>
          \`).join('');
        } else {
          feed.innerHTML = '<div class="text-gray-400">No active trades</div>';
        }
      } catch (err) {
        console.error('Failed to load trades:', err);
      }
    }

    // Load data on page load
    loadStats();
    loadSignals();
    loadTrades();

    // Refresh every 30 seconds
    setInterval(() => {
      loadStats();
      loadSignals();
      loadTrades();
    }, 30000);
  </script>
</body>
</html>
  `;
}
