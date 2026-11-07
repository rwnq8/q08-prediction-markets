# Q08 Prediction Markets - Quick Reference Card

## 🌐 Your URLs
- **Main:** https://q08-prediction-markets.q08.workers.dev
- **Dashboard:** https://q08-prediction-markets.q08.workers.dev/dashboard
- **Production:** https://markets.q08.org *(DNS may take 5 min)*

## 📊 API Quick Hits
```bash
# Health check
curl https://q08-prediction-markets.q08.workers.dev/health

# Latest signals
curl https://q08-prediction-markets.q08.workers.dev/api/signals?limit=10

# System stats
curl https://q08-prediction-markets.q08.workers.dev/api/stats

# Arbitrage opportunities
curl https://q08-prediction-markets.q08.workers.dev/api/arbitrage

# Top whales
curl https://q08-prediction-markets.q08.workers.dev/api/whales
```

## 🔧 Management Commands
```bash
# Live logs
cd C:\Users\LENOVO\.copilot\chats\2026-11-07\potential-fiesta-be4f431b\q08-prediction-markets
wrangler tail

# Deployment info
wrangler deployments list

# Check secrets
wrangler secret list

# Update secret
wrangler secret put SECRET_NAME

# Redeploy
wrangler deploy
```

## ⏱️ Cron Schedule
- **Every 1 min:** Arbitrage detection
- **Every 5 min:** Signal aggregation  
- **Every 6 hours:** Whale discovery
- **Daily midnight UTC:** Performance report

## 🔐 Current Configuration
- **Mode:** Paper Trading (NO real money)
- **API Key:** Demo mode (testing)
- **Risk Limits:** 10% max position, 30% exposure, 15% stop loss
- **Environment:** Development

## ⚡ Expected Timeline
| Time | What Happens |
|------|--------------|
| 1 min | First arbitrage scan runs |
| 5 min | First signals collected |
| 10 min | ~50+ signals in database |
| 1 hour | ~12 signal cycles, ~60 arbitrage scans |
| 6 hours | First whale discovery |
| 1 day | ~100+ signals collected |
| 7 days | Validation period complete |

## 📈 Success Metrics (7-Day Validation)
- [ ] >100 signals per day average
- [ ] >5 arbitrage opportunities per day
- [ ] >20 whale wallets tracked
- [ ] No errors or crashes
- [ ] Manually verified 10 arbitrage ops are real

## 🚀 Upgrade Path

### Step 1: Real Data (Upgrade from demo)
```bash
# Get Tatum free API key: https://dashboard.tatum.io/sign-up
wrangler secret put TATUM_API_KEY
wrangler deploy
```

### Step 2: Live Trading (After 7-day validation)
1. Implement execution layer (`execution/order-router.mjs`)
2. Get Polymarket API key
3. Get Kalshi API key  
4. Disable paper trading in `wrangler.toml`
5. Start with $1k-$2k capital

## 📁 Project Structure
```
q08-prediction-markets/
├── worker.js                    # Main entry point
├── wrangler.toml                # Configuration
├── schema.sql                   # Database schema
├── signal-aggregator/           # Signal detection
│   ├── index.mjs
│   ├── market-data.mjs
│   ├── whale-tracker.mjs
│   ├── social-sentiment.mjs
│   └── news-scraper.mjs
├── strategy-engine/             # Trading strategies
│   └── arbitrage.mjs
└── execution/                   # TODO: Order execution
    ├── order-router.mjs         # Not implemented
    ├── risk-manager.mjs         # Not implemented
    └── portfolio.mjs            # Not implemented
```

## 🆘 Quick Troubleshooting

**No signals after 10 min?**
```bash
wrangler tail  # Check for errors
curl https://q08-prediction-markets.q08.workers.dev/api/test/signals
```

**Want real Tatum data?**
```bash
wrangler secret put TATUM_API_KEY  # Get key from tatum.io
wrangler deploy
```

**Check database has data?**
```bash
wrangler d1 execute q08-market-signals --command="SELECT COUNT(*) FROM market_signals"
```

## 📚 Documentation Files
- `STATUS.txt` - ASCII art status (this!)
- `AUTOMATED_SETUP_COMPLETE.md` - Full setup details
- `DEPLOYMENT_SUCCESS.md` - Deployment guide
- `README.md` - Complete API reference
- `QUICKSTART.md` - Setup walkthrough
- `ARCHITECTURE.md` - Technical design
- `BUSINESS_PLAN.md` - Revenue model

## ⚠️ Safety Reminders
✅ **Paper trading ON** - No real trades executed  
✅ **Demo API key** - Testing mode only  
✅ **No exchange connections** - Signals only  
❌ **Execution layer missing** - Can't trade yet  

## 🎯 Your Next Action
**Wait 5 minutes, then check:**
```bash
curl https://q08-prediction-markets.q08.workers.dev/api/signals
```

You should see signal data! 🎉

---
*Q08 Prediction Markets v1.0 - November 2026*
