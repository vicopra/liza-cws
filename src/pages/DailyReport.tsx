import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DailyDelivery {
  id: string;
  farmer_name: string;
  quantity_kg: number;
  total_amount: number;
  payment_status: string;
  advance_deducted: number;
  payment_due: number;
}

interface DailyStats {
  totalSpent: number;
  totalOwed: number;
  totalAdvancesOwed: number;
  totalKg: number;
  deliveries: DailyDelivery[];
}

export default function DailyReport() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [stats, setStats] = useState<DailyStats>({
    totalSpent: 0,
    totalOwed: 0,
    totalAdvancesOwed: 0,
    totalKg: 0,
    deliveries: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate]);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      // Fetch deliveries for the day
      const { data: deliveries, error: deliveriesError } = await supabase
        .from("cherry_deliveries")
        .select(`
          id,
          quantity_kg,
          total_amount,
          payment_status,
          advance_deducted,
          payment_due,
          farmers(name)
        `)
        .eq("delivery_date", selectedDate)
        .order("created_at", { ascending: false });

      if (deliveriesError) throw deliveriesError;

      // Fetch payments made on this day
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_date", selectedDate);

      if (paymentsError) throw paymentsError;

      // Get total advances owed
      const { data: advancesOwed } = await supabase.rpc('get_total_advances_owed');
      
      // Get amount owed to farmers
      const { data: owedToFarmers } = await supabase.rpc('get_amount_owed_to_farmers');

      const totalSpent = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const totalKg = (deliveries || []).reduce((sum, d) => sum + Number(d.quantity_kg), 0);

      const formattedDeliveries = (deliveries || []).map(d => ({
        id: d.id,
        farmer_name: d.farmers?.name || "Unknown",
        quantity_kg: Number(d.quantity_kg),
        total_amount: Number(d.total_amount),
        payment_status: d.payment_status,
        advance_deducted: Number(d.advance_deducted) || 0,
        payment_due: Number(d.payment_due) || 0,
      }));

      setStats({
        totalSpent,
        totalOwed: owedToFarmers || 0,
        totalAdvancesOwed: advancesOwed || 0,
        totalKg,
        deliveries: formattedDeliveries
      });
    } catch (error) {
      console.error("Error fetching daily report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Daily Report</h1>
          <p className="text-muted-foreground">Cherry deliveries and payments summary</p>
        </div>
        <div className="flex gap-4">
          <div>
            <Label htmlFor="date">Report Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <Button onClick={handlePrint} variant="outline">
            Print Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Cash Spent Today</CardTitle>
                <CardDescription>Payments made to farmers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(stats.totalSpent)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Amount Owed to Farmers</CardTitle>
                <CardDescription>Pending payments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">
                  {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(stats.totalOwed)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Farmers Owe CWS</CardTitle>
                <CardDescription>Outstanding advances</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(stats.totalAdvancesOwed)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Cherries</CardTitle>
                <CardDescription>Received today</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalKg} kg</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Today's Deliveries</CardTitle>
              <CardDescription>
                {stats.deliveries.length} deliveries on {new Date(selectedDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.deliveries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No deliveries recorded for this date</p>
                ) : (
                  stats.deliveries.map((delivery) => (
                    <div key={delivery.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{delivery.farmer_name}</h3>
                          <p className="text-sm text-muted-foreground">{delivery.quantity_kg} kg</p>
                        </div>
                        <Badge variant={delivery.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {delivery.payment_status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Value</p>
                          <p className="font-medium">
                            {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(delivery.total_amount)}
                          </p>
                        </div>
                        {delivery.advance_deducted > 0 && (
                          <>
                            <div>
                              <p className="text-muted-foreground">Advance Deducted</p>
                              <p className="font-medium text-orange-600">
                                {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(delivery.advance_deducted)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Payment Due</p>
                              <p className="font-medium">
                                {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(delivery.payment_due)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
