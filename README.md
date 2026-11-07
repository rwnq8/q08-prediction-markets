# Q08 Prediction Markets Trading System

> Automated prediction market trading system extending Q08's signal detection capabilities to Polymarket and Kalshi

## 🎯 Overview

This system combines Q08's proven signal detection with cutting-edge prediction market trading strategies to create a profitable, scalable business. It aggregates signals from multiple sources (market data, social sentiment, news events, whale wallets) and executes automated trades based on detected inefficiencies.

**Target ROI:** 15-35% monthly with risk controls

## 🏗️ Architecture

```
Cloudflare Workers (Edge Computing)
├── Signal Aggregation (every 5 min)
│   ├── Market Data (Polymarket/Kalshi)
│   ├── Social Sentiment (Twitter/Reddit/Bluesky)
│   ├── News Events (GDELT/NewsAPI)
│   └── Whale Wallet Tracking
├── Strategy Engine
│   ├── Arbitrage Detection
│   ├── Sentiment-Driven Trading
│   ├── Whale Copy Trading
│   ├── News-Driven Edge
│   ├── AI Probability Edge
│   ├── Market Making
│   └── Mean Reversion
├── Execution Engine
│   ├── Order Routing
│   ├── Risk Management
│   └── Portfolio Tracking
└── Reporting
    ├── Performance Metrics
    ├── Real-time Dashboard
    └── API Endpoints
```

## 📊 Trading Strategies

### 1. Cross-Platform Arbitrage
- **Edge:** Price discrepancies between Polymarket and Kalshi
- **ROI:** 5-15% per trade
- **Risk:** Low (hedged)

### 2. Sentiment-Driven Edge
- **Edge:** Social sentiment leads price by 15-60 minutes
- **ROI:** 10-25% per trade
- **Risk:** Medium

### 3. Whale Tracking
- **Edge:** Copy profitable wallets (>70% win rate)
- **ROI:** 8-18% monthly
- **Risk:** Medium

### 4. News-Driven Mispricing
- **Edge:** Markets lag breaking news by 5-30 minutes
- **ROI:** 15-40% per trade
- **Risk:** High

### 5. AI Probability Edge
- **Edge:** Q08 forecasts vs market prices
- **ROI:** 12-20% per trade
- **Risk:** Medium

### 6. Market Making
- **Edge:** Capture bid-ask spread
- **ROI:** 5-10% monthly
- **Risk:** Low

### 7. Mean Reversion
- **Edge:** Markets overreact short-term
- **ROI:** 8-15% per trade
- **Risk:** Medium

## 🚀 Quick Start

### Prerequisites
- Cloudflare account with Workers, D1, and AI access
- API keys: Tatum (or direct Polymarket/Kalshi), Twitter, Reddit, NewsAPI
- Wallet for trading (Polymarket: crypto wallet, Kalshi: account)

### Setup

1. **Clone and navigate:**
```bash
cd q08-prediction-markets
```

2. **Install Wrangler CLI:**
```bash
npm install -g wrangler
```

3. **Create D1 databases:**
```bash
wrangler d1 create q08-market-signals
wrangler d1 create q08-trades
```

4. **Update `wrangler.toml` with database IDs**

5. **Run schema:**
```bash
wrangler d1 execute q08-market-signals --file=schema.sql
wrangler d1 execute q08-trades --file=schema.sql
```

6. **Create KV namespace:**
```bash
wrangler kv:namespace create CACHE
```

7. **Set secrets:**
```bash
wrangler secret put TATUM_API_KEY
wrangler secret put POLYMARKET_API_KEY
wrangler secret put POLYMARKET_PRIVATE_KEY
wrangler secret put TWITTER_BEARER_TOKEN
wrangler secret put REDDIT_CLIENT_ID
wrangler secret put NEWS_API_KEY
```

8. **Deploy:**
```bash
wrangler deploy
```

9. **Test:**
```bash
curl https://markets.q08.org/health
curl https://markets.q08.org/api/stats
```

## 📡 API Endpoints

### GET /health
System health check

### GET /api/stats
Dashboard statistics (open positions, P&L, etc.)

### GET /api/signals
Latest detected signals
- Query params: `?limit=50&source=polymarket`

### GET /api/trades
All trades
- `/api/trades/active` - Only open positions

### GET /api/strategies
All trading strategies with performance

### GET /api/performance
Performance metrics
- Query params: `?days=30`

### GET /api/whales
Top whale wallets being tracked

### GET /api/arbitrage
Current arbitrage opportunities

## 🗃️ Database Schema

### market_signals
Detected trading signals from all sources

### whale_wallets
Tracked high-performance traders

### whale_trades
Historical whale trades

### strategies
Trading strategy configurations

### trades
Executed trades

### performance_metrics
Daily performance tracking

### sentiment_cache
Cached social sentiment data

### arbitrage_opportunities
Detected cross-platform arbitrage

## 🎛️ Configuration

### Environment Variables
```toml
MAX_POSITION_SIZE_PCT = "10"      # Max 10% per trade
MAX_PORTFOLIO_EXPOSURE_PCT = "30" # Max 30% total exposure
STOP_LOSS_PCT = "15"              # Auto stop-loss at -15%
MIN_ARBITRAGE_SPREAD_PCT = "3"    # Min 3% spread for arb
MIN_SIGNAL_STRENGTH = "0.6"       # Min signal confidence
```

### Strategy Configuration
Edit strategies in D1:
```sql
UPDATE strategies 
SET enabled = 1, capital_allocated = 5000 
WHERE id = 'arbitrage';
```

## 📈 Risk Management

### Position Sizing
- Kelly Criterion for optimal sizing
- Max 10% capital per trade
- Max 30% total exposure
- Min 5+ market diversification

### Stop Losses
- -15% per position (automatic)
- -20% daily strategy stop
- -10% portfolio circuit breaker

### Capital Protection
- Start: $1,000-$5,000 test capital
- Scale: $20,000-$50,000 after 30-day profit
- Never risk >2% on single trade

## 🎯 Monetization

### Phase 1: Proprietary Trading (Months 1-3)
- Trade own capital
- Build track record
- Target: 15-25% monthly ROI

### Phase 2: Marketing (Months 3-6)
- Public performance dashboard
- Social media presence
- Educational content
- Goal: 10,000+ followers

### Phase 3: Subscriptions (Months 6+)
- Premium: $99/mo (signals + alerts)
- Pro: $299/mo (API access)
- Enterprise: $999/mo (full access)

### Phase 4: Managed Service (Year 2)
- 2-and-20 fee structure
- $50k minimum
- Quarterly redemptions

## 🔧 Development

### Project Structure
```
q08-prediction-markets/
├── worker.js                  # Main entry point
├── wrangler.toml             # Cloudflare config
├── schema.sql                # Database schema
├── signal-aggregator/        # Signal detection
│   ├── index.mjs
│   ├── market-data.mjs
│   ├── social-sentiment.mjs
│   ├── news-scraper.mjs
│   └── whale-tracker.mjs
├── strategy-engine/          # Trading strategies
│   ├── arbitrage.mjs
│   ├── sentiment-edge.mjs
│   ├── whale-copy.mjs
│   ├── news-driven.mjs
│   ├── ai-edge.mjs
│   ├── market-making.mjs
│   └── mean-reversion.mjs
├── execution/                # Trade execution
│   ├── order-router.mjs
│   ├── risk-manager.mjs
│   └── portfolio.mjs
└── reporting/                # Performance tracking
    └── performance.mjs
```

### Local Development
```bash
wrangler dev
```

### Testing
```bash
# Test signal aggregation
curl -X POST http://localhost:8787/api/test/signals

# Test arbitrage detection
curl -X POST http://localhost:8787/api/test/arbitrage

# View dashboard
open http://localhost:8787/
```

## 📊 Monitoring

### System Health
- Signal detection latency < 30s
- Trade execution < 5s
- Uptime > 99.5%
- API success rate > 98%

### Trading Metrics
- Win rate > 55%
- Monthly ROI > 15%
- Sharpe ratio > 1.5
- Max drawdown < 20%

### Logs
```bash
wrangler tail
```

## 🔐 Security

### API Keys
- Store in Cloudflare Secrets (never in code)
- Rotate quarterly
- Use separate test/prod keys

### Wallet Security
- Hardware wallet for large amounts
- Multi-sig for $50k+
- Never store private keys in code

### Access Control
- Admin API requires authentication
- Read-only public endpoints
- Rate limiting on all APIs

## 📚 Resources

### APIs
- [Tatum Prediction Markets](https://tatum.io/prediction-markets-api)
- [Polymarket CLOB API](https://docs.polymarket.com)
- [Kalshi API](https://trading-api.readme.io/reference)
- [Twitter API v2](https://developer.twitter.com/en/docs/twitter-api)
- [GDELT Project](https://www.gdeltproject.org/)

### Documentation
- [Design Document](./DESIGN.md)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)

## 🤝 Contributing

This is a proprietary trading system. Contact the Q08 team for collaboration opportunities.

## ⚖️ Legal

### Disclaimers
- **Not financial advice**
- **Trading involves substantial risk**
- **Past performance ≠ future results**
- Comply with local regulations
- Check API terms of service

### Compliance
- Polymarket: Crypto regulation applies
- Kalshi: CFTC regulated
- Geographic restrictions apply
- Tax reporting required

## 📞 Support

- Issues: Create GitHub issue
- Email: markets@q08.org
- Dashboard: https://markets.q08.org
- Status: https://status.q08.org

---

**Q08 Prediction Markets v1.0**  
Built with Cloudflare Workers | Powered by Q08 Signal Engine

*Last updated: 2026-11-07*
