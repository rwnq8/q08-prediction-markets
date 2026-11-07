-- Q08 Prediction Markets Database Schema
-- Run with: wrangler d1 execute q08-market-signals --file=schema.sql

-- Market signals from various sources
CREATE TABLE IF NOT EXISTS market_signals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,           -- polymarket, kalshi, twitter, reddit, news, whale
  signal_type TEXT NOT NULL,      -- price_move, whale_trade, viral_post, news_event, arbitrage
  event_id TEXT,                  -- Prediction market event identifier
  market_slug TEXT,
  market_title TEXT,
  signal_strength REAL NOT NULL,  -- 0.0-1.0 confidence score
  metadata TEXT,                  -- JSON: Signal-specific data
  price_data TEXT,                -- JSON: Current price info
  detected_at TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_source ON market_signals(source);
CREATE INDEX IF NOT EXISTS idx_signals_processed ON market_signals(processed, detected_at);
CREATE INDEX IF NOT EXISTS idx_signals_market ON market_signals(market_slug);

-- Tracked whale wallets
CREATE TABLE IF NOT EXISTS whale_wallets (
  address TEXT PRIMARY KEY,
  platform TEXT NOT NULL,         -- polymarket, kalshi
  total_volume REAL DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate REAL,
  avg_position_size REAL,
  largest_position REAL,
  tracked_since TEXT NOT NULL,
  last_trade_at TEXT,
  performance_score REAL,         -- Composite score for ranking
  active INTEGER DEFAULT 1,
  metadata TEXT,                  -- JSON: Additional whale data
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whales_performance ON whale_wallets(performance_score DESC, active);
CREATE INDEX IF NOT EXISTS idx_whales_platform ON whale_wallets(platform, active);

-- Whale trades tracking
CREATE TABLE IF NOT EXISTS whale_trades (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  platform TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  market_title TEXT,
  side TEXT NOT NULL,             -- yes, no
  amount REAL NOT NULL,
  price REAL NOT NULL,
  outcome TEXT,                   -- win, loss, open
  pnl REAL,
  detected_at TEXT NOT NULL,
  settled_at TEXT,
  copied INTEGER DEFAULT 0,       -- Whether we copied this trade
  our_trade_id TEXT,              -- Link to our trade if copied
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(wallet_address) REFERENCES whale_wallets(address)
);

CREATE INDEX IF NOT EXISTS idx_whale_trades_wallet ON whale_trades(wallet_address, detected_at);
CREATE INDEX IF NOT EXISTS idx_whale_trades_market ON whale_trades(market_slug);
CREATE INDEX IF NOT EXISTS idx_whale_trades_outcome ON whale_trades(outcome);

-- Trading strategies configuration
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  win_rate REAL,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_pnl REAL DEFAULT 0,
  avg_trade_pnl REAL,
  best_trade_pnl REAL,
  worst_trade_pnl REAL,
  sharpe_ratio REAL,
  max_drawdown REAL,
  capital_allocated REAL,         -- Max capital for this strategy
  config TEXT,                    -- JSON: Strategy-specific parameters
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Executed trades
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  platform TEXT NOT NULL,         -- polymarket, kalshi
  market_slug TEXT NOT NULL,
  market_title TEXT,
  side TEXT NOT NULL,             -- yes, no
  entry_price REAL NOT NULL,
  exit_price REAL,
  amount REAL NOT NULL,           -- Position size in USD
  quantity REAL,                  -- Number of contracts
  fees REAL DEFAULT 0,
  pnl REAL,
  pnl_pct REAL,
  status TEXT NOT NULL,           -- open, closed, stopped, cancelled
  stop_loss REAL,                 -- Stop loss price
  take_profit REAL,               -- Take profit price
  signal_ids TEXT,                -- JSON array of signal IDs that triggered this
  signal_metadata TEXT,           -- JSON: Aggregated signal context
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(strategy_id) REFERENCES strategies(id)
);

CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_slug);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades(pnl DESC);

-- Daily performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  date TEXT PRIMARY KEY,
  total_pnl REAL DEFAULT 0,
  total_fees REAL DEFAULT 0,
  win_rate REAL,
  trades_executed INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  signals_processed INTEGER DEFAULT 0,
  sharpe_ratio REAL,
  max_drawdown REAL,
  portfolio_value REAL,
  capital_deployed REAL,
  strategies_active INTEGER,
  metadata TEXT,                  -- JSON: Additional daily stats
  created_at TEXT DEFAULT (datetime('now'))
);

-- Social sentiment cache (15-minute expiry)
CREATE TABLE IF NOT EXISTS sentiment_cache (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,            -- Event/market topic or keyword
  platform TEXT NOT NULL,         -- twitter, reddit, bluesky
  sentiment_score REAL,           -- -1.0 (very negative) to 1.0 (very positive)
  volume INTEGER,                 -- Post/comment count
  virality_score REAL,            -- Engagement velocity (0-1)
  top_posts TEXT,                 -- JSON: Array of top engaged posts
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sentiment_topic ON sentiment_cache(topic, platform);
CREATE INDEX IF NOT EXISTS idx_sentiment_expires ON sentiment_cache(expires_at);

-- Arbitrage opportunities
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id TEXT PRIMARY KEY,
  market_slug TEXT NOT NULL,
  platform_a TEXT NOT NULL,       -- e.g., polymarket
  platform_b TEXT NOT NULL,       -- e.g., kalshi
  price_a REAL NOT NULL,
  price_b REAL NOT NULL,
  spread_pct REAL NOT NULL,       -- Percentage spread
  profit_potential REAL,          -- Estimated profit in USD
  detected_at TEXT NOT NULL,
  expires_at TEXT,                -- When opportunity likely gone
  executed INTEGER DEFAULT 0,
  trade_ids TEXT,                 -- JSON: Array of trade IDs if executed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_arb_spread ON arbitrage_opportunities(spread_pct DESC, executed);
CREATE INDEX IF NOT EXISTS idx_arb_market ON arbitrage_opportunities(market_slug);

-- Strategy performance history (for optimization)
CREATE TABLE IF NOT EXISTS strategy_performance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  trade_id TEXT,
  metric_type TEXT NOT NULL,      -- win_rate, sharpe, pnl, etc.
  metric_value REAL,
  period TEXT,                    -- daily, weekly, monthly
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(strategy_id) REFERENCES strategies(id)
);

CREATE INDEX IF NOT EXISTS idx_strat_perf_strategy ON strategy_performance_log(strategy_id, recorded_at);

-- Risk events log
CREATE TABLE IF NOT EXISTS risk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,       -- stop_loss, circuit_breaker, max_drawdown, position_limit
  severity TEXT NOT NULL,         -- warning, critical
  trade_id TEXT,
  strategy_id TEXT,
  description TEXT NOT NULL,
  action_taken TEXT,              -- Position closed, trading paused, etc.
  metadata TEXT,                  -- JSON: Event details
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity, created_at);

-- System health metrics
CREATE TABLE IF NOT EXISTS system_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL,
  status TEXT,                    -- ok, warning, critical
  details TEXT,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_metric ON system_health(metric_name, recorded_at);

-- API call tracking (for rate limiting and debugging)
CREATE TABLE IF NOT EXISTS api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL,          -- polymarket, kalshi, twitter, etc.
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  success INTEGER,
  error_message TEXT,
  called_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_calls_service ON api_calls(service, called_at);

-- Cohort analysis results (Phase 1 - Wilson confidence implementation)
CREATE TABLE IF NOT EXISTS cohort_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT,
  analyzed_at TEXT NOT NULL,
  aggregate_stats TEXT,           -- JSON: Overall metrics with Wilson confidence
  cohorts TEXT,                   -- JSON: Breakdown by price_range, time_of_day, etc.
  insights TEXT,                  -- JSON: Profitable cohorts, recommendations
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cohort_strategy ON cohort_analyses(strategy_id, analyzed_at);
