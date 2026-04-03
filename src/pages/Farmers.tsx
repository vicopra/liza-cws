import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Phone, MapPin, User, Building2, Search, Printer,
  Download, Users, TrendingUp, X, Eye, Pencil,
} from "lucide-react";
import { useStation } from "@/contexts/StationContext";
import { format } from "date-fns";

interface Farmer {
  id: string;
  name: string;
  phone: string | null;
  id_number: string | null;
  village: string | null;
  cell: string | null;
  farmer_type: string | null;
  notes: string | null;
  station_id: string | null;
  created_at: string;
  stations?: { name: string; code: string } | null;
}

interface Delivery {
  id: string;
  farmer_id: string;
  delivery_date: string;
  quantity_kg: number;
  price_per_kg: number | null;
  station_id: string | null;
}

interface Payment {
  id: string;
  farmer_id: string;
  payment_date: string;
  amount: number;
  payment_type: string;
  notes: string | null;
}

const emptyForm = {
  name: "", phone: "", id_number: "", village: "",
  cell: "", farmer_type: "small", notes: "",
};

// ─── FarmerFormFields is defined OUTSIDE Farmers so React never remounts it ──

interface FarmerFormFieldsProps {
  data: typeof emptyForm;
  setData: (d: typeof emptyForm) => void;
}

const FarmerFormFields = ({ data, setData }: FarmerFormFieldsProps) => (
  <>
    <div>
      <Label>Farmer Type *</Label>
      <Select value={data.farmer_type} onValueChange={v => setData({ ...data, farmer_type: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="small">Small Farmer</SelectItem>
          <SelectItem value="acheteur">Big Farmer (Acheteur)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <Label>Full Name *</Label>
      <Input
        placeholder="Enter full name"
        value={data.name}
        onChange={e => setData({ ...data, name: e.target.value })}
        required
      />
    </div>
    <div>
      <Label>Phone Number</Label>
      <div className="relative">
        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="0781234567"
          value={data.phone}
          onChange={e => setData({ ...data, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Cell</Label>
        <Input
          placeholder="Administrative cell"
          value={data.cell}
          onChange={e => setData({ ...data, cell: e.target.value })}
        />
      </div>
      <div>
        <Label>Village</Label>
        <Input
          placeholder="Village name"
          value={data.village}
          onChange={e => setData({ ...data, village: e.target.value })}
        />
      </div>
    </div>
    <div>
      <Label>National ID</Label>
      <Input
        placeholder="16-digit ID number"
        value={data.id_number}
        onChange={e => setData({ ...data, id_number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
      />
    </div>
    <div>
      <Label>Notes (Optional)</Label>
      <Textarea
        placeholder="Any additional information..."
        value={data.notes}
        onChange={e => setData({ ...data, notes: e.target.value })}
      />
    </div>
  </>
);

// ─── Main Farmers Page ────────────────────────────────────────────────────────

const Farmers = () => {
  const { currentStation, userStations, isAdmin } = useStation();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "small" | "acheteur">("all");
  const [formData, setFormData] = useState(emptyForm);
  const [editData, setEditData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchFarmers(); }, [currentStation]);

  const fetchFarmers = async () => {
    try {
      let query = supabase
        .from('farmers')
        .select('*, stations(name, code)')
        .order('name', { ascending: true });
      if (currentStation) query = query.eq('station_id', currentStation.id);
      const { data, error } = await query;
      if (error) throw error;
      setFarmers(data || []);

      let dQuery = supabase.from('cherry_deliveries').select('*');
      if (currentStation) dQuery = dQuery.eq('station_id', currentStation.id);
      const { data: dData } = await dQuery;
      setDeliveries(dData || []);

      let pQuery = supabase.from('payments').select('*');
      if (currentStation) pQuery = pQuery.eq('station_id', currentStation.id);
      const { data: pData } = await pQuery;
      setPayments(pData || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stationId = currentStation?.id || (userStations.length === 1 ? userStations[0].id : null);
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Full name is required", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from('farmers').insert([{
        name: formData.name.trim(),
        phone: formData.phone || null,
        id_number: formData.id_number || null,
        village: formData.village || null,
        cell: formData.cell || null,
        farmer_type: formData.farmer_type,
        notes: formData.notes || null,
        station_id: stationId,
      }]);
      if (error) throw error;
      toast({ title: "Success", description: "Farmer registered successfully" });
      setDialogOpen(false);
      setFormData(emptyForm);
      fetchFarmers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (farmer: Farmer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFarmer(farmer);
    setEditData({
      name: farmer.name,
      phone: farmer.phone || "",
      id_number: farmer.id_number || "",
      village: farmer.village || "",
      cell: farmer.cell || "",
      farmer_type: farmer.farmer_type || "small",
      notes: farmer.notes || "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmer) return;
    if (!editData.name.trim()) {
      toast({ title: "Error", description: "Full name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('farmers')
        .update({
          name: editData.name.trim(),
          phone: editData.phone || null,
          id_number: editData.id_number || null,
          village: editData.village || null,
          cell: editData.cell || null,
          farmer_type: editData.farmer_type,
          notes: editData.notes || null,
        })
        .eq('id', selectedFarmer.id);
      if (error) throw error;
      toast({ title: "Success", description: "Farmer updated successfully" });
      setEditOpen(false);
      setProfileOpen(false);
      fetchFarmers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getFarmerStats = (farmerId: string) => {
    const farmerDeliveries = deliveries.filter(d => d.farmer_id === farmerId);
    const farmerPayments = payments.filter(p => p.farmer_id === farmerId);
    const totalKg = farmerDeliveries.reduce((sum, d) => sum + Number(d.quantity_kg), 0);
    const totalDeliveries = farmerDeliveries.length;
    const totalPaid = farmerPayments.filter(p => p.payment_type === 'payment').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAdvances = farmerPayments.filter(p => p.payment_type === 'advance').reduce((sum, p) => sum + Number(p.amount), 0);
    return { totalKg, totalDeliveries, totalPaid, totalAdvances };
  };

  const filteredFarmers = farmers.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.phone?.includes(searchQuery) ||
      f.village?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cell?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || f.farmer_type === filterType;
    return matchesSearch && matchesType;
  });

  const smallFarmers = farmers.filter(f => f.farmer_type === 'small' || !f.farmer_type);
  const acheteurs = farmers.filter(f => f.farmer_type === 'acheteur');
  const totalKgAll = deliveries.reduce((sum, d) => sum + Number(d.quantity_kg), 0);

  const exportCSV = () => {
    const headers = ["Name", "Type", "Phone", "Cell", "Village", "ID Number", "Total Deliveries", "Total KG", "Total Paid", "Notes"];
    const rows = filteredFarmers.map(f => {
      const stats = getFarmerStats(f.id);
      return [f.name, f.farmer_type === 'acheteur' ? 'Acheteur' : 'Small Farmer',
        f.phone || '', f.cell || '', f.village || '', f.id_number || '',
        stats.totalDeliveries, stats.totalKg.toFixed(2), stats.totalPaid, f.notes || ''];
    });
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `farmers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "Success", description: "Farmers list exported" });
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-farmers, #printable-farmers * { visibility: visible; }
          #printable-farmers { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Farmers</h1>
            <p className="text-muted-foreground">Manage farmer registrations and records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />Print List
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Register Farmer</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Register New Farmer</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <FarmerFormFields data={formData} setData={setFormData} />
                  <Button type="submit" className="w-full">Register Farmer</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Edit Farmer Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-500" />
                Edit Farmer — {selectedFarmer?.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <FarmerFormFields data={editData} setData={setEditData} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 no-print">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Farmers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{farmers.length}</div>
              <p className="text-xs text-muted-foreground">All registered farmers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Small Farmers</CardTitle>
              <User className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{smallFarmers.length}</div>
              <p className="text-xs text-muted-foreground">Individual farmers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acheteurs</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{acheteurs.length}</div>
              <p className="text-xs text-muted-foreground">Big farmers / buyers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total KG Delivered</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalKgAll.toFixed(0)} kg</div>
              <p className="text-xs text-muted-foreground">All time deliveries</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 flex-wrap no-print">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search by name, phone, village, cell..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex rounded-lg border overflow-hidden">
            {(["all", "small", "acheteur"] as const).map(type => (
              <button key={type} onClick={() => setFilterType(type)}
                className={`px-4 py-2 text-sm transition-colors ${filterType === type ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                {type === "all" ? "All" : type === "small" ? "Small Farmers" : "Acheteurs"}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="list" className="no-print">
          <TabsList>
            <TabsTrigger value="list">Card View</TabsTrigger>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>

          {/* Card List View */}
          <TabsContent value="list">
            {filteredFarmers.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                No farmers found. {searchQuery && "Try a different search."}
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFarmers.map(farmer => {
                  const stats = getFarmerStats(farmer.id);
                  return (
                    <Card key={farmer.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-full ${farmer.farmer_type === 'acheteur' ? 'bg-blue-100' : 'bg-green-100'}`}>
                              {farmer.farmer_type === 'acheteur'
                                ? <Building2 className="h-4 w-4 text-blue-600" />
                                : <User className="h-4 w-4 text-green-600" />}
                            </div>
                            <div>
                              <CardTitle className="text-base">{farmer.name}</CardTitle>
                              <Badge variant="outline" className={`text-xs mt-1 ${farmer.farmer_type === 'acheteur' ? 'text-blue-600 border-blue-300' : 'text-green-600 border-green-300'}`}>
                                {farmer.farmer_type === 'acheteur' ? 'Acheteur' : 'Small Farmer'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={e => openEditDialog(farmer, e)}>
                              <Pencil className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { setSelectedFarmer(farmer); setProfileOpen(true); }}>
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {farmer.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" /><span>{farmer.phone}</span>
                          </div>
                        )}
                        {(farmer.cell || farmer.village) && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{[farmer.cell, farmer.village].filter(Boolean).join(", ")}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Deliveries</p>
                            <p className="font-bold text-sm">{stats.totalDeliveries}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Total KG</p>
                            <p className="font-bold text-sm">{stats.totalKg.toFixed(1)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Table View */}
          <TabsContent value="table">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Cell</TableHead>
                      <TableHead>Village</TableHead>
                      <TableHead className="text-center">Deliveries</TableHead>
                      <TableHead className="text-right">Total KG</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFarmers.map((farmer, i) => {
                      const stats = getFarmerStats(farmer.id);
                      return (
                        <TableRow key={farmer.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{farmer.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={farmer.farmer_type === 'acheteur' ? 'text-blue-600 border-blue-300' : 'text-green-600 border-green-300'}>
                              {farmer.farmer_type === 'acheteur' ? 'Acheteur' : 'Small'}
                            </Badge>
                          </TableCell>
                          <TableCell>{farmer.phone || "-"}</TableCell>
                          <TableCell>{farmer.cell || "-"}</TableCell>
                          <TableCell>{farmer.village || "-"}</TableCell>
                          <TableCell className="text-center">{stats.totalDeliveries}</TableCell>
                          <TableCell className="text-right">{stats.totalKg.toFixed(1)} kg</TableCell>
                          <TableCell className="text-right">{stats.totalPaid.toLocaleString()} RWF</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => openEditDialog(farmer)}>
                                <Pencil className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => { setSelectedFarmer(farmer); setProfileOpen(true); }}>
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report Tab */}
          <TabsContent value="report">
            <div className="flex gap-2 mb-4">
              <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print Report</Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Farmer Delivery & Payment Summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {currentStation ? currentStation.name : "All Stations"} — Generated {format(new Date(), "MMMM dd, yyyy")}
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Cell</TableHead>
                      <TableHead>Village</TableHead>
                      <TableHead className="text-center">Deliveries</TableHead>
                      <TableHead className="text-right">Total KG</TableHead>
                      <TableHead className="text-right">Paid (RWF)</TableHead>
                      <TableHead className="text-right">Advances (RWF)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFarmers.map((farmer, i) => {
                      const stats = getFarmerStats(farmer.id);
                      return (
                        <TableRow key={farmer.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{farmer.name}</TableCell>
                          <TableCell>{farmer.farmer_type === 'acheteur' ? 'Acheteur' : 'Small'}</TableCell>
                          <TableCell>{farmer.phone || "-"}</TableCell>
                          <TableCell>{farmer.cell || "-"}</TableCell>
                          <TableCell>{farmer.village || "-"}</TableCell>
                          <TableCell className="text-center">{stats.totalDeliveries}</TableCell>
                          <TableCell className="text-right">{stats.totalKg.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{stats.totalPaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{stats.totalAdvances.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={6}>TOTAL</TableCell>
                      <TableCell className="text-center">{filteredFarmers.reduce((s, f) => s + getFarmerStats(f.id).totalDeliveries, 0)}</TableCell>
                      <TableCell className="text-right">{filteredFarmers.reduce((s, f) => s + getFarmerStats(f.id).totalKg, 0).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{filteredFarmers.reduce((s, f) => s + getFarmerStats(f.id).totalPaid, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{filteredFarmers.reduce((s, f) => s + getFarmerStats(f.id).totalAdvances, 0).toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Printable List */}
        <div id="printable-farmers" className="hidden print:block">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">LIZA Coffee Washing Station</h2>
            <h3 className="text-lg">Farmer List Report</h3>
            <p className="text-sm">{currentStation ? currentStation.name : "All Stations"} — {format(new Date(), "MMMM dd, yyyy")}</p>
          </div>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2">#</th>
                <th className="border border-gray-300 p-2">Name</th>
                <th className="border border-gray-300 p-2">Type</th>
                <th className="border border-gray-300 p-2">Phone</th>
                <th className="border border-gray-300 p-2">Cell</th>
                <th className="border border-gray-300 p-2">Village</th>
                <th className="border border-gray-300 p-2">Total KG</th>
              </tr>
            </thead>
            <tbody>
              {filteredFarmers.map((farmer, i) => {
                const stats = getFarmerStats(farmer.id);
                return (
                  <tr key={farmer.id}>
                    <td className="border border-gray-300 p-2 text-center">{i + 1}</td>
                    <td className="border border-gray-300 p-2 font-medium">{farmer.name}</td>
                    <td className="border border-gray-300 p-2">{farmer.farmer_type === 'acheteur' ? 'Acheteur' : 'Small'}</td>
                    <td className="border border-gray-300 p-2">{farmer.phone || "-"}</td>
                    <td className="border border-gray-300 p-2">{farmer.cell || "-"}</td>
                    <td className="border border-gray-300 p-2">{farmer.village || "-"}</td>
                    <td className="border border-gray-300 p-2 text-right">{stats.totalKg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-4 text-center">Total: {filteredFarmers.length} farmers</p>
        </div>

        {/* Farmer Profile Dialog */}
        {selectedFarmer && (
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${selectedFarmer.farmer_type === 'acheteur' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      {selectedFarmer.farmer_type === 'acheteur'
                        ? <Building2 className="h-4 w-4 text-blue-600" />
                        : <User className="h-4 w-4 text-green-600" />}
                    </div>
                    {selectedFarmer.name}
                    <Badge variant="outline" className={selectedFarmer.farmer_type === 'acheteur' ? 'text-blue-600 border-blue-300' : 'text-green-600 border-green-300'}>
                      {selectedFarmer.farmer_type === 'acheteur' ? 'Acheteur' : 'Small Farmer'}
                    </Badge>
                  </DialogTitle>
                  <Button variant="outline" size="sm" className="mr-6"
                    onClick={() => { setProfileOpen(false); openEditDialog(selectedFarmer); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1 text-blue-500" />Edit
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{selectedFarmer.phone || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">National ID</p><p className="font-medium">{selectedFarmer.id_number || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Cell</p><p className="font-medium">{selectedFarmer.cell || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Village</p><p className="font-medium">{selectedFarmer.village || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Registered</p><p className="font-medium">{format(new Date(selectedFarmer.created_at), "MMM dd, yyyy")}</p></div>
                  {selectedFarmer.notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="font-medium">{selectedFarmer.notes}</p>
                    </div>
                  )}
                </div>

                {(() => {
                  const stats = getFarmerStats(selectedFarmer.id);
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <Card><CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
                        <p className="text-xs text-muted-foreground">Deliveries</p>
                      </CardContent></Card>
                      <Card><CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{stats.totalKg.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Total KG</p>
                      </CardContent></Card>
                      <Card><CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold">{stats.totalPaid.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Paid (RWF)</p>
                      </CardContent></Card>
                    </div>
                  );
                })()}

                <div>
                  <h4 className="font-semibold mb-2">Delivery History</h4>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">KG</TableHead>
                          <TableHead className="text-right">Price/KG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveries.filter(d => d.farmer_id === selectedFarmer.id).length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No deliveries yet</TableCell></TableRow>
                        ) : deliveries
                            .filter(d => d.farmer_id === selectedFarmer.id)
                            .sort((a, b) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime())
                            .map(d => (
                              <TableRow key={d.id}>
                                <TableCell>{format(new Date(d.delivery_date), "MMM dd, yyyy")}</TableCell>
                                <TableCell className="text-right">{Number(d.quantity_kg).toFixed(1)} kg</TableCell>
                                <TableCell className="text-right">{d.price_per_kg ? `${Number(d.price_per_kg).toLocaleString()} RWF` : "-"}</TableCell>
                              </TableRow>
                            ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Payment History</h4>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.filter(p => p.farmer_id === selectedFarmer.id).length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow>
                        ) : payments
                            .filter(p => p.farmer_id === selectedFarmer.id)
                            .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                            .map(p => (
                              <TableRow key={p.id}>
                                <TableCell>{format(new Date(p.payment_date), "MMM dd, yyyy")}</TableCell>
                                <TableCell><Badge variant={p.payment_type === 'advance' ? 'secondary' : 'default'}>{p.payment_type}</Badge></TableCell>
                                <TableCell className="text-right">{Number(p.amount).toLocaleString()} RWF</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{p.notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  );
};

export default Farmers;
