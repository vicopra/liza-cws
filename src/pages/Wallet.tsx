import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet as WalletIcon, TrendingUp, TrendingDown, Package, Building2, Receipt } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStation } from "@/contexts/StationContext";
import { Badge } from "@/components/ui/badge";

interface WalletTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  notes: string | null;
  expense_type: string | null;
  created_at: string;
  station_id: string | null;
  stations?: { name: string; code: string } | null;
}

interface WalletStats {
  balance: number;
  totalDeposits: number;
  totalPayments: number;
  totalExpenses: number;
  totalCoffeeSold: number;
}

const EXPENSE_TYPES = [
  "Casual Worker Payment",
  "Supplies",
  "Maintenance",
  "Transport",
  "Utilities",
  "Equipment",
  "Other",
];

const Wallet = () => {
  const { currentStation, userStations, isAdmin } = useStation();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats>({
    balance: 0,
    totalDeposits: 0,
    totalPayments: 0,
    totalExpenses: 0,
    totalCoffeeSold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "deposits" | "payments" | "expenses">("all");

  const [depositForm, setDepositForm] = useState({
    amount: "",
    notes: "",
    transaction_date: new Date().toISOString().split('T')[0],
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    expense_type: "",
    notes: "",
    transaction_date: new Date().toISOString().split('T')[0],
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [currentStation]);

  const fetchData = async () => {
    try {
      setLoading(true);

      let transactionsQuery = supabase
        .from("wallet_transactions")
        .select("*, stations(name, code)")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (currentStation) {
        transactionsQuery = transactionsQuery.eq('station_id', currentStation.id);
      }

      const { data: transactionsData, error: transactionsError } = await transactionsQuery;
      if (transactionsError) throw transactionsError;

      let coffeeQuery = supabase.from('cherry_deliveries').select('quantity_kg');
      if (currentStation) {
        coffeeQuery = coffeeQuery.eq('station_id', currentStation.id);
      }
      const { data: coffeeData } = await coffeeQuery;
      const totalCoffee = coffeeData?.reduce((sum, d) => sum + Number(d.quantity_kg), 0) || 0;

      const deposits = transactionsData?.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const payments = transactionsData?.filter(t => t.transaction_type === 'payment').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const expenses = transactionsData?.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setStats({
        balance: deposits - payments - expenses,
        totalDeposits: deposits,
        totalPayments: payments,
        totalExpenses: expenses,
        totalCoffeeSold: totalCoffee,
      });

      setTransactions(transactionsData || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStationId = () => {
    return currentStation?.id || (userStations.length === 1 ? userStations[0].id : null);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stationId = getStationId();
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("wallet_transactions").insert({
        transaction_type: "deposit",
        amount: parseFloat(depositForm.amount),
        notes: depositForm.notes || null,
        transaction_date: depositForm.transaction_date,
        recorded_by: user.id,
        station_id: stationId,
      });
      if (error) throw error;

      toast({ title: "Success", description: "Deposit recorded successfully" });
      setDepositOpen(false);
      setDepositForm({ amount: "", notes: "", transaction_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const stationId = getStationId();
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    if (!expenseForm.expense_type) {
      toast({ title: "Error", description: "Please select an expense type", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("wallet_transactions").insert({
        transaction_type: "expense",
        amount: parseFloat(expenseForm.amount),
        expense_type: expenseForm.expense_type,
        notes: expenseForm.notes || null,
        transaction_date: expenseForm.transaction_date,
        recorded_by: user.id,
        station_id: stationId,
      });
      if (error) throw error;

      toast({ title: "Success", description: "Expense recorded and balance updated" });
      setExpenseOpen(false);
      setExpenseForm({ amount: "", expense_type: "", notes: "", transaction_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (activeTab === "all") return true;
    if (activeTab === "deposits") return t.transaction_type === "deposit";
    if (activeTab === "payments") return t.transaction_type === "payment";
    if (activeTab === "expenses") return t.transaction_type === "expense";
    return true;
  });

  const getTransactionIcon = (type: string) => {
    if (type === "deposit") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (type === "expense") return <Receipt className="h-4 w-4 text-orange-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getTransactionColor = (type: string) => {
    if (type === "deposit") return "text-green-600";
    if (type === "expense") return "text-orange-600";
    return "text-red-600";
  };

  const getTransactionBg = (type: string) => {
    if (type === "deposit") return "bg-green-100";
    if (type === "expense") return "bg-orange-100";
    return "bg-red-100";
  };

  const getTransactionSign = (type: string) => {
    return type === "deposit" ? "+" : "-";
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
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">LIZA CWS Wallet</h1>
          <p className="text-muted-foreground">Track cash flow and wallet balance</p>
        </div>
        <div className="flex gap-2">
          {/* Record Expense */}
          <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Receipt className="mr-2 h-4 w-4" />
                Record Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={expenseForm.transaction_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, transaction_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Expense Type</Label>
                  <Select value={expenseForm.expense_type} onValueChange={(v) => setExpenseForm({ ...expenseForm, expense_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select expense type" /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (RWF)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 50000" value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea placeholder="Description of the expense..." value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Record Expense</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Record Deposit */}
          <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
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
                  <Label>Date</Label>
                  <Input type="date" value={depositForm.transaction_date}
                    onChange={(e) => setDepositForm({ ...depositForm, transaction_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Amount (RWF)</Label>
                  <Input type="number" step="0.01" placeholder="100000" value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea placeholder="Bank deposit reference or additional details" value={depositForm.notes}
                    onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Record Deposit</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.balance < 0 ? 'text-red-600' : ''}`}>
              {stats.balance.toLocaleString()} RWF
            </div>
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
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalExpenses.toLocaleString()} RWF</div>
            <p className="text-xs text-muted-foreground">Operational expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coffee</CardTitle>
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Transaction History</CardTitle>
            {/* Filter tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {(["all", "deposits", "payments", "expenses"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 capitalize transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions recorded yet</p>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${getTransactionBg(transaction.transaction_type)}`}>
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{transaction.transaction_type}</p>
                        {transaction.expense_type && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                            {transaction.expense_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </p>
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground italic">{transaction.notes}</p>
                      )}
                      {transaction.stations && isAdmin && (
                        <div className="flex items-center gap-1 text-primary">
                          <Building2 className="h-3 w-3" />
                          <span className="text-xs">{transaction.stations.code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`font-bold ${getTransactionColor(transaction.transaction_type)}`}>
                    {getTransactionSign(transaction.transaction_type)}{Number(transaction.amount).toLocaleString()} RWF
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
