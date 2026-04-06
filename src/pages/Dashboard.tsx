import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, Users, DollarSign, Package, AlertCircle, TrendingDown, Wallet } from "lucide-react";
import { useStation } from "@/contexts/StationContext";

interface DashboardStats {
  totalFarmers: number;
  deliveries: number;
  totalKg: number;
  totalPayments: number;
  parchStock: number;
  pendingPayments: number;
  farmerAdvances: number;
  walletBalance: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(n);

export const Dashboard = () => {
  const { currentStation } = useStation();
  const [view, setView] = useState<"today" | "overall">("today");
  const [stats, setStats] = useState<DashboardStats>({
    totalFarmers: 0,
    deliveries: 0,
    totalKg: 0,
    totalPayments: 0,
    parchStock: 0,
    pendingPayments: 0,
    farmerAdvances: 0,
    walletBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [currentStation, view]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const isToday = view === "today";

      // ── Farmers (always total count) ────────────────────────────────────────
      let farmersQ = supabase.from("farmers").select("*", { count: "exact", head: true });
      if (currentStation) farmersQ = farmersQ.eq("station_id", currentStation.id);
      const { count: farmersCount } = await farmersQ;

      // ── Deliveries ──────────────────────────────────────────────────────────
      let deliveriesQ = supabase.from("cherry_deliveries").select("quantity_kg, total_amount");
      if (currentStation) deliveriesQ = deliveriesQ.eq("station_id", currentStation.id);
      if (isToday) deliveriesQ = deliveriesQ.eq("delivery_date", today);
      const { data: deliveriesData, error: dErr } = await deliveriesQ;
      if (dErr) throw dErr;

      const totalKg = deliveriesData?.reduce((s, d) => s + Number(d.quantity_kg), 0) ?? 0;
      // Total value of ALL deliveries (used for pending payment calc)
      const totalDeliveryValue = deliveriesData?.reduce((s, d) => s + Number(d.total_amount ?? 0), 0) ?? 0;

      // ── Payments made ───────────────────────────────────────────────────────
      let paymentsQ = supabase.from("payments").select("amount");
      if (currentStation) paymentsQ = paymentsQ.eq("station_id", currentStation.id);
      if (isToday) paymentsQ = paymentsQ.eq("payment_date", today);
      const { data: paymentsData, error: pErr } = await paymentsQ;
      if (pErr) throw pErr;
      const totalPaymentsSum = paymentsData?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

      // ── Pending payments = delivery value − payments already made ───────────
      // Clamp to 0 so it never shows negative
      const pendingPayments = Math.max(0, totalDeliveryValue - totalPaymentsSum);

      // ── Farmer advances (active/partial outstanding balance) ─────────────────
      let advancesQ = supabase.from("farmer_advances").select("balance");
      if (currentStation) advancesQ = advancesQ.eq("station_id", currentStation.id);
      // For "today" show advances given today; for "overall" show all outstanding
      if (isToday) {
        advancesQ = advancesQ.eq("advance_date", today);
      } else {
        advancesQ = advancesQ.in("status", ["active", "partial"]);
      }
      const { data: advancesData } = await advancesQ;
      const farmerAdvances = advancesData?.reduce((s, a) => s + Number(a.balance), 0) ?? 0;

      // ── Wallet balance ───────────────────────────────────────────────────────
      // wallet_transactions: income types add, expense types subtract
      let walletQ = supabase.from("wallet_transactions").select("transaction_type, amount");
      if (currentStation) walletQ = walletQ.eq("station_id", currentStation.id);
      if (isToday) walletQ = walletQ.eq("transaction_date", today);
      const { data: walletData } = await walletQ;

      const INCOME_TYPES = ["income", "sale", "deposit", "revenue"];
      const EXPENSE_TYPES = ["payment", "advance", "expense", "withdrawal"];
      const walletBalance = walletData?.reduce((s, t) => {
        const amt = Number(t.amount);
        const type = (t.transaction_type ?? "").toLowerCase();
        if (INCOME_TYPES.includes(type)) return s + amt;
        if (EXPENSE_TYPES.includes(type)) return s - amt;
        return s;
      }, 0) ?? 0;

      // ── Parch stock (always all-time balance — makes no sense to filter by date) ──
      let stockQ = supabase.from("parch_stock").select("transaction_type, quantity_kg");
      if (currentStation) stockQ = stockQ.eq("station_id", currentStation.id);
      const { data: stockData, error: sErr } = await stockQ;
      if (sErr) throw sErr;
      const parchStock =
        stockData?.reduce((bal, t) => {
          const qty = Number(t.quantity_kg);
          return t.transaction_type === "input" ? bal + qty : bal - qty;
        }, 0) ?? 0;

      setStats({
        totalFarmers: farmersCount ?? 0,
        deliveries: deliveriesData?.length ?? 0,
        totalKg,
        totalPayments: totalPaymentsSum,
        parchStock,
        pendingPayments,
        farmerAdvances,
        walletBalance,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Header + Toggle ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {currentStation ? currentStation.name : "All Stations"} —{" "}
            {view === "today" ? "Today's operations" : "Overall operations"}
          </p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("today")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === "today"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setView("overall")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === "overall"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            Overall
          </button>
        </div>
      </div>

      {/* ── Row 1: existing 4 cards ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Farmers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFarmers}</div>
            <p className="text-xs text-muted-foreground">Registered farmers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "today" ? "Today's Deliveries" : "Total Deliveries"}
            </CardTitle>
            <Coffee className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveries}</div>
            <p className="text-xs text-muted-foreground">{stats.totalKg.toFixed(2)} kg received</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "today" ? "Today's Payments" : "Total Payments"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats.totalPayments)}</div>
            <p className="text-xs text-muted-foreground">Paid to farmers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parch Stock</CardTitle>
            <Package className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.parchStock.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">Current inventory</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: 3 new financial cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Pending Payments — Red */}
        <Card className="bg-gradient-to-br from-card to-red-500/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "today" ? "Today's Pending" : "Pending Payments"}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {fmt(stats.pendingPayments)}
            </div>
            <p className="text-xs text-muted-foreground">
              Delivery value not yet paid to farmers
            </p>
          </CardContent>
        </Card>

        {/* Farmer Advances — Blue */}
        <Card className="bg-gradient-to-br from-card to-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "today" ? "Today's Advances" : "Farmer Advances"}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {fmt(stats.farmerAdvances)}
            </div>
            <p className="text-xs text-muted-foreground">
              {view === "today" ? "Advances given today" : "Outstanding advance balances"}
            </p>
          </CardContent>
        </Card>

        {/* Wallet Balance — Green */}
        <Card className="bg-gradient-to-br from-card to-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "today" ? "Today's Wallet" : "Wallet Balance"}
            </CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.walletBalance >= 0 ? "text-green-500" : "text-red-500"}`}>
              {fmt(stats.walletBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.walletBalance >= 0 ? "Available balance" : "Negative balance"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
