import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Users, DollarSign } from "lucide-react";

interface FarmerReport {
  id: string;
  name: string;
  total_deliveries: number;
  total_kg: number;
  total_value: number;
  total_paid: number;
  balance: number;
}

const Reports = () => {
  const [farmersReport, setFarmersReport] = useState<FarmerReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // Fetch all farmers with their delivery and payment data
      const { data: farmers, error: farmersError } = await supabase
        .from('farmers')
        .select('id, name');

      if (farmersError) throw farmersError;

      const reportsData: FarmerReport[] = await Promise.all(
        (farmers || []).map(async (farmer) => {
          // Get deliveries
          const { data: deliveries } = await supabase
            .from('cherry_deliveries')
            .select('quantity_kg, total_amount')
            .eq('farmer_id', farmer.id);

          // Get payments
          const { data: payments } = await supabase
            .from('payments')
            .select('amount')
            .eq('farmer_id', farmer.id);

          const totalKg = deliveries?.reduce((sum, d) => sum + Number(d.quantity_kg), 0) || 0;
          const totalValue = deliveries?.reduce((sum, d) => sum + Number(d.total_amount), 0) || 0;
          const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

          return {
            id: farmer.id,
            name: farmer.name,
            total_deliveries: deliveries?.length || 0,
            total_kg: totalKg,
            total_value: totalValue,
            total_paid: totalPaid,
            balance: totalValue - totalPaid,
          };
        })
      );

      setFarmersReport(reportsData.filter(r => r.total_deliveries > 0));
    } catch (error: any) {
      console.error('Error fetching reports:', error);
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
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">View detailed reports and analytics</p>
      </div>

      <Tabs defaultValue="farmers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="farmers">Farmer Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="farmers" className="space-y-4">
          {farmersReport.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No data available yet</p>
              </CardContent>
            </Card>
          ) : (
            farmersReport.map((farmer) => (
              <Card key={farmer.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{farmer.name}</span>
                    <span className={`text-lg font-bold ${
                      farmer.balance > 0 ? 'text-destructive' : 'text-accent'
                    }`}>
                      Balance: {new Intl.NumberFormat('en-RW', {
                        style: 'currency',
                        currency: 'RWF',
                      }).format(farmer.balance)}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Complete transaction history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-sm">Deliveries</span>
                      </div>
                      <p className="text-2xl font-bold">{farmer.total_deliveries}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">Total Kg</span>
                      </div>
                      <p className="text-2xl font-bold">{farmer.total_kg.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm">Total Value</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-RW', {
                          style: 'currency',
                          currency: 'RWF',
                        }).format(farmer.total_value)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Paid</span>
                      </div>
                      <p className="text-2xl font-bold text-accent">
                        {new Intl.NumberFormat('en-RW', {
                          style: 'currency',
                          currency: 'RWF',
                        }).format(farmer.total_paid)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
