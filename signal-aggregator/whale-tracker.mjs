/**
 * Whale Wallet Tracker
 * Monitors large traders on Polymarket and Kalshi
 */

import { generateSignalId } from './index.mjs';

const WHALE_THRESHOLD = 10000; // $10k+ position size
const TOP_WHALE_COUNT = 50;

/**
 * Main whale tracking handler
 */
export async function handleWhaleTracking(env) {
  console.log('[Whale Tracker] Starting whale tracking cycle...');
  
  try {
    // Refresh whale wallet list
    const whales = await discoverWhales(env);
    console.log(`[Whale Tracker] Found ${whales.length} whales`);

    // Track their recent trades
    const signals = await trackWhaleTrades(env, whales);
    console.log(`[Whale Tracker] Generated ${signals.length} whale signals`);

    // Store signals
    if (signals.length > 0) {
      const stmt = env.SIGNALS_DB.prepare(`
        INSERT OR REPLACE INTO market_signals 
        (id, source, signal_type, event_id, market_slug, market_title, 
         signal_strength, metadata, price_data, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = signals.map(s => 
        stmt.bind(
          s.id, s.source, s.signal_type, s.event_id, s.market_slug, 
          s.market_title, s.signal_strength,
          JSON.stringify(s.metadata), JSON.stringify(s.price_data), s.detected_at
        )
      );

      await env.SIGNALS_DB.batch(batch);
    }

    return { whales: whales.length, signals: signals.length };

  } catch (error) {
    console.error('[Whale Tracker] Error:', error);
    throw error;
  }
}

/**
 * Discover whale wallets from Polymarket
 */
async function discoverWhales(env) {
  const whales = [];
  
  try {
    // In production, would call Polymarket API to get top traders
    // For now, using Tatum API if available
    
    const tatumKey = env.TATUM_API_KEY;
    if (!tatumKey) {
      console.warn('[Whale Tracker] No Tatum API key');
      return whales;
    }

    // Get top wallets by volume (Tatum endpoint or Polymarket direct)
    // This is a placeholder - actual endpoint depends on API availability
    const response = await fetch(
      'https://api.tatum.io/v4/data/prediction/wallets/top?limit=50',
      {
        headers: { 'x-api-key': tatumKey },
        cf: { cacheTtl: 3600 } // Cache for 1 hour
      }
    );

    if (!response.ok) {
      // Fallback: Get whales from our existing database
      const existing = await env.SIGNALS_DB.prepare(`
        SELECT * FROM whale_wallets 
        WHERE active = 1 
        ORDER BY performance_score DESC 
        LIMIT ?
      `).bind(TOP_WHALE_COUNT).all();

      return existing.results || [];
    }

    const data = await response.json();
    const wallets = data.data || data.wallets || [];

    // Process and score whales
    for (const wallet of wallets) {
      const address = wallet.address || wallet.wallet_address;
      const volume = parseFloat(wallet.total_volume || 0);
      
      if (volume >= WHALE_THRESHOLD) {
        const wins = parseInt(wallet.wins || 0);
        const losses = parseInt(wallet.losses || 0);
        const totalTrades = wins + losses;
        const winRate = totalTrades > 0 ? wins / totalTrades : 0;

        // Calculate performance score
        const performanceScore = calculatePerformanceScore(wallet);

        // Upsert whale
        await env.SIGNALS_DB.prepare(`
          INSERT OR REPLACE INTO whale_wallets 
          (address, platform, total_volume, total_trades, wins, losses, win_rate,
           avg_position_size, largest_position, tracked_since, last_trade_at, 
           performance_score, active, metadata, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
        `).bind(
          address,
          'polymarket',
          volume,
          totalTrades,
          wins,
          losses,
          winRate,
          wallet.avg_position || volume / Math.max(totalTrades, 1),
          wallet.largest_position || 0,
          wallet.first_trade_at || new Date().toISOString(),
          wallet.last_trade_at || new Date().toISOString(),
          performanceScore,
          JSON.stringify(wallet)
        ).run();

        whales.push({
          address,
          performance_score: performanceScore,
          win_rate: winRate,
          total_volume: volume
        });
      }
    }

  } catch (error) {
    console.error('[Whale Tracker] Discovery error:', error);
  }

  return whales;
}

/**
 * Track recent trades from whale wallets
 */
async function trackWhaleTrades(env, whales) {
  const signals = [];
  const now = new Date().toISOString();

  for (const whale of whales.slice(0, 20)) { // Track top 20 whales
    try {
      // Fetch recent trades for this whale
      const trades = await fetchWhaleRecentTrades(env, whale.address);

      for (const trade of trades) {
        // Generate signal for this whale trade
        const signal = {
          id: generateSignalId('whale', 'trade', `${whale.address}_${trade.id}`),
          source: 'whale',
          signal_type: 'whale_trade',
          event_id: trade.market_id,
          market_slug: trade.market_slug,
          market_title: trade.market_title,
          signal_strength: whale.performance_score,
          metadata: {
            whale_address: whale.address,
            whale_win_rate: whale.win_rate,
            whale_total_volume: whale.total_volume,
            trade_amount: trade.amount,
            trade_side: trade.side,
            confidence: calculateTradeConfidence(whale, trade)
          },
          price_data: {
            entry_price: trade.price,
            yes_price: trade.yes_price,
            no_price: trade.no_price
          },
          detected_at: now
        };

        signals.push(signal);

        // Store whale trade
        await env.SIGNALS_DB.prepare(`
          INSERT OR REPLACE INTO whale_trades 
          (id, wallet_address, platform, market_slug, market_title, side, 
           amount, price, detected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          trade.id,
          whale.address,
          'polymarket',
          trade.market_slug,
          trade.market_title,
          trade.side,
          trade.amount,
          trade.price,
          now
        ).run();
      }

    } catch (error) {
      console.error(`[Whale Tracker] Error tracking whale ${whale.address}:`, error);
    }
  }

  return signals;
}

/**
 * Fetch recent trades for a whale wallet
 */
async function fetchWhaleRecentTrades(env, address) {
  try {
    // In production: Call Polymarket API for wallet trades
    // Placeholder response
    const response = await fetch(
      `https://clob.polymarket.com/trades?wallet=${address}&limit=10`,
      { cf: { cacheTtl: 300 } }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.trades || []).map(t => ({
      id: t.id || `${address}_${Date.now()}`,
      market_id: t.market_id,
      market_slug: t.market_slug || t.ticker,
      market_title: t.market_title || t.question,
      side: t.side || 'yes',
      amount: parseFloat(t.size || t.amount || 0),
      price: parseFloat(t.price || 0.5),
      yes_price: parseFloat(t.yes_price || 0.5),
      no_price: parseFloat(t.no_price || 0.5),
      timestamp: t.timestamp || new Date().toISOString()
    }));

  } catch (error) {
    console.error(`[Whale Tracker] Fetch trades error for ${address}:`, error);
    return [];
  }
}

/**
 * Calculate whale performance score (0-1)
 */
function calculatePerformanceScore(whale) {
  const volume = parseFloat(whale.total_volume || 0);
  const wins = parseInt(whale.wins || 0);
  const losses = parseInt(wallet.losses || 0);
  const totalTrades = wins + losses;

  if (totalTrades === 0) return 0;

  const winRate = wins / totalTrades;
  const volumeScore = Math.min(volume / 1000000, 1.0); // Max at $1M
  const tradeCountScore = Math.min(totalTrades / 100, 1.0); // Max at 100 trades

  // Weighted score: 60% win rate, 25% volume, 15% trade count
  const score = (winRate * 0.6) + (volumeScore * 0.25) + (tradeCountScore * 0.15);

  return Math.min(Math.max(score, 0), 1.0);
}

/**
 * Calculate confidence in copying this specific trade
 */
function calculateTradeConfidence(whale, trade) {
  const baseConfidence = whale.win_rate || 0.5;
  const sizeScore = Math.min(trade.amount / 50000, 1.0); // Larger trades = more confident
  
  // Combine whale's historical performance with trade size
  return (baseConfidence * 0.7) + (sizeScore * 0.3);
}
