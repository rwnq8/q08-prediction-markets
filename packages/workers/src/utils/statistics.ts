/**
 * Statistical utilities for prediction market validation
 * Based on best practices from Prediction Market Alpha Playbook
 */

/**
 * Wilson score interval (lower bound)
 * 
 * The gold standard for confidence intervals with small sample sizes.
 * Point win rate is misleading: 90% WR on N=5 is noise; 60% WR on N=100 is tradeable.
 * 
 * @param wins - Number of winning outcomes
 * @param total - Total number of outcomes
 * @param confidence - Confidence level (0.95 = 95%)
 * @returns Lower bound of confidence interval
 * 
 * @example
 * wilsonLowerBound(9, 10, 0.95) // ~0.56 (not 0.90!)
 * wilsonLowerBound(60, 100, 0.95) // ~0.50 (statistically valid)
 */
export function wilsonLowerBound(
  wins: number,
  total: number,
  confidence: number = 0.95
): number {
  if (total === 0) return 0;
  
  // Z-score for confidence level
  // 0.95 → 1.96, 0.99 → 2.576, 0.90 → 1.645
  const z = getZScore(confidence);
  const p = wins / total; // Point estimate
  
  // Wilson score interval formula
  // https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval
  const numerator = p + (z * z) / (2 * total) - z * Math.sqrt(
    (p * (1 - p) / total) + (z * z) / (4 * total * total)
  );
  const denominator = 1 + (z * z) / total;
  
  return numerator / denominator;
}

/**
 * Get z-score for confidence level
 */
function getZScore(confidence: number): number {
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
    0.999: 3.291,
  };
  
  return zScores[confidence] || 1.96; // Default to 95%
}

/**
 * Kelly Criterion for position sizing
 * 
 * Optimal bet size = (edge * odds) / (odds - 1)
 * Fractional Kelly (1/4 or 1/2) recommended to reduce variance
 * 
 * @param winProbability - Probability of winning (0-1)
 * @param odds - Decimal odds (e.g., 2.0 = even money)
 * @param fraction - Kelly fraction (0.25 = quarter Kelly, 0.5 = half Kelly)
 * @returns Optimal position size as fraction of bankroll
 * 
 * @example
 * kellyFraction(0.6, 2.0, 0.5) // 0.1 = bet 10% of bankroll
 */
export function kellyFraction(
  winProbability: number,
  odds: number,
  fraction: number = 0.25 // Quarter Kelly by default (conservative)
): number {
  const edge = winProbability - (1 / odds);
  
  if (edge <= 0) return 0; // No edge, no bet
  
  const fullKelly = edge / (odds - 1);
  return Math.max(0, Math.min(fullKelly * fraction, 0.25)); // Cap at 25% of bankroll
}

/**
 * Calculate expected value of a bet
 * 
 * EV = (winProb * winAmount) - (loseProb * loseAmount)
 * 
 * @param winProbability - Probability of winning (0-1)
 * @param winAmount - Amount won if successful
 * @param loseAmount - Amount lost if unsuccessful
 * @returns Expected value (positive = profitable)
 */
export function expectedValue(
  winProbability: number,
  winAmount: number,
  loseAmount: number
): number {
  const loseProbability = 1 - winProbability;
  return (winProbability * winAmount) - (loseProbability * loseAmount);
}

/**
 * Cohort definitions for signal analysis
 * Exhaustive cohort search prevents killing strategies prematurely
 * (A strategy with -20% aggregate ROI might have +60% ROI in the 80-100 price cohort)
 */
export type CohortDimension = 
  | 'price_range'     // 0-20, 20-40, 40-60, 60-80, 80-100
  | 'market_type'     // binary, multi-outcome, conditional
  | 'time_of_day'     // morning, afternoon, evening, night (UTC)
  | 'day_of_week'     // monday-sunday
  | 'liquidity'       // high (>$10k), medium ($1k-$10k), low (<$1k)
  | 'time_to_expiry'  // <1d, 1-7d, 7-30d, >30d
  | 'volatility';     // stable (<2% daily), moderate (2-5%), high (>5%)

export interface Cohort {
  dimension: CohortDimension;
  value: string;
  signalCount: number;
  winCount: number;
  winRate: number;
  wilsonLB95: number;
  avgROI: number;
  totalVolume: number;
}

/**
 * Assign a signal to price range cohort
 */
export function getPriceRangeCohort(probability: number): string {
  if (probability >= 0.8) return '80-100';
  if (probability >= 0.6) return '60-80';
  if (probability >= 0.4) return '40-60';
  if (probability >= 0.2) return '20-40';
  return '0-20';
}

/**
 * Assign a signal to time-of-day cohort (UTC)
 */
export function getTimeOfDayCohort(timestamp: Date): string {
  const hour = timestamp.getUTCHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'night';
}

/**
 * Assign a signal to day-of-week cohort
 */
export function getDayOfWeekCohort(timestamp: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[timestamp.getUTCDay()];
}

/**
 * Assign a signal to time-to-expiry cohort
 */
export function getTimeToExpiryCohort(expiryTimestamp: Date, nowTimestamp: Date = new Date()): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysToExpiry = (expiryTimestamp.getTime() - nowTimestamp.getTime()) / msPerDay;
  
  if (daysToExpiry < 1) return '<1d';
  if (daysToExpiry < 7) return '1-7d';
  if (daysToExpiry < 30) return '7-30d';
  return '>30d';
}

/**
 * Assign a signal to liquidity cohort
 */
export function getLiquidityCohort(volumeUSD: number): string {
  if (volumeUSD >= 10000) return 'high';
  if (volumeUSD >= 1000) return 'medium';
  return 'low';
}

/**
 * Check if strategy should be promoted from paper → live
 * 
 * Requirements (from Alpha Playbook):
 * 1. N ≥ 30 fresh out-of-sample signals
 * 2. Wilson LB95 > 0.50 (better than coin flip with 95% confidence)
 * 3. Positive expected value after fees
 * 4. No severe cohort failures (all cohorts ≥ 0.45 WR)
 */
export interface PromotionCriteria {
  minSampleSize: number;
  minWilsonLB95: number;
  minExpectedValue: number;
  minCohortWR: number;
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minSampleSize: 30,
  minWilsonLB95: 0.50,
  minExpectedValue: 0,
  minCohortWR: 0.45,
};

export function shouldPromoteToLive(
  signalCount: number,
  winCount: number,
  avgEV: number,
  cohorts: Cohort[],
  criteria: PromotionCriteria = DEFAULT_PROMOTION_CRITERIA
): { promote: boolean; reason: string } {
  // Check 1: Sufficient sample size
  if (signalCount < criteria.minSampleSize) {
    return {
      promote: false,
      reason: `Insufficient sample size: ${signalCount} < ${criteria.minSampleSize}`,
    };
  }
  
  // Check 2: Wilson lower bound
  const wilsonLB = wilsonLowerBound(winCount, signalCount, 0.95);
  if (wilsonLB < criteria.minWilsonLB95) {
    return {
      promote: false,
      reason: `Wilson LB95 too low: ${wilsonLB.toFixed(3)} < ${criteria.minWilsonLB95}`,
    };
  }
  
  // Check 3: Positive expected value
  if (avgEV < criteria.minExpectedValue) {
    return {
      promote: false,
      reason: `Negative expected value: ${avgEV.toFixed(2)}`,
    };
  }
  
  // Check 4: No severe cohort failures
  const failedCohorts = cohorts.filter(c => 
    c.signalCount >= 10 && c.winRate < criteria.minCohortWR
  );
  if (failedCohorts.length > 0) {
    return {
      promote: false,
      reason: `Cohort failures: ${failedCohorts.map(c => c.value).join(', ')}`,
    };
  }
  
  return {
    promote: true,
    reason: `Passed: N=${signalCount}, Wilson LB95=${wilsonLB.toFixed(3)}, EV=${avgEV.toFixed(2)}`,
  };
}

/**
 * Risk management: Check if position should be opened
 * 
 * Platform-wide limits (enforced BEFORE order submission):
 * 1. Position limit: Max 10% of bankroll per market
 * 2. Exposure limit: Max 50% of bankroll deployed simultaneously
 * 3. Daily loss limit: Stop trading at -5% daily drawdown
 */
export interface RiskLimits {
  maxPositionPct: number;      // Max % of bankroll per market
  maxExposurePct: number;       // Max % of bankroll deployed total
  dailyLossLimitPct: number;    // Daily drawdown % that stops trading
  minEdgeBps: number;           // Minimum edge in basis points (400 = 4%)
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionPct: 0.10,    // 10% max per market
  maxExposurePct: 0.50,    // 50% max deployed
  dailyLossLimitPct: 0.05, // 5% daily loss limit
  minEdgeBps: 400,         // 4% minimum edge (covers Polymarket + Kalshi fees)
};

export interface RiskCheck {
  allowed: boolean;
  reason: string;
  suggestedSize?: number;
}

export function checkRiskLimits(
  proposedSize: number,
  bankroll: number,
  currentExposure: number,
  dailyPnL: number,
  edge: number, // In basis points (100 = 1%)
  limits: RiskLimits = DEFAULT_RISK_LIMITS
): RiskCheck {
  // Check 1: Daily loss limit
  const dailyLossPct = Math.abs(dailyPnL) / bankroll;
  if (dailyPnL < 0 && dailyLossPct >= limits.dailyLossLimitPct) {
    return {
      allowed: false,
      reason: `Daily loss limit reached: -${(dailyLossPct * 100).toFixed(2)}% >= -${(limits.dailyLossLimitPct * 100).toFixed(0)}%`,
    };
  }
  
  // Check 2: Minimum edge (after fees)
  if (edge < limits.minEdgeBps) {
    return {
      allowed: false,
      reason: `Edge too small: ${edge}bps < ${limits.minEdgeBps}bps (won't outpace fees)`,
    };
  }
  
  // Check 3: Position size limit
  const maxPositionSize = bankroll * limits.maxPositionPct;
  if (proposedSize > maxPositionSize) {
    return {
      allowed: true, // Allow but resize
      reason: `Position size reduced to ${limits.maxPositionPct * 100}% limit`,
      suggestedSize: maxPositionSize,
    };
  }
  
  // Check 4: Exposure limit
  const newExposure = currentExposure + proposedSize;
  const maxExposure = bankroll * limits.maxExposurePct;
  if (newExposure > maxExposure) {
    const availableCapital = maxExposure - currentExposure;
    if (availableCapital <= 0) {
      return {
        allowed: false,
        reason: `Exposure limit reached: ${(currentExposure / bankroll * 100).toFixed(0)}% >= ${(limits.maxExposurePct * 100).toFixed(0)}%`,
      };
    }
    return {
      allowed: true,
      reason: `Position size reduced to stay within exposure limit`,
      suggestedSize: availableCapital,
    };
  }
  
  return {
    allowed: true,
    reason: 'All risk checks passed',
  };
}
