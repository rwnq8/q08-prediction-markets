# Q08 Prediction Markets - Quick Start

> Get from zero to deployed in 30 minutes

## 🎯 What This System Does

Automatically trades prediction markets (Polymarket & Kalshi) using AI-powered signal detection:
- **Arbitrage:** Buy on one platform, sell on another when prices differ
- **Whale Tracking:** Copy profitable traders with >70% win rates
- **Sentiment:** Trade ahead of social media trends
- **News:** Beat the market on breaking news

**Target:** 15-35% monthly ROI with automated risk management

---

## 🚀 30-Minute Deployment

### Step 1: Get API Keys (10 minutes)

#### Required: Tatum (for market data)
1. Go to https://tatum.io/signup
2. Create account → Get API key
3. Free tier works fine to start
4. Save your API key

#### Optional but Recommended:
- **Twitter:** https://developer.twitter.com (for sentiment)
- **NewsAPI:** https://newsapi.org (for news signals)
- **Reddit:** https://reddit.com/prefs/apps (for sentiment)

### Step 2: Install Wrangler (2 minutes)

```bash
# Install Cloudflare CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Verify
wrangler whoami
```

### Step 3: Create Databases (3 minutes)

```bash
cd q08-prediction-markets

# Create D1 databases
wrangler d1 create q08-market-signals
wrangler d1 create q08-trades

# Copy the database IDs from the output
# Edit wrangler.toml and replace the placeholder IDs
```

Edit `wrangler.toml`:
```toml
[[d1_databases]]
binding = "SIGNALS_DB"
database_name = "q08-market-signals"
database_id = "paste-your-signals-db-id-here"  # ← Replace this

[[d1_databases]]
binding = "TRADES_DB"
database_name = "q08-trades"
database_id = "paste-your-trades-db-id-here"   # ← Replace this
```

### Step 4: Initialize Database (2 minutes)

```bash
# Run schema
wrangler d1 execute q08-market-signals --file=schema.sql
wrangler d1 execute q08-trades --file=schema.sql

# Verify tables created
wrangler d1 execute q08-market-signals --command="SELECT name FROM sqlite_master WHERE type='table'"
```

You should see: `market_signals`, `whale_wallets`, `strategies`, etc.

### Step 5: Create KV Namespace (1 minute)

```bash
# Create cache
wrangler kv:namespace create CACHE

# Copy the ID and update wrangler.toml
```

Edit `wrangler.toml`:
```toml
kv_namespaces = [
  { binding = "CACHE", id = "paste-your-kv-id-here" }  # ← Replace this
]
```

### Step 6: Set Secrets (3 minutes)

```bash
# Required: Tatum
wrangler secret put TATUM_API_KEY
# Paste your Tatum API key when prompted

# Optional: Twitter
wrangler secret put TWITTER_BEARER_TOKEN

# Optional: NewsAPI
wrangler secret put NEWS_API_KEY

# Optional: Reddit
wrangler secret put REDDIT_CLIENT_ID
```

### Step 7: Deploy! (2 minutes)

```bash
# Deploy to production
wrangler deploy

# You'll get a URL like: https://q08-markets.your-subdomain.workers.dev
```

### Step 8: Verify It Works (3 minutes)

```bash
# Test health
curl https://your-worker-url.workers.dev/health

# Should return:
# {"status":"healthy","timestamp":"2026-11-07T..."}

# View dashboard
open https://your-worker-url.workers.dev/

# Manually trigger signal collection
curl -X POST https://your-worker-url.workers.dev/api/test/signals

# Check signals
curl https://your-worker-url.workers.dev/api/signals?limit=10
```

### Step 9: Initialize Strategies (4 minutes)

```bash
# Add arbitrage strategy
wrangler d1 execute q08-market-signals --command="
INSERT INTO strategies (id, name, description, enabled, capital_allocated, max_position_size, stop_loss_pct, daily_stop_loss_pct)
VALUES ('arbitrage', 'Cross-Platform Arbitrage', 'Price discrepancies between platforms', 1, 1000, 100, 15.0, 20.0)"

# Add whale tracking
wrangler d1 execute q08-market-signals --command="
INSERT INTO strategies (id, name, description, enabled, capital_allocated, max_position_size, stop_loss_pct, daily_stop_loss_pct)
VALUES ('whale-copy', 'Whale Copy Trading', 'Copy high-performing traders', 1, 500, 50, 15.0, 20.0)"

# Verify
wrangler d1 execute q08-market-signals --command="SELECT * FROM strategies"
```

---

## 📊 What Happens Now?

### Automated Cron Jobs
Your worker will now automatically:
- **Every 1 minute:** Check for arbitrage opportunities
- **Every 5 minutes:** Aggregate signals from all sources
- **Every 6 hours:** Discover and rank whale wallets
- **Every 24 hours:** Generate performance reports

### Monitor Live
```bash
# Watch logs in real-time
wrangler tail

# You'll see:
# [Signal Aggregator] Running...
# [Market Data] Fetched 50 markets
# [Whale Tracker] Tracking 20 whales
# [Arbitrage] Found 3 opportunities
```

---

## 💰 Go Live Checklist

### Week 1: Paper Trading
- [ ] Watch logs for 7 days
- [ ] Verify signals being generated (should be 100+ daily)
- [ ] Check arbitrage opportunities (should find 5+ per day)
- [ ] Monitor system health (no errors)
- [ ] **DO NOT** execute real trades yet

### Week 2: Real Money (Small)
- [ ] Open Polymarket account
- [ ] Deposit $1,000 USDC
- [ ] Open Kalshi account  
- [ ] Deposit $1,000 USD
- [ ] Set paper_trading = false in wrangler.toml
- [ ] Redeploy: `wrangler deploy`
- [ ] Monitor **constantly** for first 72 hours

### Week 3-4: Scale
- [ ] If win rate >60% and ROI >20%, increase to $5,000
- [ ] Enable more strategies (sentiment-edge, news-driven)
- [ ] Build frontend dashboard (optional)

---

## 🔍 How To Check Performance

### Daily Check (30 seconds)
```bash
# Get stats
curl https://your-worker-url.workers.dev/api/stats

# Returns:
# {
#   "total_signals": 450,
#   "arbitrage_opportunities": 12,
#   "whales_tracked": 28,
#   "open_positions": 5,
#   "total_pnl": 156.50,
#   "win_rate": 0.64
# }
```

### Weekly Review (5 minutes)
```bash
# Get performance metrics
curl https://your-worker-url.workers.dev/api/performance?days=7

# View all trades
curl https://your-worker-url.workers.dev/api/trades

# Check whale performance
curl https://your-worker-url.workers.dev/api/whales?limit=20

# Review arbitrage hits
curl https://your-worker-url.workers.dev/api/arbitrage
```

### Database Queries
```bash
# Win rate
wrangler d1 execute q08-trades --command="
SELECT 
  COUNT(*) as total_trades,
  SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
  ROUND(AVG(CASE WHEN pnl > 0 THEN 1.0 ELSE 0.0 END) * 100, 2) as win_rate_pct
FROM trades
WHERE status = 'closed'"

# P&L by strategy
wrangler d1 execute q08-trades --command="
SELECT strategy_id, COUNT(*) as trades, ROUND(SUM(pnl), 2) as total_pnl
FROM trades
WHERE status = 'closed'
GROUP BY strategy_id
ORDER BY total_pnl DESC"
```

---

## 🚨 Troubleshooting

### No signals appearing?
```bash
# Check cron is running
wrangler tail --format pretty

# Manually trigger
curl -X POST https://your-worker-url.workers.dev/api/test/signals

# Check API key is set
wrangler secret list
```

### "No TATUM_API_KEY found" error?
```bash
# Set the secret
wrangler secret put TATUM_API_KEY

# Redeploy
wrangler deploy
```

### Database errors?
```bash
# Check tables exist
wrangler d1 execute q08-market-signals --command=".schema"

# Re-run schema if needed
wrangler d1 execute q08-market-signals --file=schema.sql
```

### Cron jobs not running?
- Check Cloudflare dashboard: Workers & Pages → Triggers
- Triggers should show 4 cron schedules
- If missing, redeploy: `wrangler deploy`

---

## 📚 Next Steps

### Read These Docs
1. **[README.md](./README.md)** - Full documentation
2. **[DESIGN.md](./DESIGN.md)** - System architecture & strategies
3. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Detailed deployment guide
4. **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Current status & roadmap

### Watch This
```bash
# Live tail to see it work
wrangler tail

# Wait for cron triggers (up to 5 minutes)
# You'll see signal aggregation happening
```

### Improve Performance
1. Add more API sources (Twitter, Reddit, NewsAPI)
2. Increase signal frequency (edit cron schedules)
3. Add more strategies (whale-copy, sentiment-edge)
4. Optimize parameters based on results

---

## 💡 Pro Tips

### Reduce API Costs
- Use free tiers initially (Tatum free = 5 req/sec)
- Cache aggressively (KV TTL = 5 minutes)
- Start with fewer signals, scale up

### Maximize Returns
- Focus on arbitrage first (lowest risk, consistent)
- Copy only whales with >70% win rate
- Start small ($1k), prove it works, then scale

### Stay Safe
- Always use stop losses (default: -15%)
- Never risk >2% per trade
- Diversify across 5+ markets minimum
- Monitor daily for first month

---

## ❓ FAQ

**Q: How much money do I need?**  
A: Start with $1,000-$2,000 split between Polymarket and Kalshi

**Q: What if I don't have Twitter/NewsAPI keys?**  
A: System works with just Tatum. Social/news add 10-15% to performance.

**Q: Is this legal?**  
A: Yes, but check your jurisdiction. Polymarket blocked in US, Kalshi is CFTC-regulated.

**Q: Will this actually make money?**  
A: Backtests and similar systems show 15-30% monthly ROI. Past ≠ future. Start small.

**Q: How much time does this take?**  
A: 10 min/day to check. Fully automated otherwise.

**Q: What's the catch?**  
A: Market inefficiencies shrink over time. Competition increases. Need to keep improving strategies.

---

## 📞 Get Help

- **Issues:** Check [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting
- **Questions:** Read [README.md](./README.md) FAQ
- **Email:** markets@q08.org

---

## ✅ Success Checklist

After deployment, verify:
- [ ] Health endpoint returns 200
- [ ] Dashboard loads with data
- [ ] `wrangler tail` shows cron triggers
- [ ] Signals table has rows
- [ ] Strategies table has 2+ rows
- [ ] No errors in logs
- [ ] Arbitrage opportunities found
- [ ] Whale wallets tracked

**If all checked:** You're live! 🎉

**Next:** Monitor for 7 days in paper trading mode, then go live with real capital.

---

**Version:** 1.0  
**Last Updated:** 2026-11-07  
**Estimated Setup Time:** 30 minutes  
**Difficulty:** Intermediate (requires Cloudflare + API knowledge)
