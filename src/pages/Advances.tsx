import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Advance {
  id: string;
  farmer_id: string;
  amount: number;
  amount_recovered: number;
  balance: number;
  advance_date: string;
  purpose: string;
  status: string;
  created_at: string;
  farmers?: {
    name: string;
  };
}

interface Farmer {
  id: string;
  name: string;
}

export default function Advances() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    farmer_id: "",
    amount: "",
    purpose: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [advancesRes, farmersRes] = await Promise.all([
        supabase.from("farmer_advances").select(`
          *,
          farmers(name)
        `).order("created_at", { ascending: false }),
        supabase.from("farmers").select("id, name").order("name")
      ]);

      if (advancesRes.error) throw advancesRes.error;
      if (farmersRes.error) throw farmersRes.error;

      setAdvances(advancesRes.data || []);
      setFarmers(farmersRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load advances");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      const amount = parseFloat(formData.amount);
      
      const { error } = await supabase.from("farmer_advances").insert({
        farmer_id: formData.farmer_id,
        amount,
        balance: amount,
        purpose: formData.purpose,
        recorded_by: user.id,
      });

      if (error) throw error;

      toast.success("Advance recorded successfully");
      setOpen(false);
      setFormData({ farmer_id: "", amount: "", purpose: "" });
      fetchData();
    } catch (error) {
      console.error("Error recording advance:", error);
      toast.error("Failed to record advance");
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const totalAdvances = advances.reduce((sum, adv) => sum + Number(adv.amount), 0);
  const totalRecovered = advances.reduce((sum, adv) => sum + Number(adv.amount_recovered), 0);
  const totalBalance = advances.filter(a => a.status === 'active').reduce((sum, adv) => sum + Number(adv.balance), 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Farmer Advances</h1>
          <p className="text-muted-foreground">Track and manage farmer advances</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Record Advance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Advance</DialogTitle>
              <DialogDescription>Give an advance payment to a farmer</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="farmer">Farmer</Label>
                <Select value={formData.farmer_id} onValueChange={(value) => setFormData({ ...formData, farmer_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select farmer" />
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
                <Label htmlFor="amount">Amount (RWF)</Label>
                <Input
                  id="amount"
                  type="number"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Pre-harvest support, seeds, etc."
                />
              </div>
              <Button type="submit" className="w-full">Record Advance</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Advances Given</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(totalAdvances)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Recovered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(totalRecovered)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(totalBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {advances.map((advance) => (
          <Card key={advance.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{advance.farmers?.name}</CardTitle>
                  <CardDescription>{new Date(advance.advance_date).toLocaleDateString()}</CardDescription>
                </div>
                <Badge variant={advance.status === 'active' ? 'default' : 'secondary'}>
                  {advance.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount Given</p>
                  <p className="font-semibold">{new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(Number(advance.amount))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recovered</p>
                  <p className="font-semibold text-green-600">{new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(Number(advance.amount_recovered))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-semibold text-orange-600">{new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(Number(advance.balance))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <p className="text-sm">{advance.purpose || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
