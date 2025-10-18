import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Phone, MapPin, User } from "lucide-react";

interface Farmer {
  id: string;
  name: string;
  phone: string | null;
  id_number: string | null;
  village: string | null;
  created_at: string;
}

const Farmers = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    id_number: "",
    village: "",
  });

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFarmers(data || []);
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
      const { error } = await supabase
        .from('farmers')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Farmer registered successfully",
      });

      setDialogOpen(false);
      setFormData({ name: "", phone: "", id_number: "", village: "" });
      fetchFarmers();
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
          <h1 className="text-3xl font-bold tracking-tight">Farmers</h1>
          <p className="text-muted-foreground">Manage farmer registrations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Register Farmer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Farmer</DialogTitle>
              <DialogDescription>
                Add a new farmer to the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_number">ID Number</Label>
                <Input
                  id="id_number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="village">Village</Label>
                <Input
                  id="village"
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                Register Farmer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {farmers.map((farmer) => (
          <Card key={farmer.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {farmer.name}
              </CardTitle>
              <CardDescription>
                Registered {new Date(farmer.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {farmer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{farmer.phone}</span>
                </div>
              )}
              {farmer.village && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{farmer.village}</span>
                </div>
              )}
              {farmer.id_number && (
                <div className="text-sm text-muted-foreground">
                  ID: {farmer.id_number}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Farmers;
