/**
 * Cross-Platform Arbitrage Strategy
 * Detects and executes arbitrage opportunities between Polymarket and Kalshi
 * Target: 5-15% ROI per trade, Low Risk
 */

/**
 * Detect arbitrage opportunities
 * @param {Object} env - Environment bindings
 * @returns {Promise<Array>} - List of arbitrage opportunities
 */
export async function detectArbitrage(env) {
  const opportunities = [];
  const now = new Date().toISOString();

  try {
    // Fetch markets from both platforms
    const [polymarkets, kalshiMarkets] = await Promise.all([
      fetchPolymarketPrices(env),
      fetchKalshiPrices(env)
    ]);

    // Match markets across platforms
    for (const polyMarket of polymarkets) {
      for (const kalshiMarket of kalshiMarkets) {
        // Check if markets are similar (same event)
        if (marketsMatch(polyMarket, kalshiMarket)) {
          const arb = calculateArbitrage(polyMarket, kalshiMarket);
          
          if (arb && arb.profit_pct >= parseFloat(env.MIN_ARBITRAGE_SPREAD_PCT || '3')) {
            opportunities.push({
              ...arb,
              detected_at: now
            });
          }
        }
      }
    }

    // Store opportunities in database
    if (opportunities.length > 0) {
      await storeArbitrageOpportunities(env, opportunities);
    }

    console.log(`[Arbitrage] Found ${opportunities.length} opportunities`);
    return opportunities;

  } catch (error) {
    console.error('[Arbitrage] Detection error:', error);
    return opportunities;
  }
}

/**
 * Fetch Polymarket prices
 */
async function fetchPolymarketPrices(env) {
  const apiKey = env.TATUM_API_KEY || env.POLYMARKET_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      'https://api.tatum.io/v4/data/prediction-markets/polymarket/markets?status=active&limit=100',
      {
        headers: { 'x-api-key': apiKey },
        cf: { cacheTtl: 60 }
      }
    );

    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.data || []).map(m => ({
      platform: 'polymarket',
      market_id: m.id,
      title: m.question || m.title,
      yes_price: parseFloat(m.outcomes?.[0]?.price || 0),
      no_price: parseFloat(m.outcomes?.[1]?.price || 0),
      volume_24h: parseFloat(m.volume24h || 0),
      liquidity: parseFloat(m.liquidity || 0)
    }));

  } catch (error) {
    console.error('[Arbitrage] Polymarket fetch error:', error);
    return [];
  }
}

/**
 * Fetch Kalshi prices
 */
async function fetchKalshiPrices(env) {
  const apiKey = env.TATUM_API_KEY || env.KALSHI_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      'https://api.tatum.io/v4/data/prediction-markets/kalshi/markets?status=open&limit=100',
      {
        headers: { 'x-api-key': apiKey },
        cf: { cacheTtl: 60 }
      }
    );

    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.data || []).map(m => ({
      platform: 'kalshi',
      market_id: m.ticker,
      title: m.title,
      yes_price: parseFloat(m.last_price || 0) / 100, // Kalshi uses cents
      no_price: 1.0 - (parseFloat(m.last_price || 0) / 100),
      volume_24h: parseFloat(m.volume || 0),
      liquidity: parseFloat(m.open_interest || 0) * parseFloat(m.last_price || 0) / 100
    }));

  } catch (error) {
    console.error('[Arbitrage] Kalshi fetch error:', error);
    return [];
  }
}

/**
 * Check if two markets represent the same event
 */
function marketsMatch(market1, market2) {
  const title1 = market1.title.toLowerCase();
  const title2 = market2.title.toLowerCase();

  // Simple keyword matching (would use embeddings in production)
  const keywords1 = title1.match(/\b\w{4,}\b/g) || [];
  const keywords2 = title2.match(/\b\w{4,}\b/g) || [];

  // Check for significant keyword overlap
  const commonKeywords = keywords1.filter(k => keywords2.includes(k));
  const similarity = commonKeywords.length / Math.max(keywords1.length, keywords2.length);

  return similarity > 0.4; // 40% keyword overlap
}

/**
 * Calculate arbitrage profit potential
 */
function calculateArbitrage(market1, market2) {
  // Strategy: Buy YES on cheaper platform, buy NO on other platform
  // Guaranteed profit if YES_A + NO_B < 1.0
  
  const scenarios = [
    {
      buy_yes_on: market1.platform,
      buy_no_on: market2.platform,
      yes_price: market1.yes_price,
      no_price: market2.no_price,
      cost: market1.yes_price + market2.no_price
    },
    {
      buy_yes_on: market2.platform,
      buy_no_on: market1.platform,
      yes_price: market2.yes_price,
      no_price: market1.no_price,
      cost: market2.yes_price + market1.no_price
    }
  ];

  // Find best arbitrage scenario
  for (const scenario of scenarios) {
    if (scenario.cost < 0.97) { // Account for fees (~3%)
      const profit = 1.0 - scenario.cost;
      const profit_pct = (profit / scenario.cost) * 100;

      return {
        market_1_id: market1.market_id,
        market_1_title: market1.title,
        market_1_platform: market1.platform,
        market_2_id: market2.market_id,
        market_2_title: market2.title,
        market_2_platform: market2.platform,
        buy_yes_on: scenario.buy_yes_on,
        buy_no_on: scenario.buy_no_on,
        yes_price: scenario.yes_price,
        no_price: scenario.no_price,
        total_cost: scenario.cost,
        profit_amount: profit,
        profit_pct: profit_pct,
        estimated_volume: Math.min(market1.volume_24h, market2.volume_24h),
        liquidity_score: Math.min(market1.liquidity, market2.liquidity)
      };
    }
  }

  return null;
}

/**
 * Store arbitrage opportunities in database
 */
async function storeArbitrageOpportunities(env, opportunities) {
  try {
    const stmt = env.SIGNALS_DB.prepare(`
      INSERT OR REPLACE INTO arbitrage_opportunities (
        market_1_id, market_1_title, market_1_platform,
        market_2_id, market_2_title, market_2_platform,
        buy_yes_on, buy_no_on, yes_price, no_price,
        total_cost, profit_amount, profit_pct,
        estimated_volume, liquidity_score, detected_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const batch = opportunities.map(opp => 
      stmt.bind(
        opp.market_1_id, opp.market_1_title, opp.market_1_platform,
        opp.market_2_id, opp.market_2_title, opp.market_2_platform,
        opp.buy_yes_on, opp.buy_no_on, opp.yes_price, opp.no_price,
        opp.total_cost, opp.profit_amount, opp.profit_pct,
        opp.estimated_volume, opp.liquidity_score, opp.detected_at
      )
    );

    await env.SIGNALS_DB.batch(batch);
    console.log(`[Arbitrage] Stored ${opportunities.length} opportunities`);

  } catch (error) {
    console.error('[Arbitrage] Storage error:', error);
  }
}

/**
 * Execute arbitrage trade
 */
export async function executeArbitrage(env, opportunity) {
  // This would integrate with actual trading APIs
  // For now, just log the trade intent
  
  console.log('[Arbitrage] Would execute:', {
    action: `Buy YES on ${opportunity.buy_yes_on} at ${opportunity.yes_price}`,
    hedge: `Buy NO on ${opportunity.buy_no_on} at ${opportunity.no_price}`,
    expectedProfit: `${opportunity.profit_pct.toFixed(2)}%`
  });

  // Return mock trade result
  return {
    success: true,
    trades: [
      {
        platform: opportunity.buy_yes_on,
        market_id: opportunity.market_1_id,
        side: 'YES',
        price: opportunity.yes_price,
        amount: 100
      },
      {
        platform: opportunity.buy_no_on,
        market_id: opportunity.market_2_id,
        side: 'NO',
        price: opportunity.no_price,
        amount: 100
      }
    ],
    total_cost: opportunity.total_cost * 100,
    expected_profit: opportunity.profit_amount * 100
  };
}
