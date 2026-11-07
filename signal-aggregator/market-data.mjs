/**
 * Market Data Signal Detector
 * Fetches real-time data from Polymarket and Kalshi via Tatum API
 */

import { generateSignalId } from './index.mjs';

/**
 * Fetch and analyze Polymarket market signals
 */
export async function fetchPolymarketSignals(env) {
  const signals = [];
  
  try {
    // Use Tatum unified API for both Polymarket and Kalshi
    const tatumKey = env.TATUM_API_KEY;
    if (!tatumKey) {
      console.warn('[Market Data] No Tatum API key configured');
      return signals;
    }

    // Fetch active markets
    const marketsResponse = await fetch(
      'https://api.tatum.io/v4/data/prediction/markets?limit=50&status=active',
      {
        headers: { 'x-api-key': tatumKey },
        cf: { cacheTtl: 60 } // Cache for 1 minute
      }
    );

    if (!marketsResponse.ok) {
      throw new Error(`Tatum API error: ${marketsResponse.status}`);
    }

    const marketsData = await marketsResponse.json();
    const markets = marketsData.data || [];

    console.log(`[Market Data] Fetched ${markets.length} markets`);

    // Analyze each market for signals
    for (const market of markets) {
      const marketSignals = analyzeMarket(market);
      signals.push(...marketSignals);
    }

    // Track API call
    await logApiCall(env, 'tatum', '/markets', marketsResponse.status, true);

    return signals;

  } catch (error) {
    console.error('[Market Data] Error:', error);
    await logApiCall(env, 'tatum', '/markets', 0, false, error.message);
    return signals;
  }
}

/**
 * Analyze a single market for trading signals
 */
function analyzeMarket(market) {
  const signals = [];
  const now = new Date().toISOString();

  try {
    // Extract market info
    const marketSlug = market.slug || market.id;
    const marketTitle = market.title || market.question;
    const yesPrice = parseFloat(market.yes_price || market.price || 0);
    const noPrice = parseFloat(market.no_price || (1 - yesPrice));
    const volume24h = parseFloat(market.volume_24h || 0);
    const liquidity = parseFloat(market.liquidity || 0);

    // Signal 1: Price Movement Detection
    // Look for significant price changes (would need historical data)
    const priceChange = market.price_change_24h || 0;
    if (Math.abs(priceChange) > 0.10) { // 10% price change
      signals.push({
        id: generateSignalId('polymarket', 'price_move', marketSlug),
        source: 'polymarket',
        signal_type: 'price_move',
        event_id: market.event_id || market.id,
        market_slug: marketSlug,
        market_title: marketTitle,
        signal_strength: Math.min(Math.abs(priceChange) * 2, 1.0),
        metadata: {
          direction: priceChange > 0 ? 'up' : 'down',
          change_pct: priceChange,
          volume_24h: volume24h
        },
        price_data: {
          yes_price: yesPrice,
          no_price: noPrice,
          liquidity: liquidity
        },
        detected_at: now
      });
    }

    // Signal 2: High Volume Spike
    if (volume24h > 50000) { // $50k+ volume
      signals.push({
        id: generateSignalId('polymarket', 'high_volume', marketSlug),
        source: 'polymarket',
        signal_type: 'high_volume',
        event_id: market.event_id || market.id,
        market_slug: marketSlug,
        market_title: marketTitle,
        signal_strength: Math.min(volume24h / 100000, 1.0), // Max at $100k
        metadata: {
          volume_24h: volume24h,
          liquidity: liquidity,
          avg_trade_size: volume24h / (market.trades_24h || 1)
        },
        price_data: {
          yes_price: yesPrice,
          no_price: noPrice
        },
        detected_at: now
      });
    }

    // Signal 3: Mispricing Detection (YES + NO should equal ~1.00)
    const pricingSum = yesPrice + noPrice;
    const pricingDeviation = Math.abs(pricingSum - 1.0);
    if (pricingDeviation > 0.05) { // 5% deviation
      signals.push({
        id: generateSignalId('polymarket', 'mispricing', marketSlug),
        source: 'polymarket',
        signal_type: 'mispricing',
        event_id: market.event_id || market.id,
        market_slug: marketSlug,
        market_title: marketTitle,
        signal_strength: Math.min(pricingDeviation * 10, 1.0),
        metadata: {
          yes_price: yesPrice,
          no_price: noPrice,
          sum: pricingSum,
          deviation: pricingDeviation,
          opportunity: pricingSum > 1.0 ? 'sell_both' : 'buy_both'
        },
        price_data: {
          yes_price: yesPrice,
          no_price: noPrice
        },
        detected_at: now
      });
    }

    // Signal 4: Extreme Probability (near 0 or 1)
    if (yesPrice > 0.95 || yesPrice < 0.05) {
      signals.push({
        id: generateSignalId('polymarket', 'extreme_prob', marketSlug),
        source: 'polymarket',
        signal_type: 'extreme_probability',
        event_id: market.event_id || market.id,
        market_slug: marketSlug,
        market_title: marketTitle,
        signal_strength: 0.7,
        metadata: {
          yes_price: yesPrice,
          extreme_side: yesPrice > 0.95 ? 'yes' : 'no',
          potential_edge: 'contrarian_bet'
        },
        price_data: {
          yes_price: yesPrice,
          no_price: noPrice
        },
        detected_at: now
      });
    }

  } catch (error) {
    console.error(`[Market Data] Error analyzing market ${market.slug}:`, error);
  }

  return signals;
}

/**
 * Fetch Kalshi markets for comparison
 */
export async function fetchKalshiSignals(env) {
  const signals = [];
  
  try {
    const kalshiKey = env.KALSHI_API_KEY;
    if (!kalshiKey) {
      console.warn('[Market Data] No Kalshi API key configured');
      return signals;
    }

    // Kalshi API endpoint
    const response = await fetch('https://api.elections.kalshi.com/v1/markets', {
      headers: {
        'Authorization': `Bearer ${kalshiKey}`
      },
      cf: { cacheTtl: 60 }
    });

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }

    const data = await response.json();
    const markets = data.markets || [];

    console.log(`[Market Data] Fetched ${markets.length} Kalshi markets`);

    // Analyze similar to Polymarket
    for (const market of markets) {
      const marketSignals = analyzeKalshiMarket(market);
      signals.push(...marketSignals);
    }

    await logApiCall(env, 'kalshi', '/markets', response.status, true);

    return signals;

  } catch (error) {
    console.error('[Market Data] Kalshi error:', error);
    await logApiCall(env, 'kalshi', '/markets', 0, false, error.message);
    return signals;
  }
}

/**
 * Analyze Kalshi market
 */
function analyzeKalshiMarket(market) {
  const signals = [];
  const now = new Date().toISOString();

  // Similar analysis to Polymarket
  const yesPrice = parseFloat(market.yes_price || 0.5);
  const volume = parseFloat(market.volume || 0);

  if (volume > 10000) {
    signals.push({
      id: generateSignalId('kalshi', 'high_volume', market.ticker),
      source: 'kalshi',
      signal_type: 'high_volume',
      market_slug: market.ticker,
      market_title: market.title,
      signal_strength: Math.min(volume / 50000, 1.0),
      metadata: {
        volume: volume,
        ticker: market.ticker
      },
      price_data: {
        yes_price: yesPrice,
        no_price: 1 - yesPrice
      },
      detected_at: now
    });
  }

  return signals;
}

/**
 * Log API call for monitoring
 */
async function logApiCall(env, service, endpoint, status, success, errorMsg = null) {
  try {
    await env.SIGNALS_DB.prepare(`
      INSERT INTO api_calls (service, endpoint, status_code, success, error_message, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(service, endpoint, status, success ? 1 : 0, errorMsg, 0).run();
  } catch (e) {
    console.error('[Market Data] Failed to log API call:', e);
  }
}
