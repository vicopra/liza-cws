import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet as WalletIcon, TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";

const walletSchema = z.object({
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(100000000, { message: "Amount must be less than 100,000,000" }),
  transaction_date: z.string().nonempty({ message: "Transaction date is required" }),
  notes: z.string().trim().max(500, { message: "Notes must be less than 500 characters" }).optional(),
});

interface WalletTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface WalletStats {
  balance: number;
  totalDeposits: number;
  totalPayments: number;
  totalCoffeeSold: number;
}

const Wallet = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats>({
    balance: 0,
    totalDeposits: 0,
    totalPayments: 0,
    totalCoffeeSold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    notes: "",
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch wallet balance
      const { data: balanceData, error: balanceError } = await supabase.rpc('get_wallet_balance');
      if (balanceError) throw balanceError;

      // Fetch total coffee sold
      const { data: coffeeData, error: coffeeError } = await supabase.rpc('get_total_coffee_sold');
      if (coffeeError) throw coffeeError;

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;

      // Calculate totals
      const deposits = transactionsData?.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const payments = transactionsData?.filter(t => t.transaction_type === 'payment').reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setStats({
        balance: Number(balanceData) || 0,
        totalDeposits: deposits,
        totalPayments: payments,
        totalCoffeeSold: Number(coffeeData) || 0,
      });

      setTransactions(transactionsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load wallet data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = walletSchema.parse({
        amount: parseFloat(formData.amount),
        transaction_date: formData.transaction_date,
        notes: formData.notes,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("wallet_transactions").insert({
        transaction_type: "deposit",
        amount: validatedData.amount,
        notes: validatedData.notes || null,
        transaction_date: validatedData.transaction_date,
        recorded_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Deposit recorded successfully",
      });

      setOpen(false);
      setFormData({ amount: "", notes: "", transaction_date: new Date().toISOString().split('T')[0] });
      fetchData();
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
          description: "Failed to record deposit",
          variant: "destructive",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">LIZA CWS Wallet</h1>
          <p className="text-muted-foreground">Track cash flow and wallet balance</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <TrendingUp className="mr-2 h-4 w-4" />
              Record Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Deposit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="transaction_date">Date</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (RWF)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="100000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Bank deposit reference or additional details"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full">Record Deposit</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.balance.toLocaleString()} RWF</div>
            <p className="text-xs text-muted-foreground">Available for payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalDeposits.toLocaleString()} RWF</div>
            <p className="text-xs text-muted-foreground">Money brought to CWS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalPayments.toLocaleString()} RWF</div>
            <p className="text-xs text-muted-foreground">Paid to farmers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coffee Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCoffeeSold.toLocaleString()} KG</div>
            <p className="text-xs text-muted-foreground">Cherry deliveries received</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions recorded yet</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${transaction.transaction_type === 'deposit' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {transaction.transaction_type === 'deposit' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{transaction.transaction_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </p>
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground italic">{transaction.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className={`font-bold ${transaction.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.transaction_type === 'deposit' ? '+' : '-'}{Number(transaction.amount).toLocaleString()} RWF
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Wallet;
