# Q08 Prediction Markets - Automated Setup Script
# This script automates the final setup steps

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║   Q08 PREDICTION MARKETS - AUTOMATED SETUP               ║
║   Automated Trading System for Polymarket & Kalshi       ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Step 1: Get Tatum API Key
Write-Host "`n[1/4] Setting up Tatum API Key..." -ForegroundColor Yellow
Write-Host "Opening Tatum registration in browser..." -ForegroundColor Gray

# Open Tatum dashboard
Start-Process "https://dashboard.tatum.io/sign-up"

Write-Host @"

📋 INSTRUCTIONS:
1. Sign up for FREE Tatum account (opens in browser)
2. Verify your email
3. Go to Dashboard > API Keys
4. Copy your Mainnet API key
5. Paste it below when prompted

Press Enter when you have your API key ready...
"@ -ForegroundColor Cyan

Read-Host

# Prompt for API key
Write-Host "Enter your Tatum API key: " -ForegroundColor Yellow -NoNewline
$tatumKey = Read-Host -AsSecureString
$tatumKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($tatumKey)
)

if ([string]::IsNullOrWhiteSpace($tatumKeyPlain)) {
    Write-Host "❌ Error: API key cannot be empty" -ForegroundColor Red
    exit 1
}

# Set the secret
Write-Host "Setting Tatum API key as Cloudflare secret..." -ForegroundColor Gray
$tatumKeyPlain | wrangler secret put TATUM_API_KEY

Write-Host "✅ Tatum API key configured!" -ForegroundColor Green

# Step 2: Optional API Keys
Write-Host "`n[2/4] Optional API Keys (Press Enter to skip)" -ForegroundColor Yellow

Write-Host "`nTwitter Bearer Token (for sentiment analysis): " -ForegroundColor Gray -NoNewline
$twitterKey = Read-Host
if (-not [string]::IsNullOrWhiteSpace($twitterKey)) {
    $twitterKey | wrangler secret put TWITTER_BEARER_TOKEN
    Write-Host "✅ Twitter API configured!" -ForegroundColor Green
} else {
    Write-Host "⏭️  Skipped Twitter API" -ForegroundColor Yellow
}

Write-Host "`nNewsAPI Key (for news events): " -ForegroundColor Gray -NoNewline
$newsKey = Read-Host
if (-not [string]::IsNullOrWhiteSpace($newsKey)) {
    $newsKey | wrangler secret put NEWS_API_KEY
    Write-Host "✅ NewsAPI configured!" -ForegroundColor Green
} else {
    Write-Host "⏭️  Skipped NewsAPI" -ForegroundColor Yellow
}

# Step 3: Deploy with secrets
Write-Host "`n[3/4] Deploying worker with secrets..." -ForegroundColor Yellow
wrangler deploy

# Step 4: Test endpoints
Write-Host "`n[4/4] Testing deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "`nTesting health endpoint..." -ForegroundColor Gray
$health = curl -s https://q08-prediction-markets.q08.workers.dev/health | ConvertFrom-Json
if ($health.status -eq "ok") {
    Write-Host "✅ Health check passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Health check returned unexpected result" -ForegroundColor Yellow
}

Write-Host "`nTesting stats endpoint..." -ForegroundColor Gray
$stats = curl -s https://q08-prediction-markets.q08.workers.dev/api/stats | ConvertFrom-Json
Write-Host "  Open positions: $($stats.open_positions)" -ForegroundColor Gray
Write-Host "  Total trades: $($stats.total_trades)" -ForegroundColor Gray

# Step 5: Start monitoring
Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║                  ✅ SETUP COMPLETE!                       ║
╚═══════════════════════════════════════════════════════════╝

🎉 Your Q08 Prediction Markets system is now LIVE!

📡 ENDPOINTS:
   Main: https://q08-prediction-markets.q08.workers.dev
   Prod: https://markets.q08.org (if custom domain configured)

🔄 CRON JOBS RUNNING:
   ⏱️  Every 1 min:  Arbitrage detection
   ⏱️  Every 5 min:  Signal aggregation
   ⏱️  Every 6 hours: Whale discovery
   ⏱️  Daily:         Performance reports

📊 MONITOR YOUR SYSTEM:
   wrangler tail              # Live logs
   wrangler deployments list  # Deployment history

🧪 PAPER TRADING MODE: ENABLED
   ⚠️  No real money at risk yet
   ⚠️  Validate for 7 days before going live

📈 CHECK SIGNALS:
   curl https://q08-prediction-markets.q08.workers.dev/api/signals
   
   Within 5 minutes you should see signals appearing!

📚 DOCUMENTATION:
   - DEPLOYMENT_SUCCESS.md  (Next steps)
   - README.md              (API reference)
   - QUICKSTART.md          (Setup guide)
   - ARCHITECTURE.md        (Technical details)

"@ -ForegroundColor Cyan

Write-Host "Would you like to start live log monitoring now? (Y/N): " -ForegroundColor Yellow -NoNewline
$monitor = Read-Host

if ($monitor -eq "Y" -or $monitor -eq "y") {
    Write-Host "`nStarting live logs (Ctrl+C to exit)...`n" -ForegroundColor Green
    wrangler tail
} else {
    Write-Host @"

To monitor later:
  wrangler tail

To check signals:
  curl https://q08-prediction-markets.q08.workers.dev/api/signals

"@ -ForegroundColor Gray
}
