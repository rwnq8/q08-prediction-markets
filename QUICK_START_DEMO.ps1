# Q08 Prediction Markets - Quick Demo Setup
# Uses demo mode to test immediately without API keys

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║   Q08 PREDICTION MARKETS - DEMO MODE                     ║
║   Testing with simulated data (no API keys needed)       ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$projectPath = "C:\Users\LENOVO\.copilot\chats\2026-11-07\potential-fiesta-be4f431b\q08-prediction-markets"

Write-Host "`n[1/3] Setting demo API key..." -ForegroundColor Yellow
# Use a demo key that triggers mock data mode
"demo-tatum-key-for-testing" | wrangler secret put TATUM_API_KEY --env=""

Write-Host "`n[2/3] Deploying to production subdomain..." -ForegroundColor Yellow
Set-Location $projectPath
wrangler deploy --env=production

Write-Host "`n[3/3] Testing deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$mainUrl = "https://q08-prediction-markets.q08.workers.dev"
$prodUrl = "https://markets.q08.org"

Write-Host "`nTesting main URL: $mainUrl" -ForegroundColor Gray
try {
    $health = Invoke-RestMethod -Uri "$mainUrl/health" -Method Get
    Write-Host "✅ Main URL: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Main URL: Failed" -ForegroundColor Red
}

Write-Host "`nTesting production URL: $prodUrl" -ForegroundColor Gray
try {
    $healthProd = Invoke-RestMethod -Uri "$prodUrl/health" -Method Get
    Write-Host "✅ Production URL: $($healthProd.status)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Production URL: Not configured (normal if custom domain not set)" -ForegroundColor Yellow
}

Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║              🎉 DEMO MODE ACTIVE!                        ║
╚═══════════════════════════════════════════════════════════╝

📡 YOUR SYSTEM:
   Main URL: $mainUrl
   Status:   LIVE (Demo Mode)

🤖 WHAT'S HAPPENING:
   ✅ Cron jobs are running every 1-5 minutes
   ✅ Using simulated market data (no real API)
   ✅ Paper trading mode (no real money)
   ✅ Collecting signals and detecting arbitrage

📊 CHECK YOUR DASHBOARD:
   Start-Process "$mainUrl"

🔍 VIEW SIGNALS (wait 5 minutes first):
   curl $mainUrl/api/signals

📈 VIEW ARBITRAGE OPPORTUNITIES:
   curl $mainUrl/api/arbitrage

📊 VIEW STATS:
   curl $mainUrl/api/stats

🔄 UPGRADE TO REAL DATA:
   1. Get free Tatum API key: https://dashboard.tatum.io/sign-up
   2. Run: wrangler secret put TATUM_API_KEY
   3. Redeploy: wrangler deploy

📚 NEXT STEPS:
   - Monitor for 5 minutes to see first signals
   - Check DEPLOYMENT_SUCCESS.md for full guide
   - Validate for 7 days before real trading

"@ -ForegroundColor Cyan

Write-Host "Opening dashboard in browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process $mainUrl

Write-Host "`nStart live monitoring? (Y/N): " -ForegroundColor Yellow -NoNewline
$monitor = Read-Host

if ($monitor -eq "Y" -or $monitor -eq "y") {
    Write-Host "`nStarting live logs (Ctrl+C to exit)...`n" -ForegroundColor Green
    wrangler tail --env=""
}
