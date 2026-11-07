# Deployment Guide

## 🚀 Production Deployment Checklist

### Phase 1: Infrastructure Setup (Day 1)

#### 1. Cloudflare Account Setup
```bash
# Login to Cloudflare
wrangler login

# Verify account
wrangler whoami
```

#### 2. Create D1 Databases
```bash
# Create signals database
wrangler d1 create q08-market-signals

# Create trades database  
wrangler d1 create q08-trades

# Note the database IDs from output
```

#### 3. Update wrangler.toml
Replace the placeholder database IDs with actual IDs:
```toml
[[d1_databases]]
binding = "SIGNALS_DB"
database_name = "q08-market-signals"
database_id = "<YOUR_SIGNALS_DB_ID>"

[[d1_databases]]
binding = "TRADES_DB"
database_name = "q08-trades"
database_id = "<YOUR_TRADES_DB_ID>"
```

#### 4. Initialize Database Schemas
```bash
# Run schema on signals database
wrangler d1 execute q08-market-signals --file=schema.sql

# Run schema on trades database
wrangler d1 execute q08-trades --file=schema.sql

# Verify tables were created
wrangler d1 execute q08-market-signals --command="SELECT name FROM sqlite_master WHERE type='table'"
```

#### 5. Create KV Namespace
```bash
# Create production KV
wrangler kv:namespace create CACHE

# Update wrangler.toml with the ID
kv_namespaces = [
  { binding = "CACHE", id = "<YOUR_KV_ID>" }
]
```

### Phase 2: API Keys & Secrets (Day 1)

#### Required API Keys

1. **Tatum API** (Unified Polymarket/Kalshi access)
   - Sign up: https://tatum.io
   - Get API key from dashboard
   - Free tier: 5 requests/second
   - Paid tier ($79/mo): 25 requests/second

2. **Twitter/X API**
   - Apply at: https://developer.twitter.com
   - Get Bearer Token
   - Essential tier: Free (50 tweets/month)
   - Elevated tier: $200/mo (10k tweets/month)

3. **Reddit API**
   - Create app: https://www.reddit.com/prefs/apps
   - Get client ID and secret
   - Free tier: 60 requests/minute

4. **NewsAPI**
   - Sign up: https://newsapi.org
   - Free tier: 100 requests/day
   - Business tier ($449/mo): Unlimited

5. **Polymarket Direct** (Optional if using Tatum)
   - Sign up: https://polymarket.com
   - Generate API key in settings
   - Need crypto wallet with USDC

6. **Kalshi** (Optional if using Tatum)
   - Sign up: https://kalshi.com
   - Get API credentials from dashboard
   - $2 minimum deposit

#### Set Secrets in Cloudflare
```bash
# Tatum (required)
wrangler secret put TATUM_API_KEY
# Paste your key when prompted

# Twitter (recommended)
wrangler secret put TWITTER_BEARER_TOKEN

# Reddit (recommended)
wrangler secret put REDDIT_CLIENT_ID
wrangler secret put REDDIT_CLIENT_SECRET

# NewsAPI (recommended)
wrangler secret put NEWS_API_KEY

# Polymarket Direct (optional)
wrangler secret put POLYMARKET_API_KEY
wrangler secret put POLYMARKET_PRIVATE_KEY

# Kalshi (optional)
wrangler secret put KALSHI_API_KEY
wrangler secret put KALSHI_API_SECRET

# Verify secrets were set
wrangler secret list
```

### Phase 3: Initial Deployment (Day 1)

#### 1. Deploy Worker
```bash
# Deploy to production
wrangler deploy

# Check deployment
wrangler deployments list

# Get worker URL (should be like: q08-markets.your-subdomain.workers.dev)
```

#### 2. Verify Deployment
```bash
# Test health endpoint
curl https://q08-markets.your-subdomain.workers.dev/health

# Expected response:
# {"status":"healthy","timestamp":"2026-11-07T..."}

# Test stats endpoint
curl https://q08-markets.your-subdomain.workers.dev/api/stats

# Check dashboard
open https://q08-markets.your-subdomain.workers.dev/
```

#### 3. Initialize Strategy Configuration
```bash
# Add arbitrage strategy
wrangler d1 execute q08-market-signals --command="
INSERT INTO strategies (id, name, description, enabled, capital_allocated, max_position_size, stop_loss_pct, daily_stop_loss_pct)
VALUES (
  'arbitrage',
  'Cross-Platform Arbitrage',
  'Exploits price discrepancies between Polymarket and Kalshi',
  1,
  2000,
  200,
  15.0,
  20.0
)"

# Add whale tracking strategy
wrangler d1 execute q08-market-signals --command="
INSERT INTO strategies (id, name, description, enabled, capital_allocated, max_position_size, stop_loss_pct, daily_stop_loss_pct)
VALUES (
  'whale-copy',
  'Whale Copy Trading',
  'Copies trades from high-performing wallets',
  1,
  1500,
  150,
  15.0,
  20.0
)"

# Verify strategies
wrangler d1 execute q08-market-signals --command="SELECT * FROM strategies"
```

### Phase 4: Testing Period (Days 2-7)

#### 1. Monitor Cron Jobs
```bash
# Watch live logs
wrangler tail

# You should see cron triggers:
# - Every 1 min: Arbitrage detection
# - Every 5 min: Signal aggregation
# - Every 6 hours: Whale discovery
# - Daily: Performance reports
```

#### 2. Manual Signal Test
```bash
# Trigger signal aggregation manually
curl -X POST https://q08-markets.your-subdomain.workers.dev/api/test/signals

# Check signals were created
curl https://q08-markets.your-subdomain.workers.dev/api/signals?limit=10
```

#### 3. Check Data Quality
```bash
# View signal distribution
wrangler d1 execute q08-market-signals --command="
SELECT source, signal_type, COUNT(*) as count, AVG(signal_strength) as avg_strength
FROM market_signals
WHERE detected_at > datetime('now', '-24 hours')
GROUP BY source, signal_type
ORDER BY count DESC"

# Check for arbitrage opportunities
curl https://q08-markets.your-subdomain.workers.dev/api/arbitrage

# Monitor whale tracking
curl https://q08-markets.your-subdomain.workers.dev/api/whales?limit=20
```

#### 4. Paper Trading Mode
Before risking real capital, run in paper trading mode for 7 days:
- Signals are detected normally
- Trades are logged but NOT executed
- Track performance as if trades were real
- Target: >60% win rate, >20% monthly ROI

### Phase 5: Live Trading (Week 2+)

#### 1. Fund Trading Accounts
```bash
# Polymarket: Deposit USDC to your wallet
# Recommended starting capital: $1,000 - $2,000

# Kalshi: Deposit USD via ACH
# Minimum: $100
```

#### 2. Enable Live Trading
Update `wrangler.toml`:
```toml
[vars]
PAPER_TRADING_MODE = "false"
MAX_POSITION_SIZE_PCT = "10"
MAX_PORTFOLIO_EXPOSURE_PCT = "30"
STOP_LOSS_PCT = "15"
```

Redeploy:
```bash
wrangler deploy
```

#### 3. Monitor Performance Daily
```bash
# Check P&L
curl https://q08-markets.your-subdomain.workers.dev/api/performance?days=7

# View active positions
curl https://q08-markets.your-subdomain.workers.dev/api/trades/active

# Get win rate
wrangler d1 execute q08-trades --command="
SELECT 
  COUNT(*) as total_trades,
  SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
  ROUND(AVG(CASE WHEN pnl > 0 THEN 1.0 ELSE 0.0 END) * 100, 2) as win_rate_pct,
  ROUND(SUM(pnl), 2) as total_pnl
FROM trades
WHERE status = 'closed'"
```

### Phase 6: Custom Domain & Frontend (Week 3)

#### 1. Add Custom Domain
```bash
# In Cloudflare dashboard:
# Workers & Pages > q08-markets > Settings > Domains
# Add: markets.q08.org

# Or via CLI:
wrangler publish --name q08-markets --routes markets.q08.org
```

#### 2. Deploy Frontend
The frontend would be a separate Next.js app:
```bash
# Create frontend directory
mkdir q08-markets-frontend
cd q08-markets-frontend
npx create-next-app@latest . --typescript --tailwind --app

# Deploy to Cloudflare Pages
wrangler pages create q08-markets-dashboard
wrangler pages deploy
```

### Phase 7: Scaling (Month 2+)

#### 1. Increase Capital
Based on 30-day performance:
- If ROI > 20% and win rate > 60%: Scale to $5k-$10k
- If ROI > 25% and win rate > 65%: Scale to $20k-$50k
- If ROI > 30% and win rate > 70%: Scale to $100k+

#### 2. Add More Strategies
```bash
# Enable sentiment-driven strategy
wrangler d1 execute q08-market-signals --command="
INSERT INTO strategies (id, name, description, enabled, capital_allocated, max_position_size)
VALUES ('sentiment-edge', 'Sentiment-Driven Edge', 'Trades based on social sentiment', 1, 3000, 300)"

# Enable news-driven strategy  
wrangler d1 execute q08-market-signals --command="
INSERT INTO strategies (id, name, description, enabled, capital_allocated, max_position_size)
VALUES ('news-driven', 'News-Driven Mispricing', 'Exploits market lag on breaking news', 1, 5000, 500)"
```

#### 3. Upgrade API Tiers
- Tatum: $79/mo → $299/mo (100 req/sec)
- Twitter: Free → $200/mo (10k tweets/month)
- NewsAPI: Free → $449/mo (Unlimited)

## 🔧 Maintenance

### Daily Tasks
- Check P&L and win rate
- Review active positions
- Monitor system health logs
- Verify cron jobs running

### Weekly Tasks
- Review strategy performance
- Adjust capital allocation
- Update market watchlists
- Analyze losing trades

### Monthly Tasks
- Rotate API keys
- Backup database
- Performance review
- Strategy optimization

## 📊 Success Metrics

### Week 1 (Paper Trading)
- ✅ 100+ signals detected daily
- ✅ 5+ arbitrage opportunities found
- ✅ 10+ whale wallets tracked
- ✅ All cron jobs running

### Week 2 (Live Trading - $1k capital)
- ✅ >55% win rate
- ✅ >15% weekly ROI
- ✅ <10% max drawdown
- ✅ Zero liquidations

### Month 1 (Scaling - $5k capital)
- ✅ >60% win rate
- ✅ >20% monthly ROI
- ✅ Sharpe ratio >1.5
- ✅ <15% max drawdown

### Month 3 (Production - $20k capital)
- ✅ >65% win rate
- ✅ >25% monthly ROI
- ✅ Sharpe ratio >2.0
- ✅ <20% max drawdown
- ✅ Public dashboard live

## 🚨 Troubleshooting

### No signals being generated
```bash
# Check cron trigger
wrangler tail --format pretty

# Manually trigger
curl -X POST https://your-worker.dev/api/test/signals

# Check API keys
wrangler secret list
```

### Database errors
```bash
# Check table schema
wrangler d1 execute q08-market-signals --command=".schema"

# Re-run schema if needed
wrangler d1 execute q08-market-signals --file=schema.sql
```

### High API costs
- Cache API responses more aggressively
- Reduce cron frequency
- Filter low-quality signals earlier

## 📞 Support

- GitHub Issues: Create issue in repo
- Email: markets@q08.org
- Cloudflare Support: https://dash.cloudflare.com/support

---

**Next Steps:** Deploy and run in paper trading mode for 7 days before going live.
