# Q08 Prediction Markets - System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKERS EDGE                      │
│                    (Global, <50ms latency)                       │
└─────────────────────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
    ┌──────────┐         ┌──────────┐        ┌──────────┐
    │  CRON    │         │   API    │        │DASHBOARD │
    │ TRIGGERS │         │ ROUTES   │        │   HTML   │
    └──────────┘         └──────────┘        └──────────┘
          │                    │                    │
    Every 1m: Arbitrage    /api/signals       Real-time Stats
    Every 5m: Signals      /api/trades        Charts & Metrics
    Every 6h: Whales       /api/performance   Active Positions
    Daily: Reports         /api/whales
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SIGNAL AGGREGATION LAYER                      │
│                  (Multi-source data collection)                  │
└─────────────────────────────────────────────────────────────────┘
          │
    ┌─────┴──────┬──────────┬──────────┬───────────┐
    ▼            ▼          ▼          ▼           ▼
┌─────────┐  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ MARKET  │  │ WHALE  │ │SOCIAL  │ │  NEWS  │ │ ATLAS   │
│  DATA   │  │TRACKER │ │SENTIMENT│ │ SCRAPER│ │RESEARCH │
└─────────┘  └────────┘ └────────┘ └────────┘ └─────────┘
     │           │          │          │           │
  Polymarket  Top 50    Twitter    GDELT      (Future)
  Kalshi      Whales    Reddit     NewsAPI
  via Tatum   On-chain  Bluesky
                │
                ▼
    ┌──────────────────────┐
    │   SIGNAL SCORING     │
    │  (Strength 0-1.0)    │
    └──────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STRATEGY ENGINE                             │
│                  (7 Trading Strategies)                          │
└─────────────────────────────────────────────────────────────────┘
          │
    ┌─────┴──────┬──────────┬──────────┬───────────┬──────────┬─────────┐
    ▼            ▼          ▼          ▼           ▼          ▼         ▼
┌─────────┐  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐
│ARBITRAGE│  │ WHALE  │ │SENTIMENT│ │  NEWS  │ │AI EDGE │ │MARKET│ │ MEAN │
│ 5-15%   │  │  COPY  │ │  EDGE   │ │ DRIVEN │ │12-20%  │ │MAKING│ │REVERT│
│ ROI     │  │ 8-18%  │ │ 10-25%  │ │ 15-40% │ │        │ │5-10% │ │8-15% │
└─────────┘  └────────┘ └────────┘ └────────┘ └────────┘ └──────┘ └──────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   RISK MANAGER       │
                    │  (Kelly Criterion)   │
                    └──────────────────────┘
                                │
                    Max 10% per trade
                    Max 30% exposure
                    -15% stop loss
                    -10% circuit breaker
                                │
                                ▼
                    ┌──────────────────────┐
                    │   ORDER ROUTER       │
                    │  (Execute Trades)    │
                    └──────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │  POLYMARKET  │        │   KALSHI     │
            │  (USDC/Poly) │        │  (USD/CFTC)  │
            └──────────────┘        └──────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA PERSISTENCE                           │
└─────────────────────────────────────────────────────────────────┘
          │
    ┌─────┴──────┬──────────┬──────────┐
    ▼            ▼          ▼          ▼
┌─────────┐  ┌────────┐ ┌────────┐ ┌────────┐
│SIGNALS  │  │ TRADES │ │CACHE   │ │ AUDIT  │
│   DB    │  │   DB   │ │  KV    │ │  LOG   │
│  (D1)   │  │  (D1)  │ │        │ │  (D1)  │
└─────────┘  └────────┘ └────────┘ └────────┘
```

---

## 📦 Component Details

### 1. Signal Aggregator
**Purpose:** Collect and score trading signals from multiple sources

**Components:**
- `index.mjs` - Coordinator
- `market-data.mjs` - Price/volume signals
- `whale-tracker.mjs` - Wallet tracking
- `social-sentiment.mjs` - Twitter/Reddit
- `news-scraper.mjs` - GDELT/NewsAPI

**Flow:**
```
Cron Trigger (5min)
  → Fetch from all sources in parallel
  → Score signal strength (0-1.0)
  → Batch insert to SIGNALS_DB
  → Return signal count
```

**Output:**
```javascript
{
  id: "poly_price_move_0x123_1699...",
  source: "polymarket",
  signal_type: "price_move",
  market_slug: "trump-wins-2024",
  signal_strength: 0.85,
  metadata: { price_change: 0.15, volume_24h: 125000 },
  detected_at: "2026-11-07T12:34:56Z"
}
```

### 2. Strategy Engine
**Purpose:** Convert signals into trade decisions

**Strategies:**
1. **Arbitrage** (`arbitrage.mjs`) ✅ BUILT
   - Cross-platform price discrepancies
   - Risk: Low | ROI: 5-15%
   
2. **Whale Copy** (TODO)
   - Mirror high-performing traders
   - Risk: Medium | ROI: 8-18%
   
3. **Sentiment Edge** (TODO)
   - Social sentiment → price movement
   - Risk: Medium | ROI: 10-25%
   
4. **News Driven** (TODO)
   - Breaking news arbitrage
   - Risk: High | ROI: 15-40%
   
5. **AI Edge** (TODO)
   - Q08 forecasts vs market
   - Risk: Medium | ROI: 12-20%
   
6. **Market Making** (TODO)
   - Provide liquidity, capture spread
   - Risk: Low | ROI: 5-10%
   
7. **Mean Reversion** (TODO)
   - Trade oversold/overbought
   - Risk: Medium | ROI: 8-15%

**Flow:**
```
Signal Input
  → Strategy evaluates (should_trade?)
  → If yes: Calculate position size (Kelly)
  → Risk Manager approval
  → Order Router execution
  → Store in TRADES_DB
```

### 3. Risk Manager
**Purpose:** Protect capital with automated controls

**Rules:**
| Control | Threshold | Action |
|---------|-----------|--------|
| Position size | >10% capital | Reject trade |
| Portfolio exposure | >30% capital | Reject trade |
| Per-trade stop | -15% | Auto close |
| Strategy daily stop | -20% | Disable strategy |
| Portfolio circuit breaker | -10% | Stop all trading |

**Implementation:**
```javascript
function checkRisk(trade, portfolio) {
  if (trade.amount > portfolio.capital * 0.10) return false;
  if (portfolio.exposure + trade.amount > portfolio.capital * 0.30) return false;
  if (portfolio.daily_pnl < -0.10 * portfolio.capital) return false;
  return true;
}
```

### 4. Order Router
**Purpose:** Execute trades on Polymarket/Kalshi

**Process:**
```
Trade Decision
  → Check platform (Polymarket vs Kalshi)
  → Get wallet/account balance
  → Place order via API
  → Wait for confirmation
  → Update TRADES_DB with fill price
  → Log to AUDIT
```

**APIs:**
- Polymarket: CLOB API (orderbook)
- Kalshi: REST API (market orders)
- Tatum: Unified abstraction (recommended)

---

## 🗄️ Database Schema

### SIGNALS_DB (Cloudflare D1)

**market_signals**
```sql
id                  TEXT PRIMARY KEY
source              TEXT        -- 'polymarket', 'twitter', etc
signal_type         TEXT        -- 'price_move', 'whale_trade', etc  
market_slug         TEXT        -- 'trump-wins-2024'
signal_strength     REAL        -- 0.0 to 1.0
metadata            TEXT (JSON) -- Extra context
detected_at         TEXT (ISO8601)
```

**whale_wallets**
```sql
wallet_address      TEXT PRIMARY KEY
performance_score   REAL        -- Weighted score
total_volume        REAL
trade_count         INTEGER
win_count           INTEGER
win_rate            REAL        -- 0.0 to 1.0
last_updated        TEXT
```

**arbitrage_opportunities**
```sql
market_1_id         TEXT
market_2_id         TEXT
profit_pct          REAL        -- 3.5 = 3.5% profit
buy_yes_on          TEXT        -- 'polymarket'
buy_no_on           TEXT        -- 'kalshi'
detected_at         TEXT
status              TEXT        -- 'active', 'executed', 'expired'
```

### TRADES_DB (Cloudflare D1)

**trades**
```sql
id                  TEXT PRIMARY KEY
strategy_id         TEXT        -- 'arbitrage', 'whale-copy', etc
market_id           TEXT
side                TEXT        -- 'YES' or 'NO'
entry_price         REAL
entry_size          REAL
entry_time          TEXT
exit_price          REAL        -- NULL if still open
exit_time           TEXT
pnl                 REAL        -- Profit/loss
status              TEXT        -- 'open', 'closed', 'stopped'
```

**strategies**
```sql
id                  TEXT PRIMARY KEY -- 'arbitrage'
name                TEXT
enabled             INTEGER     -- 0 or 1
capital_allocated   REAL
max_position_size   REAL
stop_loss_pct       REAL        -- 15.0
```

### CACHE (Cloudflare KV)

**Keys:**
- `market:{platform}:{id}` → Market data (TTL: 60s)
- `whale:{address}` → Whale trades (TTL: 300s)
- `sentiment:{slug}` → Social sentiment (TTL: 300s)
- `news:{hash}` → News articles (TTL: 600s)

---

## 🔄 Data Flow Examples

### Example 1: Arbitrage Detection

```
1. Cron triggers (every 1 min)
   ↓
2. arbitrage.mjs fetches markets
   - Polymarket: "Trump wins 2024" YES = 0.65
   - Kalshi: "Trump wins 2024" NO = 0.40
   - Total cost: 0.65 + 0.40 = 1.05 (no arb)
   ↓
3. Continue searching...
   - Polymarket: "Bitcoin >$100k" YES = 0.45
   - Kalshi: "Bitcoin >$100k" NO = 0.48
   - Total cost: 0.45 + 0.48 = 0.93 (ARB!)
   ↓
4. Calculate profit
   - Cost: $0.93 → Payout: $1.00
   - Profit: $0.07 per $1 = 7.5% ROI
   ↓
5. Store in arbitrage_opportunities table
   ↓
6. Strategy engine picks it up (next cycle)
   ↓
7. Risk manager approves (size < 10%)
   ↓
8. Order router executes both sides
   - Buy YES on Polymarket at 0.45
   - Buy NO on Kalshi at 0.48
   ↓
9. Market resolves (either YES or NO)
   - One side pays $1.00
   - Other side pays $0.00
   - Net: $1.00 - $0.93 = $0.07 profit ✅
```

### Example 2: Whale Copy Trade

```
1. Cron triggers (every 6 hours)
   ↓
2. whale-tracker.mjs scans on-chain
   - Finds wallet 0xABC... with 75% win rate
   - Adds to whale_wallets table
   ↓
3. Cron triggers (every 5 min)
   ↓
4. Track whale's recent trades
   - Whale bought YES on "Fed cuts rates" at 0.60
   - Just 2 minutes ago
   ↓
5. Generate signal
   - type: 'whale_trade'
   - strength: 0.75 (their win rate)
   - market: 'fed-cuts-rates'
   ↓
6. Store in market_signals
   ↓
7. whale-copy strategy evaluates
   - High confidence (0.75)
   - Fresh trade (< 5 min)
   - Liquid market
   → DECISION: Copy trade
   ↓
8. Risk manager approves
   - Position size: 5% of capital
   ↓
9. Order router buys same position
   - Buy YES at current price (0.61)
   ↓
10. Market resolves YES
    - Whale profit: 40%
    - Our profit: 38.5% (bought 1¢ higher)
```

### Example 3: News-Driven Trade

```
1. Cron triggers (every 5 min)
   ↓
2. news-scraper.mjs fetches GDELT
   - Breaking: "Fed announces surprise rate cut"
   - Published: 30 seconds ago
   ↓
3. Analyze relevance
   - Theme: ECON_INFLATION
   - Tone: +8.5 (very positive)
   - Match market: "Fed cuts rates in Nov"
   ↓
4. Generate signal
   - type: 'breaking_news'
   - strength: 0.95 (high confidence)
   - freshness: 30 seconds
   ↓
5. news-driven strategy evaluates
   - Market price: 0.35 (market hasn't reacted yet!)
   - News strongly supports YES
   → DECISION: Buy YES immediately
   ↓
6. Risk manager approves
   - High risk strategy → 5% position
   ↓
7. Order router executes FAST
   - Buy YES at 0.35
   ↓
8. Market catches up (5-15 minutes)
   - Price rises to 0.90 as others read news
   ↓
9. Exit trade
   - Sell at 0.88 (slight slippage)
   - Profit: 0.88 - 0.35 = 151% ROI 🚀
```

---

## ⚙️ Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
# Risk Controls
MAX_POSITION_SIZE_PCT = "10"           # Max 10% per trade
MAX_PORTFOLIO_EXPOSURE_PCT = "30"      # Max 30% total
STOP_LOSS_PCT = "15"                   # Auto stop at -15%
STRATEGY_DAILY_STOP_PCT = "20"         # Disable at -20%
PORTFOLIO_CIRCUIT_BREAKER_PCT = "10"   # Emergency stop at -10%

# Signal Thresholds
MIN_SIGNAL_STRENGTH = "0.6"            # Ignore weak signals
MIN_ARBITRAGE_SPREAD_PCT = "3"         # Min 3% arb profit
MIN_WHALE_WIN_RATE = "0.65"            # Only copy 65%+ whales

# Execution
PAPER_TRADING_MODE = "true"            # Start in simulation
MAX_SLIPPAGE_PCT = "2"                 # Max 2% slippage
ORDER_TIMEOUT_SEC = "30"               # Cancel if not filled

# Cache TTLs (seconds)
MARKET_DATA_CACHE_TTL = "60"
WHALE_DATA_CACHE_TTL = "300"
SENTIMENT_CACHE_TTL = "300"
NEWS_CACHE_TTL = "600"
```

### Cron Schedules

```toml
# High frequency (every 1 min) - Time-sensitive
[triggers]
crons = ["* * * * *"]  # Arbitrage detection

# Medium frequency (every 5 min) - Signal aggregation
[triggers]  
crons = ["*/5 * * * *"]  # All signals

# Low frequency (every 6 hours) - Heavy operations
[triggers]
crons = ["0 */6 * * *"]  # Whale discovery

# Daily (at midnight UTC) - Reports
[triggers]
crons = ["0 0 * * *"]  # Performance reports
```

---

## 🔒 Security Architecture

### API Key Management
```
Cloudflare Secrets (encrypted)
  ├── TATUM_API_KEY (never logged)
  ├── POLYMARKET_PRIVATE_KEY (never logged)
  ├── TWITTER_BEARER_TOKEN (never logged)
  └── NEWS_API_KEY (never logged)
```

### Wallet Security
- Private keys stored in Cloudflare Secrets
- Never exposed in code or logs
- Hardware wallet for large amounts ($50k+)
- Multi-sig for enterprise ($100k+)

### API Rate Limiting
```javascript
const rateLimiter = {
  tatum: { limit: 5, per: 'second' },
  twitter: { limit: 450, per: '15min' },
  polymarket: { limit: 10, per: 'second' },
  kalshi: { limit: 100, per: 'minute' }
};
```

---

## 📊 Monitoring & Alerting

### System Health Metrics
- Signal detection latency < 30s
- Trade execution latency < 5s
- API success rate > 98%
- Database query time < 100ms
- Worker CPU time < 10ms

### Trading Metrics
- Win rate (target: >55%)
- Sharpe ratio (target: >1.5)
- Max drawdown (limit: <20%)
- Daily P&L
- Open positions count

### Alerts (Future)
- Email on circuit breaker trigger
- Slack on large losses (>$100)
- SMS on system errors
- Discord for performance milestones

---

## 🚀 Deployment Architecture

```
Developer Machine
    │
    ├─ git push
    │     ↓
    └─ wrangler deploy
          ↓
    ┌──────────────────┐
    │ Cloudflare Edge  │ (200+ locations worldwide)
    │                  │
    │ ┌──────────────┐ │
    │ │   Worker     │ │ ← Your code
    │ │   Runtime    │ │
    │ └──────────────┘ │
    │        │         │
    │   ┌────┴────┐    │
    │   ▼         ▼    │
    │ ┌────┐   ┌────┐ │
    │ │ D1 │   │ KV │ │
    │ └────┘   └────┘ │
    └──────────────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
Polymarket    Kalshi
```

**Benefits:**
- Global: <50ms latency worldwide
- Scalable: Auto-scales to millions of requests
- Reliable: 99.99%+ uptime SLA
- Cost: ~$5-50/month depending on usage

---

## 📈 Scaling Path

### Phase 1: MVP ($1k-$5k capital)
- Single worker deployment
- 2 strategies (arbitrage + whale)
- D1 database (<1GB)
- Manual monitoring

### Phase 2: Growth ($20k-$50k capital)
- Add Durable Objects for real-time
- 5+ strategies running
- PostgreSQL for analytics
- Automated alerting

### Phase 3: Scale ($100k+ capital)
- Multi-region deployment
- Dedicated VPS for HFT
- WebSocket market feeds
- Machine learning optimization

---

**Architecture Version:** 1.0  
**Last Updated:** 2026-11-07  
**Status:** Foundation complete, ready for deployment
