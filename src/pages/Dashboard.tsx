import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Coffee, Users, DollarSign, Package, AlertTriangle, TrendingDown,
  Wallet, TrendingUp, Receipt, Award, Download, RefreshCw,
} from "lucide-react";
import { useStation } from "@/contexts/StationContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(n);

const fmtK = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
};

interface Stats {
  totalFarmers: number;
  todayKg: number;
  seasonKg: number;
  todayDeliveries: number;
  todayPayments: number;
  todayExpenses: number;
  todayAdvances: number;
  walletBalance: number;
  owedToFarmers: number;
  farmersOweUs: number;
  currentCherryPrice: number;
  parchStock: number;
}

interface FarmerLeader {
  name: string;
  totalKg: number;
  deliveries: number;
}

interface DailyProduction {
  date: string;
  kg: number;
  deliveries: number;
}

interface PriceHistory {
  date: string;
  price: number;
}

interface WalletTx {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  notes: string | null;
}

export const Dashboard = () => {
  const { currentStation } = useStation();
  const [view, setView] = useState<"today" | "overall">("today");
  const [leaderFilter, setLeaderFilter] = useState<"day" | "week" | "month" | "season">("month");
  const [stats, setStats] = useState<Stats>({
    totalFarmers: 0, todayKg: 0, seasonKg: 0, todayDeliveries: 0,
    todayPayments: 0, todayExpenses: 0, todayAdvances: 0, walletBalance: 0,
    owedToFarmers: 0, farmersOweUs: 0, currentCherryPrice: 0, parchStock: 0,
  });
  const [leaders, setLeaders] = useState<FarmerLeader[]>([]);
  const [dailyProduction, setDailyProduction] = useState<DailyProduction[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [walletTx, setWalletTx] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => { fetchAll(); }, [currentStation, leaderFilter, view]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Station filter helper
      const sf = (q: any) => currentStation ? q.eq("station_id", currentStation.id) : q;

      // ── Farmers ──
      const { count: farmersCount } = await sf(
        supabase.from("farmers").select("*", { count: "exact", head: true })
      );

      // ── Today's deliveries ──
      const { data: todayDel } = await sf(
        supabase.from("cherry_deliveries").select("quantity_kg, total_amount, price_per_kg")
          .eq("delivery_date", today)
      );
      const todayKg = todayDel?.reduce((s, d) => s + Number(d.quantity_kg), 0) ?? 0;

      // ── Season deliveries ──
      const { data: seasonDel } = await sf(
        supabase.from("cherry_deliveries").select("quantity_kg, price_per_kg, delivery_date, farmer_id, farmers(name)")
      );
      const seasonKg = seasonDel?.reduce((s, d) => s + Number(d.quantity_kg), 0) ?? 0;

      // ── Current cherry price (latest delivery price) ──
      const { data: latestDel } = await sf(
        supabase.from("cherry_deliveries").select("price_per_kg, delivery_date")
          .order("delivery_date", { ascending: false }).limit(1)
      );
      const currentCherryPrice = latestDel?.[0]?.price_per_kg ?? 0;

      // ── Price history (last 14 days) ──
      const priceMap = new Map<string, number>();
      seasonDel?.forEach((d: any) => {
        if (d.price_per_kg && d.delivery_date) {
          priceMap.set(d.delivery_date, Number(d.price_per_kg));
        }
      });
      const priceArr = Array.from(priceMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([date, price]) => ({ date: format(new Date(date), "MMM dd"), price }));
      setPriceHistory(priceArr);

      // ── Payments (today or all-time based on view) ──
      let payQ = sf(supabase.from("payments").select("amount"));
      if (view === "today") payQ = payQ.eq("payment_date", today);
      const { data: todayPay } = await payQ;
      const todayPayments = todayPay?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

      // ── Expenses (today or all-time based on view) ──
      let expQ = sf(supabase.from("wallet_transactions").select("amount").eq("transaction_type", "expense"));
      if (view === "today") expQ = expQ.eq("transaction_date", today);
      const { data: todayExp } = await expQ;
      const todayExpenses = todayExp?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

      // ── Advances (today or all-time based on view) ──
      let advQ = sf(supabase.from("farmer_advances").select("amount"));
      if (view === "today") advQ = advQ.eq("advance_date", today);
      const { data: todayAdv } = await advQ;
      const todayAdvances = todayAdv?.reduce((s, a) => s + Number(a.amount), 0) ?? 0;

      // ── Wallet balance (all time) ──
      const { data: walletData } = await sf(
        supabase.from("wallet_transactions").select("transaction_type, amount, transaction_date, notes, id")
          .order("transaction_date", { ascending: false })
      );
      const INCOME = ["deposit", "income", "sale", "revenue"];
      const EXPENSE = ["payment", "advance", "expense", "withdrawal"];
      const walletBalance = walletData?.reduce((s, t) => {
        const amt = Number(t.amount);
        const type = (t.transaction_type ?? "").toLowerCase();
        if (INCOME.includes(type)) return s + amt;
        if (EXPENSE.includes(type)) return s - amt;
        return s;
      }, 0) ?? 0;
      setWalletTx((walletData ?? []).slice(0, 10) as WalletTx[]);

      // ── Owed to farmers (delivery value - payments - advances) ──
      const { data: allDel } = await sf(
        supabase.from("cherry_deliveries").select("farmer_id, total_amount")
      );
      const { data: allPay } = await sf(
        supabase.from("payments").select("farmer_id, amount")
      );
      const { data: allAdv } = await sf(
        supabase.from("farmer_advances").select("farmer_id, amount")
      );

      const deliveryMap = new Map<string, number>();
      allDel?.forEach((d: any) => {
        deliveryMap.set(d.farmer_id, (deliveryMap.get(d.farmer_id) ?? 0) + Number(d.total_amount ?? 0));
      });
      const payMap = new Map<string, number>();
      allPay?.forEach((p: any) => {
        payMap.set(p.farmer_id, (payMap.get(p.farmer_id) ?? 0) + Number(p.amount));
      });
      const advMap = new Map<string, number>();
      allAdv?.forEach((a: any) => {
        advMap.set(a.farmer_id, (advMap.get(a.farmer_id) ?? 0) + Number(a.amount));
      });

      let owedToFarmers = 0;
      let farmersOweUs = 0;
      deliveryMap.forEach((delAmt, farmerId) => {
        const paid = (payMap.get(farmerId) ?? 0) + (advMap.get(farmerId) ?? 0);
        const balance = delAmt - paid;
        if (balance > 0) owedToFarmers += balance;
        else if (balance < 0) farmersOweUs += Math.abs(balance);
      });
      advMap.forEach((advAmt, farmerId) => {
        if (!deliveryMap.has(farmerId)) farmersOweUs += advAmt;
      });

      // ── Parch stock ──
      const { data: stockData } = await sf(
        supabase.from("parch_stock").select("transaction_type, quantity_kg")
      );
      const parchStock = stockData?.reduce((bal, t) => {
        const qty = Number(t.quantity_kg);
        return t.transaction_type === "input" ? bal + qty : bal - qty;
      }, 0) ?? 0;

      // ── Leaderboard ──
      const leaderStart = (() => {
        const now = new Date();
        if (leaderFilter === "day") return today;
        if (leaderFilter === "week") return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
        if (leaderFilter === "month") return format(startOfMonth(now), "yyyy-MM-dd");
        return "2020-01-01";
      })();

      let leaderQ = supabase.from("cherry_deliveries")
        .select("farmer_id, quantity_kg, farmers(name)")
        .gte("delivery_date", leaderStart);
      if (currentStation) leaderQ = leaderQ.eq("station_id", currentStation.id);
      const { data: leaderData } = await leaderQ;

      const leaderMap = new Map<string, { name: string; totalKg: number; deliveries: number }>();
      leaderData?.forEach((d: any) => {
        const name = d.farmers?.name ?? "Unknown";
        const existing = leaderMap.get(d.farmer_id) ?? { name, totalKg: 0, deliveries: 0 };
        leaderMap.set(d.farmer_id, {
          name,
          totalKg: existing.totalKg + Number(d.quantity_kg),
          deliveries: existing.deliveries + 1,
        });
      });
      const leaderList = Array.from(leaderMap.values())
        .sort((a, b) => b.totalKg - a.totalKg)
        .slice(0, 10);
      setLeaders(leaderList);

      // ── Daily production (last 14 days) ──
      const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = subDays(new Date(), 13 - i);
        return format(d, "yyyy-MM-dd");
      });
      const prodMap = new Map<string, { kg: number; deliveries: number }>();
      seasonDel?.forEach((d: any) => {
        if (last14.includes(d.delivery_date)) {
          const ex = prodMap.get(d.delivery_date) ?? { kg: 0, deliveries: 0 };
          prodMap.set(d.delivery_date, { kg: ex.kg + Number(d.quantity_kg), deliveries: ex.deliveries + 1 });
        }
      });
      const prodArr = last14.map(date => ({
        date: format(new Date(date), "MMM dd"),
        kg: prodMap.get(date)?.kg ?? 0,
        deliveries: prodMap.get(date)?.deliveries ?? 0,
      }));
      setDailyProduction(prodArr);

      setStats({
        totalFarmers: farmersCount ?? 0,
        todayKg, seasonKg,
        todayDeliveries: todayDel?.length ?? 0,
        todayPayments, todayExpenses, todayAdvances,
        walletBalance, owedToFarmers, farmersOweUs,
        currentCherryPrice, parchStock,
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Farmers", stats.totalFarmers.toString()],
      ["Today's KG", stats.todayKg.toFixed(2)],
      ["Season KG", stats.seasonKg.toFixed(2)],
      ["Payments", stats.todayPayments.toString()],
      ["Expenses", stats.todayExpenses.toString()],
      ["Advances", stats.todayAdvances.toString()],
      ["Wallet Balance", stats.walletBalance.toString()],
      ["Owed to Farmers", stats.owedToFarmers.toString()],
      ["Farmers Owe Us", stats.farmersOweUs.toString()],
      ["Current Cherry Price/KG", stats.currentCherryPrice.toString()],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const LOW_BALANCE_THRESHOLD = 1_000_000;
  const isLowBalance = stats.walletBalance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {currentStation ? currentStation.name : "All Stations"} — Last updated {format(lastRefresh, "HH:mm:ss")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-1" />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" />Export CSV
          </Button>
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setView("today")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === "today" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
              Today
            </button>
            <button onClick={() => setView("overall")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === "overall" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
              Overall
            </button>
          </div>
        </div>
      </div>

      {/* ── Low Balance Alert ── */}
      {isLowBalance && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-300 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-700">⚠️ Low Wallet Balance</p>
            <p className="text-sm text-red-600">
              Current balance is <strong>{fmt(stats.walletBalance)}</strong> — below the 1,000,000 RWF threshold.
              Please deposit money from the bank to continue operations.
            </p>
          </div>
        </div>
      )}

      {/* ── Row 1: Farmer + Cherry Stats ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Farmers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFarmers}</div>
            <p className="text-xs text-muted-foreground">Registered farmers</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "today" ? "Today's Cherry" : "Season Cherry"}
            </CardTitle>
            <Coffee className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {view === "today" ? stats.todayKg.toFixed(1) : stats.seasonKg.toFixed(1)} kg
            </div>
            <p className="text-xs text-muted-foreground">
              {view === "today" ? `${stats.todayDeliveries} deliveries today` : "All cherry received"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Season Total</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.seasonKg.toFixed(1)} kg</div>
            <p className="text-xs text-muted-foreground">All cherry received</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cherry Price/KG</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{fmt(stats.currentCherryPrice)}</div>
            <p className="text-xs text-muted-foreground">Current price per kg</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Financial Activity ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          {view === "today" ? "Today's Financial Activity" : "Overall Financial Activity"}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {view === "today" ? "Payments Today" : "Total Payments"}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{fmt(stats.todayPayments)}</div>
              <p className="text-xs text-muted-foreground">
                {view === "today" ? "Paid to farmers today" : "Total paid to farmers"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {view === "today" ? "Expenses Today" : "Total Expenses"}
              </CardTitle>
              <Receipt className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{fmt(stats.todayExpenses)}</div>
              <p className="text-xs text-muted-foreground">
                {view === "today" ? "Operational expenses today" : "Total operational expenses"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {view === "today" ? "Advances Today" : "Total Advances"}
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{fmt(stats.todayAdvances)}</div>
              <p className="text-xs text-muted-foreground">
                {view === "today" ? "Advances given today" : "Total advances given"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Row 3: Wallet + Financial Overview ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={`border-2 ${isLowBalance ? "border-red-400" : "border-green-400/30"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <Wallet className={`h-4 w-4 ${isLowBalance ? "text-red-500" : "text-green-600"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isLowBalance ? "text-red-500" : "text-green-600"}`}>
              {fmt(stats.walletBalance)}
            </div>
            {isLowBalance
              ? <Badge variant="destructive" className="text-xs mt-1">Low Balance</Badge>
              : <p className="text-xs text-muted-foreground">Available for operations</p>}
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">We Owe Farmers</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(stats.owedToFarmers)}</div>
            <p className="text-xs text-muted-foreground">Unpaid delivery balances</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Farmers Owe Us</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{fmt(stats.farmersOweUs)}</div>
            <p className="text-xs text-muted-foreground">Outstanding advance balances</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Cherry Production (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyProduction.every(d => d.kg === 0) ? (
              <p className="text-center text-muted-foreground py-8">No production data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyProduction} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} kg`, "Cherry"]} />
                  <Bar dataKey="kg" fill="var(--color-primary, #7c3aed)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cherry Price History (RWF/kg)</CardTitle>
          </CardHeader>
          <CardContent>
            {priceHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No price data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={priceHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
                  <Tooltip formatter={(v: any) => [fmt(v), "Price/kg"]} />
                  <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Farmer Leaderboard ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Top Farmers Leaderboard
            </CardTitle>
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {(["day", "week", "month", "season"] as const).map(f => (
                <button key={f} onClick={() => setLeaderFilter(f)}
                  className={`px-3 py-1.5 capitalize transition-colors ${leaderFilter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {leaders.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No delivery data for this period</p>
          ) : (
            <div className="space-y-3">
              {leaders.map((farmer, i) => (
                <div key={farmer.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                    ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{farmer.name}</p>
                    <p className="text-xs text-muted-foreground">{farmer.deliveries} deliveries</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold">{farmer.totalKg.toFixed(1)} kg</p>
                    <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
                      <div className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (farmer.totalKg / (leaders[0]?.totalKg || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Wallet Transaction History ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Recent Wallet Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {walletTx.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {walletTx.map((tx) => {
                const isIncome = ["deposit", "income", "sale", "revenue"].includes(tx.transaction_type?.toLowerCase());
                return (
                  <div key={tx.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${isIncome ? "bg-green-100" : "bg-red-100"}`}>
                        {isIncome
                          ? <TrendingUp className="h-3 w-3 text-green-600" />
                          : <TrendingDown className="h-3 w-3 text-red-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{tx.transaction_type?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.transaction_date} {tx.notes && `• ${tx.notes.slice(0, 40)}`}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${isIncome ? "text-green-600" : "text-red-600"}`}>
                      {isIncome ? "+" : "-"}{fmt(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};