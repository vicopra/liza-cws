import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, Users, DollarSign, Package } from "lucide-react";
import { useStation } from "@/contexts/StationContext";

interface DashboardStats {
  totalFarmers: number;
  deliveries: number;
  totalKg: number;
  totalPayments: number;
  parchStock: number;
}

export const Dashboard = () => {
  const { currentStation } = useStation();
  const [view, setView] = useState<"today" | "overall">("today");
  const [stats, setStats] = useState<DashboardStats>({
    totalFarmers: 0,
    deliveries: 0,
    totalKg: 0,
    totalPayments: 0,
    parchStock: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [currentStation, view]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch total farmers
      let farmersQuery = supabase.from('farmers').select('*', { count: 'exact', head: true });
      if (currentStation) farmersQuery = farmersQuery.eq('station_id', currentStation.id);
      const { count: farmersCount } = await farmersQuery;

      // Fetch deliveries (today or all)
      let deliveriesQuery = supabase.from('cherry_deliveries').select('quantity_kg');
      if (currentStation) deliveriesQuery = deliveriesQuery.eq('station_id', currentStation.id);
      if (view === 'today') deliveriesQuery = deliveriesQuery.eq('delivery_date', today);
      const { data: deliveriesData, error: deliveriesError } = await deliveriesQuery;
      if (deliveriesError) throw deliveriesError;

      const totalKg = deliveriesData?.reduce((sum, d) => sum + Number(d.quantity_kg), 0) || 0;

      // Fetch payments (today or all)
      let paymentsQuery = supabase.from('payments').select('amount');
      if (currentStation) paymentsQuery = paymentsQuery.eq('station_id', currentStation.id);
      if (view === 'today') paymentsQuery = paymentsQuery.eq('payment_date', today);
      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;

      const totalPaymentsSum = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Parch stock (always all-time balance)
      let stockQuery = supabase.from('parch_stock').select('transaction_type, quantity_kg');
      if (currentStation) stockQuery = stockQuery.eq('station_id', currentStation.id);
      const { data: stockData, error: stockError } = await stockQuery;
      if (stockError) throw stockError;

      const parchStock = stockData?.reduce((balance, transaction) => {
        const qty = Number(transaction.quantity_kg);
        return transaction.transaction_type === 'input' ? balance + qty : balance - qty;
      }, 0) || 0;

      setStats({
        totalFarmers: farmersCount || 0,
        deliveries: deliveriesData?.length || 0,
        totalKg,
        totalPayments: totalPaymentsSum,
        parchStock,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {currentStation ? currentStation.name : "All Stations"} —{" "}
            {view === "today" ? "Today's operations" : "Overall operations"}
          </p>
        </div>

        {/* Toggle */}
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
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('en-RW', {
                style: 'currency',
                currency: 'RWF',
              }).format(stats.totalPayments)}
            </div>
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
    </div>
  );
};
