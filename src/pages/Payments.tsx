import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Calendar, DollarSign, Building2, Receipt } from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";
import DeliveryReceipt from "@/components/DeliveryReceipt";

const paymentSchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(10000000, { message: "Amount must be less than 10,000,000" }),
  payment_date: z.string().nonempty({ message: "Payment date is required" }),
  payment_method: z.enum(["cash", "mobile_money", "bank_transfer"], { message: "Please select a payment method" }),
  notes: z.string().trim().max(500, { message: "Notes must be less than 500 characters" }).optional(),
});

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  station_id: string | null;
  farmers: { name: string };
  stations?: { name: string; code: string } | null;
}

interface Farmer {
  id: string;
  name: string;
}

const Payments = () => {
  const { currentStation, userStations, isAdmin } = useStation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<null | {
    farmerName: string;
    stationName: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    receiptNumber: string;
  }>(null);
  const [formData, setFormData] = useState({
    farmer_id: "",
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().split('T')[0],
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [currentStation]);

  const fetchData = async () => {
    try {
      // Fetch payments with station filter
      let paymentsQuery = supabase
        .from('payments')
        .select('*, farmers(name), stations(name, code)')
        .order('payment_date', { ascending: false })
        .limit(50);

      if (currentStation) {
        paymentsQuery = paymentsQuery.eq('station_id', currentStation.id);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Fetch farmers with station filter
      let farmersQuery = supabase.from('farmers').select('id, name').order('name');
      if (currentStation) {
        farmersQuery = farmersQuery.eq('station_id', currentStation.id);
      }

      const { data: farmersData, error: farmersError } = await farmersQuery;
      if (farmersError) throw farmersError;
      setFarmers(farmersData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error, "fetchPayments"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const stationId = currentStation?.id || (userStations.length === 1 ? userStations[0].id : null);
    
    if (!stationId && !isAdmin) {
      toast({
        title: "Error",
        description: "Please select a station first",
        variant: "destructive",
      });
      return;
    }

    try {
      const validatedData = paymentSchema.parse({
        farmer_id: formData.farmer_id,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        notes: formData.notes,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert payment
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          farmer_id: validatedData.farmer_id,
          amount: validatedData.amount,
          payment_method: validatedData.payment_method,
          payment_date: validatedData.payment_date,
          notes: validatedData.notes || null,
          recorded_by: user.id,
          station_id: stationId,
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Record wallet transaction (deduct from balance)
      const { error: walletError } = await supabase
        .from('wallet_transactions')
        .insert([{
          transaction_type: 'payment',
          amount: validatedData.amount,
          transaction_date: validatedData.payment_date,
          notes: `Payment to farmer`,
          recorded_by: user.id,
          payment_id: paymentData.id,
          station_id: stationId,
        }]);

      if (walletError) throw walletError;

      const farmer = farmers.find(f => f.id === validatedData.farmer_id);

      setDialogOpen(false);
      setFormData({
        farmer_id: "",
        amount: "",
        payment_method: "cash",
        payment_date: new Date().toISOString().split('T')[0],
        notes: "",
      });
      fetchData();

      // Show payment receipt
      setReceiptData({
        farmerName: farmer?.name || "Farmer",
        stationName: currentStation?.name || "Liza CWS",
        paymentDate: validatedData.payment_date,
        amount: validatedData.amount,
        paymentMethod: validatedData.payment_method,
        receiptNumber: `PAY-${Date.now().toString().slice(-6)}`,
      });

      toast({
        title: "Success",
        description: "Payment recorded and deducted from wallet",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: getUserFriendlyError(error, "recordPayment"),
          variant: "destructive",
        });
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {receiptData && (
        <DeliveryReceipt
          type="final_payment"
          receiptNumber={receiptData.receiptNumber}
          farmerName={receiptData.farmerName}
          stationName={receiptData.stationName}
          date={receiptData.paymentDate}
          totalAmount={receiptData.amount}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setReceiptData(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Record and track farmer payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Add a new payment to a farmer
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="farmer">Farmer *</Label>
                <Select
                  value={formData.farmer_id}
                  onValueChange={(value) => setFormData({ ...formData, farmer_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {farmers.map((farmer) => (
                      <SelectItem key={farmer.id} value={farmer.id}>
                        {farmer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (RWF) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
              <Button type="submit" className="w-full">
                Record Payment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {payments.map((payment) => (
          <Card key={payment.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{payment.farmers.name}</span>
                <span className="text-lg font-bold text-accent">
                  {new Intl.NumberFormat('en-RW', {
                    style: 'currency',
                    currency: 'RWF',
                  }).format(payment.amount)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-6 items-center justify-between">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">
                      {payment.payment_method.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReceiptData({
                    farmerName: payment.farmers.name,
                    stationName: payment.stations?.name || currentStation?.name || "Liza CWS",
                    paymentDate: payment.payment_date,
                    amount: payment.amount,
                    paymentMethod: payment.payment_method,
                    receiptNumber: `PAY-${payment.id.slice(-6).toUpperCase()}`,
                  })}
                >
                  <Receipt className="h-4 w-4 mr-1" /> Receipt
                </Button>
              </div>
              {payment.notes && (
                <p className="text-sm text-muted-foreground">{payment.notes}</p>
              )}
              {payment.stations && isAdmin && (
                <div className="flex items-center gap-2 text-primary">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm">{payment.stations.code}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Payments;
