/**
 * Signal Aggregator - Main Entry Point
 * Coordinates all signal sources and stores detected signals
 */

import { fetchPolymarketSignals } from './market-data.mjs';
import { fetchSocialSentiment } from './social-sentiment.mjs';
import { fetchNewsSignals } from './news-scraper.mjs';
// Note: detectArbitrage is now a cron job, not a signal source

export async function handleSignalAggregation(env) {
  console.log('[Signal Aggregator] Starting aggregation cycle...');
  const startTime = Date.now();
  
  const results = {
    market_signals: 0,
    social_signals: 0,
    news_signals: 0,
    arbitrage_signals: 0,
    errors: []
  };

  try {
    // Run all signal sources in parallel
    const [marketSignals, socialSignals, newsSignals] = await Promise.allSettled([
      fetchPolymarketSignals(env),
      fetchSocialSentiment(env),
      fetchNewsSignals(env)
    ]);

    // Process market signals
    if (marketSignals.status === 'fulfilled') {
      results.market_signals = marketSignals.value.length;
      await storeSignals(env, marketSignals.value);
    } else {
      results.errors.push({ source: 'market_data', error: marketSignals.reason.message });
    }

    // Process social signals
    if (socialSignals.status === 'fulfilled') {
      results.social_signals = socialSignals.value.length;
      await storeSignals(env, socialSignals.value);
    } else {
      results.errors.push({ source: 'social', error: socialSignals.reason.message });
    }

    // Process news signals
    if (newsSignals.status === 'fulfilled') {
      results.news_signals = newsSignals.value.length;
      await storeSignals(env, newsSignals.value);
    } else {
      results.errors.push({ source: 'news', error: newsSignals.reason.message });
    }

    const duration = Date.now() - startTime;
    console.log(`[Signal Aggregator] Completed in ${duration}ms:`, results);

    // Log to system health
    await env.SIGNALS_DB.prepare(`
      INSERT INTO system_health (metric_name, metric_value, status, details)
      VALUES (?, ?, ?, ?)
    `).bind(
      'signal_aggregation_cycle',
      duration,
      results.errors.length > 0 ? 'warning' : 'ok',
      JSON.stringify(results)
    ).run();

    return results;

  } catch (error) {
    console.error('[Signal Aggregator] Fatal error:', error);
    results.errors.push({ source: 'aggregator', error: error.message });
    return results;
  }
}

/**
 * Store signals in database
 */
async function storeSignals(env, signals) {
  if (!signals || signals.length === 0) return 0;

  const stmt = env.SIGNALS_DB.prepare(`
    INSERT OR REPLACE INTO market_signals 
    (id, source, signal_type, event_id, market_slug, market_title, 
     signal_strength, metadata, price_data, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batch = signals.map(signal => 
    stmt.bind(
      signal.id,
      signal.source,
      signal.signal_type,
      signal.event_id || null,
      signal.market_slug || null,
      signal.market_title || null,
      signal.signal_strength,
      signal.metadata ? JSON.stringify(signal.metadata) : null,
      signal.price_data ? JSON.stringify(signal.price_data) : null,
      signal.detected_at || new Date().toISOString()
    )
  );

  await env.SIGNALS_DB.batch(batch);
  
  console.log(`[Signal Aggregator] Stored ${signals.length} signals`);
  return signals.length;
}

/**
 * Generate unique signal ID
 */
export function generateSignalId(source, type, identifier) {
  const timestamp = Date.now();
  return `${source}_${type}_${identifier}_${timestamp}`;
}
