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
import { Plus, ArrowUp, ArrowDown, Calendar, Package } from "lucide-react";

interface StockTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  quantity_kg: number;
  notes: string | null;
}

const Stock = () => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: "input",
    quantity_kg: "",
    transaction_date: new Date().toISOString().split('T')[0],
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('parch_stock')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);

      // Calculate current stock
      const stock = (data || []).reduce((balance, transaction) => {
        const qty = Number(transaction.quantity_kg);
        return transaction.transaction_type === 'input' ? balance + qty : balance - qty;
      }, 0);
      setCurrentStock(stock);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('parch_stock')
        .insert([{
          transaction_type: formData.transaction_type,
          quantity_kg: parseFloat(formData.quantity_kg),
          transaction_date: formData.transaction_date,
          notes: formData.notes || null,
          recorded_by: user.id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stock transaction recorded successfully",
      });

      setDialogOpen(false);
      setFormData({
        transaction_type: "input",
        quantity_kg: "",
        transaction_date: new Date().toISOString().split('T')[0],
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parch Stock</h1>
          <p className="text-muted-foreground">Manage parchment coffee inventory</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-accent to-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Stock Transaction</DialogTitle>
              <DialogDescription>
                Add or remove parchment coffee from stock
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Transaction Type *</Label>
                <Select
                  value={formData.transaction_type}
                  onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">Input (Add to stock)</SelectItem>
                    <SelectItem value="output">Output (Remove from stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Transaction Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (kg) *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity_kg}
                  onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                  required
                />
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
                Record Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Current Stock Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-accent">
            {currentStock.toFixed(2)} kg
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {transactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {transaction.transaction_type === 'input' ? (
                    <ArrowUp className="h-5 w-5 text-accent" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-destructive" />
                  )}
                  <span className="capitalize">{transaction.transaction_type}</span>
                </div>
                <span className={`text-lg font-bold ${
                  transaction.transaction_type === 'input' ? 'text-accent' : 'text-destructive'
                }`}>
                  {transaction.transaction_type === 'input' ? '+' : '-'}
                  {transaction.quantity_kg} kg
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </span>
              </div>
              {transaction.notes && (
                <p className="text-sm text-muted-foreground">{transaction.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Stock;
