import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee, Users, DollarSign, Package } from "lucide-react";

interface DashboardStats {
  totalFarmers: number;
  todayDeliveries: number;
  todayKg: number;
  todayPayments: number;
  parchStock: number;
}

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalFarmers: 0,
    todayDeliveries: 0,
    todayKg: 0,
    todayPayments: 0,
    parchStock: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch total farmers
      const { count: farmersCount } = await supabase
        .from('farmers')
        .select('*', { count: 'exact', head: true });

      // Fetch today's deliveries
      const { data: todayDeliveries, error: deliveriesError } = await supabase
        .from('cherry_deliveries')
        .select('quantity_kg')
        .eq('delivery_date', today);

      if (deliveriesError) throw deliveriesError;

      const todayKg = todayDeliveries?.reduce((sum, d) => sum + Number(d.quantity_kg), 0) || 0;

      // Fetch today's payments
      const { data: todayPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('payment_date', today);

      if (paymentsError) throw paymentsError;

      const todayPaymentsSum = todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Calculate parch stock
      const { data: stockData, error: stockError } = await supabase
        .from('parch_stock')
        .select('transaction_type, quantity_kg');

      if (stockError) throw stockError;

      const parchStock = stockData?.reduce((balance, transaction) => {
        const qty = Number(transaction.quantity_kg);
        return transaction.transaction_type === 'input' ? balance + qty : balance - qty;
      }, 0) || 0;

      setStats({
        totalFarmers: farmersCount || 0,
        todayDeliveries: todayDeliveries?.length || 0,
        todayKg,
        todayPayments: todayPaymentsSum,
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of today's operations</p>
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
            <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
            <Coffee className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayDeliveries}</div>
            <p className="text-xs text-muted-foreground">{stats.todayKg.toFixed(2)} kg received</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('en-RW', {
                style: 'currency',
                currency: 'RWF',
              }).format(stats.todayPayments)}
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
