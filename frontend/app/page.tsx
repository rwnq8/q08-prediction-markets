"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Target, Zap, Users } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://q08-prediction-markets.q08.workers.dev";

interface Stats {
  open_positions: number;
  total_trades: number;
  total_pnl: number;
  today_pnl: number;
  today_trades: number;
  active_strategies: number;
  timestamp: string;
}

interface Signal {
  id: string;
  source: string;
  signal_type: string;
  market_slug: string;
  market_title?: string;
  signal_strength: number;
  detected_at: string;
  metadata?: Record<string, unknown>;
}

interface Trade {
  id: string;
  strategy_id: string;
  strategy_name?: string;
  platform: string;
  market_slug: string;
  market_title?: string;
  side: string;
  entry_price: number;
  amount: number;
  pnl: number;
  status: string;
  opened_at: string;
}

interface Whale {
  address: string;
  platform: string;
  total_volume: number;
  win_rate: number;
  performance_score: number;
  tracked_since: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [whales, setWhales] = useState<Whale[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, signalsRes, tradesRes, whalesRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats`),
          fetch(`${API_BASE}/api/signals?limit=50`),
          fetch(`${API_BASE}/api/trades/active`),
          fetch(`${API_BASE}/api/whales`)
        ]);

        const [statsData, signalsData, tradesData, whalesData] = await Promise.all([
          statsRes.json(),
          signalsRes.json(),
          tradesRes.json(),
          whalesRes.json()
        ]);

        setStats(statsData);
        setSignals(signalsData.signals || []);
        setTrades(tradesData.trades || []);
        setWhales(whalesData.whales || []);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    }

    void loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Q08 Prediction Markets
              </h1>
              <p className="text-gray-400 text-lg">Autonomous AI-Powered Trading System</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Open Positions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-white">{stats?.open_positions ?? '-'}</span>
                <Target className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total Trades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-white">{stats?.total_trades ?? '-'}</span>
                <Activity className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total P&L</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold ${(stats?.total_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(stats?.total_pnl ?? 0).toFixed(2)}
                </span>
                {(stats?.total_pnl ?? 0) >= 0 ? (
                  <TrendingUp className="w-8 h-8 text-green-400" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Today P&L</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold ${(stats?.today_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(stats?.today_pnl ?? 0).toFixed(2)}
                </span>
                <Zap className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Today Trades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-white">{stats?.today_trades ?? '-'}</span>
                <Activity className="w-8 h-8 text-pink-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Active Strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-white">{stats?.active_strategies ?? '-'}</span>
                <Users className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="signals" className="space-y-6">
          <TabsList className="bg-gray-900/50 border border-gray-800">
            <TabsTrigger value="signals">Live Signals</TabsTrigger>
            <TabsTrigger value="positions">Active Positions</TabsTrigger>
            <TabsTrigger value="whales">Whale Tracker</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Signals Tab */}
          <TabsContent value="signals" className="space-y-4">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Real-Time Signal Feed</CardTitle>
                <CardDescription>Multi-source market signals and opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {signals.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No signals detected yet. Check back in 5 minutes.</p>
                  ) : (
                    signals.map((signal) => (
                      <div key={signal.id} className="flex items-start justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                              {signal.signal_type}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                              {signal.source}
                            </Badge>
                          </div>
                          <p className="text-white font-medium mb-1">{signal.market_title || signal.market_slug}</p>
                          <p className="text-sm text-gray-400">Strength: {(signal.signal_strength * 100).toFixed(0)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{new Date(signal.detected_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-4">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Active Positions</CardTitle>
                <CardDescription>Currently open trades across all strategies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trades.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No active positions. Paper trading mode enabled.</p>
                  ) : (
                    trades.map((trade) => (
                      <div key={trade.id} className="flex items-start justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={trade.side === 'yes' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}>
                              {trade.side.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">
                              {trade.platform}
                            </Badge>
                          </div>
                          <p className="text-white font-medium mb-1">{trade.market_title || trade.market_slug}</p>
                          <p className="text-sm text-gray-400">
                            Entry: ${trade.entry_price.toFixed(2)} | Size: ${trade.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Strategy: {trade.strategy_name || trade.strategy_id}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(trade.opened_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Whales Tab */}
          <TabsContent value="whales" className="space-y-4">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Top Performing Whales</CardTitle>
                <CardDescription>High-volume traders with proven track records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {whales.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Whale discovery runs every 6 hours. Check back soon.</p>
                  ) : (
                    whales.slice(0, 20).map((whale, idx) => (
                      <div key={whale.address} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-gray-600">#{idx + 1}</div>
                          <div>
                            <p className="text-white font-mono text-sm">{whale.address.slice(0, 12)}...{whale.address.slice(-8)}</p>
                            <p className="text-xs text-gray-400 mt-1">{whale.platform}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Volume</p>
                            <p className="text-white font-semibold">${(whale.total_volume / 1000).toFixed(1)}k</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Win Rate</p>
                            <p className="text-green-400 font-semibold">{(whale.win_rate * 100).toFixed(0)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Score</p>
                            <p className="text-purple-400 font-semibold">{whale.performance_score.toFixed(1)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl text-white">P&L Over Time</CardTitle>
                  <CardDescription>Coming soon - 7 days of data needed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Chart will appear after validation period
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Strategy Breakdown</CardTitle>
                  <CardDescription>Performance by strategy type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Chart will appear after first trades
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p className="mb-2">Q08 Prediction Markets v1.0 | Built with Cloudflare Workers + Next.js</p>
          <p className="flex items-center justify-center gap-4">
            <a href={`${API_BASE}/api/stats`} target="_blank" className="text-blue-400 hover:underline">/api/stats</a>
            <span>•</span>
            <a href={`${API_BASE}/api/signals`} target="_blank" className="text-blue-400 hover:underline">/api/signals</a>
            <span>•</span>
            <a href={`${API_BASE}/api/whales`} target="_blank" className="text-blue-400 hover:underline">/api/whales</a>
            <span>•</span>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">PAPER TRADING</Badge>
          </p>
        </footer>
      </div>
    </div>
  );
}
