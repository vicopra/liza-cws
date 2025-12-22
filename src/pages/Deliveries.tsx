import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Calendar, Weight } from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";

const deliverySchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  delivery_date: z.string().nonempty({ message: "Delivery date is required" }),
  quantity_kg: z.number().positive({ message: "Quantity must be greater than 0" }).max(100000, { message: "Quantity must be less than 100,000 kg" }),
  price_per_kg: z.number().positive({ message: "Price must be greater than 0" }).max(10000, { message: "Price must be less than 10,000" }),
});

interface Delivery {
  id: string;
  delivery_date: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  farmers: { name: string };
}

interface Farmer {
  id: string;
  name: string;
}

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    farmer_id: "",
    quantity_kg: "",
    price_per_kg: "",
    delivery_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch deliveries
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('cherry_deliveries')
        .select('*, farmers(name)')
        .order('delivery_date', { ascending: false })
        .limit(50);

      if (deliveriesError) throw deliveriesError;
      setDeliveries(deliveriesData || []);

      // Fetch farmers
      const { data: farmersData, error: farmersError } = await supabase
        .from('farmers')
        .select('id, name')
        .order('name');

      if (farmersError) throw farmersError;
      setFarmers(farmersData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error, "fetchDeliveries"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = deliverySchema.parse({
        farmer_id: formData.farmer_id,
        delivery_date: formData.delivery_date,
        quantity_kg: parseFloat(formData.quantity_kg),
        price_per_kg: parseFloat(formData.price_per_kg),
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('cherry_deliveries')
        .insert([{
          farmer_id: validatedData.farmer_id,
          quantity_kg: validatedData.quantity_kg,
          price_per_kg: validatedData.price_per_kg,
          delivery_date: validatedData.delivery_date,
          recorded_by: user.id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Delivery recorded successfully",
      });

      setDialogOpen(false);
      setFormData({
        farmer_id: "",
        quantity_kg: "",
        price_per_kg: "",
        delivery_date: new Date().toISOString().split('T')[0],
      });
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
          description: getUserFriendlyError(error, "recordDelivery"),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cherry Deliveries</h1>
          <p className="text-muted-foreground">Record and track cherry deliveries</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-accent to-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              Record Delivery
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Cherry Delivery</DialogTitle>
              <DialogDescription>
                Add a new cherry delivery to the system
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
                <Label htmlFor="date">Delivery Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
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
                <Label htmlFor="price">Price per kg (RWF) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price_per_kg}
                  onChange={(e) => setFormData({ ...formData, price_per_kg: e.target.value })}
                  required
                />
              </div>
              {formData.quantity_kg && formData.price_per_kg && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Total Amount: {new Intl.NumberFormat('en-RW', {
                      style: 'currency',
                      currency: 'RWF',
                    }).format(parseFloat(formData.quantity_kg) * parseFloat(formData.price_per_kg))}
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full">
                Record Delivery
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {deliveries.map((delivery) => (
          <Card key={delivery.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{delivery.farmers.name}</span>
                <span className="text-lg font-bold text-primary">
                  {new Intl.NumberFormat('en-RW', {
                    style: 'currency',
                    currency: 'RWF',
                  }).format(delivery.total_amount)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(delivery.delivery_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {delivery.quantity_kg} kg @ {delivery.price_per_kg} RWF/kg
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Deliveries;
