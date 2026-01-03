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
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";
import { Building2 } from "lucide-react";

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
  station_id: string | null;
  farmers?: {
    name: string;
  };
  stations?: { name: string; code: string } | null;
}

const advanceSchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(1000000, { message: "Amount must be less than 1,000,000" }),
  purpose: z.string().trim().max(500, { message: "Purpose must be less than 500 characters" }).optional(),
});

interface Farmer {
  id: string;
  name: string;
}

export default function Advances() {
  const { currentStation, userStations, isAdmin } = useStation();
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
  }, [currentStation]);

  const fetchData = async () => {
    try {
      // Build advances query with station filter
      let advancesQuery = supabase.from("farmer_advances").select("*, stations(name, code)").order("created_at", { ascending: false });
      if (currentStation) {
        advancesQuery = advancesQuery.eq('station_id', currentStation.id);
      }

      // Build farmers query with station filter
      let farmersQuery = supabase.from("farmers").select("id, name").order("name");
      if (currentStation) {
        farmersQuery = farmersQuery.eq('station_id', currentStation.id);
      }

      const [advancesRes, farmersRes] = await Promise.all([
        advancesQuery,
        farmersQuery
      ]);

      if (advancesRes.error) throw advancesRes.error;
      if (farmersRes.error) throw farmersRes.error;

      // Manually join farmer names
      const farmersMap = new Map(farmersRes.data?.map(f => [f.id, f.name]));
      const advancesWithFarmers = (advancesRes.data || []).map(advance => ({
        ...advance,
        farmers: { name: farmersMap.get(advance.farmer_id) || 'Unknown' },
      }));

      setAdvances(advancesWithFarmers);
      setFarmers(farmersRes.data || []);
    } catch (error: any) {
      toast.error(getUserFriendlyError(error, "fetchAdvances"));
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

    const stationId = currentStation?.id || (userStations.length === 1 ? userStations[0].id : null);
    
    if (!stationId && !isAdmin) {
      toast.error("Please select a station first");
      return;
    }

    try {
      const validatedData = advanceSchema.parse({
        farmer_id: formData.farmer_id,
        amount: parseFloat(formData.amount),
        purpose: formData.purpose,
      });
      
      const { error } = await supabase.from("farmer_advances").insert({
        farmer_id: validatedData.farmer_id,
        amount: validatedData.amount,
        balance: validatedData.amount,
        purpose: validatedData.purpose || null,
        recorded_by: user.id,
        station_id: stationId,
      });

      if (error) throw error;

      toast.success("Advance recorded successfully");
      setOpen(false);
      setFormData({ farmer_id: "", amount: "", purpose: "" });
      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(error, "recordAdvance"));
      }
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
                {advance.stations && isAdmin && (
                  <div>
                    <p className="text-sm text-muted-foreground">Station</p>
                    <div className="flex items-center gap-1 text-primary">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm font-medium">{advance.stations.code}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
