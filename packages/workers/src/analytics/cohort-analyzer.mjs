/**
 * Cohort Analysis for Q08 Prediction Markets
 * Implements exhaustive cohort search to prevent premature strategy killing
 */

import {
  wilsonLowerBound,
  getPriceRangeCohort,
  getTimeOfDayCohort,
  getDayOfWeekCohort,
  getTimeToExpiryCohort,
  getLiquidityCohort
} from '../utils/statistics.ts';

export async function analyzeCohorts(env, strategyId = null, minSampleSize = 10) {
  console.log(`[Cohort Analyzer] Starting analysis for strategy: ${strategyId || 'ALL'}`);
  
  const query = `
    SELECT 
      s.*,
      t.status as trade_status,
      t.pnl as trade_pnl,
      CASE WHEN t.pnl > 0 THEN 1 WHEN t.pnl <= 0 THEN 0 ELSE NULL END as is_win
    FROM market_signals s
    LEFT JOIN trades t ON t.signal_ids LIKE '%' || s.id || '%'
    WHERE t.status = 'closed'
    ${strategyId ? `AND t.strategy_id = ?` : ''}
    ORDER BY s.detected_at DESC
  `;
  
  const params = strategyId ? [strategyId] : [];
  const result = await env.SIGNALS_DB.prepare(query).bind(...params).all();
  const signals = result.results;
  
  if (signals.length === 0) {
    return { error: 'No completed signals found', cohorts: [] };
  }
  
  console.log(`[Cohort Analyzer] Analyzing ${signals.length} completed signals`);
  
  const cohorts = {
    price_range: {},
    time_of_day: {},
    day_of_week: {},
    signal_type: {},
  };
  
  signals.forEach(signal => {
    if (signal.is_win === null) return;
    
    const priceData = signal.price_data ? JSON.parse(signal.price_data) : null;
    const detectedAt = new Date(signal.detected_at);
    
    if (priceData && priceData.current_price !== undefined) {
      const cohort = getPriceRangeCohort(priceData.current_price);
      if (!cohorts.price_range[cohort]) cohorts.price_range[cohort] = { wins: 0, total: 0, pnl: 0 };
      cohorts.price_range[cohort].total++;
      if (signal.is_win) cohorts.price_range[cohort].wins++;
      cohorts.price_range[cohort].pnl += (signal.trade_pnl || 0);
    }
    
    const todCohort = getTimeOfDayCohort(detectedAt);
    if (!cohorts.time_of_day[todCohort]) cohorts.time_of_day[todCohort] = { wins: 0, total: 0, pnl: 0 };
    cohorts.time_of_day[todCohort].total++;
    if (signal.is_win) cohorts.time_of_day[todCohort].wins++;
    cohorts.time_of_day[todCohort].pnl += (signal.trade_pnl || 0);
    
    const dowCohort = getDayOfWeekCohort(detectedAt);
    if (!cohorts.day_of_week[dowCohort]) cohorts.day_of_week[dowCohort] = { wins: 0, total: 0, pnl: 0 };
    cohorts.day_of_week[dowCohort].total++;
    if (signal.is_win) cohorts.day_of_week[dowCohort].wins++;
    cohorts.day_of_week[dowCohort].pnl += (signal.trade_pnl || 0);
    
    const stCohort = signal.signal_type || 'unknown';
    if (!cohorts.signal_type[stCohort]) cohorts.signal_type[stCohort] = { wins: 0, total: 0, pnl: 0 };
    cohorts.signal_type[stCohort].total++;
    if (signal.is_win) cohorts.signal_type[stCohort].wins++;
    cohorts.signal_type[stCohort].pnl += (signal.trade_pnl || 0);
  });
  
  const results = {};
  Object.keys(cohorts).forEach(dimension => {
    results[dimension] = Object.keys(cohorts[dimension])
      .map(cohortValue => {
        const data = cohorts[dimension][cohortValue];
        const winRate = data.total > 0 ? data.wins / data.total : 0;
        const wilsonLB95 = wilsonLowerBound(data.wins, data.total, 0.95);
        const avgPnL = data.total > 0 ? data.pnl / data.total : 0;
        
        return {
          dimension,
          cohort: cohortValue,
          total_signals: data.total,
          wins: data.wins,
          win_rate: winRate,
          wilson_lb95: wilsonLB95,
          total_pnl: data.pnl,
          avg_pnl: avgPnL,
          is_profitable: wilsonLB95 > 0.50 && data.total >= minSampleSize,
          is_statistically_valid: data.total >= minSampleSize
        };
      })
      .filter(c => c.total_signals >= minSampleSize)
      .sort((a, b) => b.wilson_lb95 - a.wilson_lb95);
  });
  
  const allCohorts = Object.values(results).flat();
  const profitableCohorts = allCohorts.filter(c => c.is_profitable).sort((a, b) => b.wilson_lb95 - a.wilson_lb95).slice(0, 10);
  
  const totalSignals = signals.filter(s => s.is_win !== null).length;
  const totalWins = signals.filter(s => s.is_win === 1).length;
  const aggregateWR = totalSignals > 0 ? totalWins / totalSignals : 0;
  const aggregateWilsonLB95 = wilsonLowerBound(totalWins, totalSignals, 0.95);
  const totalPnL = signals.reduce((sum, s) => sum + (s.trade_pnl || 0), 0);
  
  return {
    strategy_id: strategyId || 'ALL',
    analyzed_at: new Date().toISOString(),
    aggregate: {
      total_signals: totalSignals,
      total_wins: totalWins,
      win_rate: aggregateWR,
      wilson_lb95: aggregateWilsonLB95,
      total_pnl: totalPnL,
      hidden_alpha: aggregateWilsonLB95 < 0.50 && profitableCohorts.length > 0
    },
    cohorts: results,
    insights: { profitable_cohorts: profitableCohorts }
  };
}
