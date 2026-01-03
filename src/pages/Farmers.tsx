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
import { Plus, Phone, MapPin, User, CreditCard, Building2 } from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";

const farmerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  id_number: z.string().regex(/^\d{16}$/, "National ID must be exactly 16 digits"),
  village: z.string().min(1, "Village is required").max(100),
});

interface Farmer {
  id: string;
  name: string;
  phone: string | null;
  id_number: string | null;
  village: string | null;
  station_id: string | null;
  created_at: string;
  stations?: { name: string; code: string } | null;
}

const Farmers = () => {
  const { currentStation, userStations, isAdmin } = useStation();
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
  }, [currentStation]);

  const fetchFarmers = async () => {
    try {
      let query = supabase
        .from('farmers')
        .select('*, stations(name, code)')
        .order('created_at', { ascending: false });

      // Filter by station if one is selected
      if (currentStation) {
        query = query.eq('station_id', currentStation.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFarmers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error, "fetchFarmers"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require station selection for non-admins or when no current station
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
      const validatedData = farmerSchema.parse(formData);
      
      const { error } = await supabase
        .from('farmers')
        .insert([{
          name: validatedData.name,
          phone: validatedData.phone,
          id_number: validatedData.id_number,
          village: validatedData.village,
          station_id: stationId,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Farmer registered successfully",
      });

      setDialogOpen(false);
      setFormData({ name: "", phone: "", id_number: "", village: "" });
      fetchFarmers();
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
          description: getUserFriendlyError(error, "registerFarmer"),
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
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="0781234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="pl-10"
                    required
                    maxLength={10}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Exactly 10 digits required</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_number">National ID *</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="id_number"
                    placeholder="1234567890123456"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                    className="pl-10"
                    required
                    maxLength={16}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Exactly 16 digits required</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="village">Village *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="village"
                    placeholder="Enter village name"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
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
              {farmer.stations && isAdmin && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Building2 className="h-4 w-4" />
                  <span>{farmer.stations.code}</span>
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
