import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Calendar, Weight, Building2, Receipt, TrendingUp,
  Users, User, Download, Loader2, ChevronDown, ChevronRight,
} from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";
import DeliveryReceipt from "@/components/DeliveryReceipt";

// ─── Schema ───────────────────────────────────────────────────────────────────

const deliverySchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  delivery_date: z.string().nonempty({ message: "Delivery date is required" }),
  quantity_kg: z.number().positive({ message: "Quantity must be greater than 0" }).max(100000),
  price_per_kg: z.number().positive({ message: "Price must be greater than 0" }).max(10000),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Delivery {
  id: string;
  farmer_id: string;
  delivery_date: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  station_id: string | null;
  farmers: { name: string; farmer_type: string | null };
  stations?: { name: string; code: string } | null;
}

interface Farmer {
  id: string;
  name: string;
  farmer_type: string | null;
}

interface FarmerBalance {
  farmer_id: string;
  farmer_name: string;
  farmer_type: string;
  total_kg: number;
  total_delivery_value: number;
  total_advances: number;
  total_payments: number;
  // positive = we owe farmer; negative = farmer still has advance credit
  net_balance: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Farmer type badge ────────────────────────────────────────────────────────

const FarmerTypeBadge = ({ type }: { type: string | null }) =>
  type === "acheteur" ? (
    <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
      <Building2 className="w-3 h-3 mr-1" />Big Farmer
    </Badge>
  ) : (
    <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
      <User className="w-3 h-3 mr-1" />Small Farmer
    </Badge>
  );

// ─── Main Page ────────────────────────────────────────────────────────────────

const Deliveries = () => {
  const { currentStation, userStations, isAdmin } = useStation();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [advances, setAdvances] = useState<{ farmer_id: string; balance: number }[]>([]);
  const [payments, setPayments] = useState<{ farmer_id: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedFarmer, setExpandedFarmer] = useState<string | null>(null);

  // Report filters
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterFarmerType, setFilterFarmerType] = useState<"all" | "small" | "acheteur">("all");
  const [filterFarmerId, setFilterFarmerId] = useState("all");

  const [receiptData, setReceiptData] = useState<null | {
    farmerName: string; stationName: string; deliveryDate: string;
    quantityKg: number; pricePerKg: number; totalAmount: number; receiptNumber: string;
  }>(null);

  const [formData, setFormData] = useState({
    farmer_id: "", quantity_kg: "", price_per_kg: "",
    delivery_date: new Date().toISOString().split("T")[0],
  });

  const stationId = currentStation?.id ?? (userStations.length === 1 ? userStations[0].id : null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let dQ = supabase
        .from("cherry_deliveries")
        .select("*, farmers(name, farmer_type), stations(name, code)")
        .order("delivery_date", { ascending: false })
        .limit(200);
      if (currentStation) dQ = dQ.eq("station_id", currentStation.id);
      const { data: dData, error: dErr } = await dQ;
      if (dErr) throw dErr;

      let fQ = supabase.from("farmers").select("id, name, farmer_type").order("name");
      if (currentStation) fQ = fQ.eq("station_id", currentStation.id);
      const { data: fData, error: fErr } = await fQ;
      if (fErr) throw fErr;

      // Fetch active advances balances
      let aQ = supabase.from("farmer_advances").select("farmer_id, balance").eq("status", "active");
      if (currentStation) aQ = aQ.eq("station_id", currentStation.id);
      const { data: aData } = await aQ;

      // Fetch payments
      let pQ = supabase.from("payments").select("farmer_id, amount");
      if (currentStation) pQ = pQ.eq("station_id", currentStation.id);
      const { data: pData } = await pQ;

      setDeliveries((dData ?? []) as Delivery[]);
      setFarmers((fData ?? []) as Farmer[]);
      setAdvances(aData ?? []);
      setPayments(pData ?? []);
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error, "fetchDeliveries"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentStation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Farmer balances ──────────────────────────────────────────────────────────
  const farmerBalances = useMemo<FarmerBalance[]>(() => {
    return farmers.map(farmer => {
      const farmerDeliveries = deliveries.filter(d => d.farmer_id === farmer.id);
      const total_kg = farmerDeliveries.reduce((s, d) => s + Number(d.quantity_kg), 0);
      const total_delivery_value = farmerDeliveries.reduce((s, d) => s + Number(d.total_amount), 0);
      const total_advances = advances
        .filter(a => a.farmer_id === farmer.id)
        .reduce((s, a) => s + Number(a.balance), 0);
      const total_payments = payments
        .filter(p => p.farmer_id === farmer.id)
        .reduce((s, p) => s + Number(p.amount), 0);
      // Balance = deliveries - advances_outstanding - payments_made
      const net_balance = total_delivery_value - total_advances - total_payments;
      return {
        farmer_id: farmer.id,
        farmer_name: farmer.name,
        farmer_type: farmer.farmer_type ?? "small",
        total_kg,
        total_delivery_value,
        total_advances,
        total_payments,
        net_balance,
      };
    }).filter(b => b.total_kg > 0 || b.total_advances > 0);
  }, [farmers, deliveries, advances, payments]);

  // ── Submit delivery ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    try {
      const validated = deliverySchema.parse({
        farmer_id: formData.farmer_id,
        delivery_date: formData.delivery_date,
        quantity_kg: parseFloat(formData.quantity_kg),
        price_per_kg: parseFloat(formData.price_per_kg),
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const totalAmount = validated.quantity_kg * validated.price_per_kg;

      // Try inserting WITH total_amount first; if that fails (e.g. generated column),
      // retry without it so the DB trigger calculates it automatically.
      let insertError: any = null;

      const withTotal = await supabase.from("cherry_deliveries").insert([{
        farmer_id: validated.farmer_id,
        quantity_kg: validated.quantity_kg,
        price_per_kg: validated.price_per_kg,
        total_amount: totalAmount,
        delivery_date: validated.delivery_date,
        recorded_by: user.id,
        station_id: stationId,
      }]);
      insertError = withTotal.error;

      // If that failed, retry without total_amount (let the DB compute it)
      if (insertError) {
        console.warn("Insert with total_amount failed, retrying without:", insertError.message);
        const withoutTotal = await supabase.from("cherry_deliveries").insert([{
          farmer_id: validated.farmer_id,
          quantity_kg: validated.quantity_kg,
          price_per_kg: validated.price_per_kg,
          delivery_date: validated.delivery_date,
          recorded_by: user.id,
          station_id: stationId,
        }]);
        if (withoutTotal.error) {
          console.error("Delivery insert error:", withoutTotal.error);
          throw withoutTotal.error;
        }
      }

      // Auto-reduce active advances for this farmer (fire-and-forget — never block the delivery)
      try {
        const { data: farmerAdvances } = await supabase
          .from("farmer_advances")
          .select("id, balance, amount_recovered")
          .eq("farmer_id", validated.farmer_id)
          .in("status", ["active", "partial"])
          .order("created_at", { ascending: true });

        if (farmerAdvances && farmerAdvances.length > 0) {
          let remaining = totalAmount;
          for (const adv of farmerAdvances) {
            if (remaining <= 0) break;
            const advBalance = Number(adv.balance);
            const alreadyRecovered = Number(adv.amount_recovered);
            if (remaining >= advBalance) {
              await supabase.from("farmer_advances").update({
                amount_recovered: alreadyRecovered + advBalance,
                balance: 0,
                status: "recovered",
              }).eq("id", adv.id);
              remaining -= advBalance;
            } else {
              await supabase.from("farmer_advances").update({
                amount_recovered: alreadyRecovered + remaining,
                balance: advBalance - remaining,
                status: "partial",
              }).eq("id", adv.id);
              remaining = 0;
            }
          }
        }
      } catch (advErr) {
        // Don't fail the whole delivery if advance update fails
        console.warn("Advance auto-reduction failed (non-critical):", advErr);
      }

      const farmer = farmers.find(f => f.id === validated.farmer_id);
      setDialogOpen(false);
      setFormData({ farmer_id: "", quantity_kg: "", price_per_kg: "", delivery_date: new Date().toISOString().split("T")[0] });
      fetchData();

      setReceiptData({
        farmerName: farmer?.name || "Farmer",
        stationName: currentStation?.name || "Liza CWS",
        deliveryDate: validated.delivery_date,
        quantityKg: validated.quantity_kg,
        pricePerKg: validated.price_per_kg,
        totalAmount,
        receiptNumber: `DLV-${Date.now().toString().slice(-6)}`,
      });

      toast({ title: "Success", description: "Delivery recorded successfully." });
    } catch (error: any) {
      console.error("Record delivery error:", error);
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        // Show the real Supabase error message instead of the generic one
        const msg = error?.message || error?.details || "Failed to record delivery. Check console for details.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    }
  };

  // ── Filtered deliveries for report ──────────────────────────────────────────
  const filtered = useMemo(() => deliveries.filter(d => {
    if (filterFarmerType !== "all" && d.farmers?.farmer_type !== filterFarmerType) return false;
    if (filterFarmerId !== "all" && d.farmer_id !== filterFarmerId) return false;
    if (filterFrom && d.delivery_date < filterFrom) return false;
    if (filterTo && d.delivery_date > filterTo) return false;
    return true;
  }), [deliveries, filterFarmerType, filterFarmerId, filterFrom, filterTo]);

  const smallDeliveries = deliveries.filter(d => d.farmers?.farmer_type !== "acheteur");
  const bigDeliveries = deliveries.filter(d => d.farmers?.farmer_type === "acheteur");

  const totalKgAll = deliveries.reduce((s, d) => s + Number(d.quantity_kg), 0);
  const totalValueAll = deliveries.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalKgSmall = smallDeliveries.reduce((s, d) => s + Number(d.quantity_kg), 0);
  const totalKgBig = bigDeliveries.reduce((s, d) => s + Number(d.quantity_kg), 0);

  const selectedFarmer = farmers.find(f => f.id === formData.farmer_id);
  const selectedFarmerBalance = farmerBalances.find(b => b.farmer_id === formData.farmer_id);

  const exportCSV = () => {
    downloadCSV("deliveries_report.csv",
      filtered.map(d => [
        d.delivery_date,
        d.farmers?.name ?? "",
        d.farmers?.farmer_type === "acheteur" ? "Big Farmer" : "Small Farmer",
        String(d.quantity_kg),
        String(d.price_per_kg),
        String(d.total_amount),
        d.stations?.name ?? "",
      ]),
      ["Date", "Farmer", "Type", "Qty (kg)", "Price/kg", "Total (RWF)", "Station"]
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {receiptData && (
        <DeliveryReceipt
          type="delivery"
          receiptNumber={receiptData.receiptNumber}
          farmerName={receiptData.farmerName}
          stationName={receiptData.stationName}
          date={receiptData.deliveryDate}
          quantityKg={receiptData.quantityKg}
          pricePerKg={receiptData.pricePerKg}
          totalAmount={receiptData.totalAmount}
          onClose={() => setReceiptData(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cherry Deliveries</h1>
          <p className="text-muted-foreground">Record and track cherry deliveries by farmer type</p>
        </div>
        <div className="flex items-center gap-2">
          {currentStation && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{currentStation.name}</span>
            </div>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-accent to-accent/90">
                <Plus className="mr-2 h-4 w-4" />Record Delivery
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Cherry Delivery</DialogTitle>
                <DialogDescription>Add a new cherry delivery to the system</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Farmer *</Label>
                  <Select value={formData.farmer_id} onValueChange={v => setFormData(f => ({ ...f, farmer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a farmer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__big__" disabled className="font-semibold text-blue-600">── Big Farmers (Acheteurs) ──</SelectItem>
                      {farmers.filter(f => f.farmer_type === "acheteur").map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                      <SelectItem value="__small__" disabled className="font-semibold text-green-600">── Small Farmers ──</SelectItem>
                      {farmers.filter(f => f.farmer_type !== "acheteur").map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFarmer && (
                    <div className="flex items-center gap-2">
                      <FarmerTypeBadge type={selectedFarmer.farmer_type} />
                      {selectedFarmerBalance && selectedFarmerBalance.total_advances > 0 && (
                        <span className="text-xs text-orange-600">
                          Active advance: {fmt(selectedFarmerBalance.total_advances)} — will be auto-reduced
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Delivery Date *</Label>
                  <Input type="date" value={formData.delivery_date}
                    onChange={e => setFormData(f => ({ ...f, delivery_date: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity (kg) *</Label>
                    <Input type="number" step="0.01" placeholder="0.00"
                      value={formData.quantity_kg}
                      onChange={e => setFormData(f => ({ ...f, quantity_kg: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Price per kg (RWF) *</Label>
                    <Input type="number" step="0.01" placeholder="0.00"
                      value={formData.price_per_kg}
                      onChange={e => setFormData(f => ({ ...f, price_per_kg: e.target.value }))} required />
                  </div>
                </div>
                {formData.quantity_kg && formData.price_per_kg && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <p className="text-sm font-medium">
                      Total: {fmt(parseFloat(formData.quantity_kg) * parseFloat(formData.price_per_kg))}
                    </p>
                    {selectedFarmerBalance && selectedFarmerBalance.total_advances > 0 && (
                      <>
                        <p className="text-xs text-orange-600">
                          Advance outstanding: {fmt(selectedFarmerBalance.total_advances)}
                        </p>
                        {(() => {
                          const deliveryVal = parseFloat(formData.quantity_kg) * parseFloat(formData.price_per_kg);
                          const adv = selectedFarmerBalance.total_advances;
                          if (deliveryVal >= adv) {
                            return <p className="text-xs text-green-600">Advance fully cleared. Owed to farmer: {fmt(deliveryVal - adv)}</p>;
                          } else {
                            return <p className="text-xs text-orange-600">Remaining advance after delivery: {fmt(adv - deliveryVal)}</p>;
                          }
                        })()}
                      </>
                    )}
                  </div>
                )}
                <Button type="submit" className="w-full">Record Delivery</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deliveries</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalKgAll.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground">{fmt(totalValueAll)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Small Farmers</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{totalKgSmall.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground">{smallDeliveries.length} deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Big Farmers</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">{totalKgBig.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground">{bigDeliveries.length} deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Farmers Active</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{farmerBalances.length}</p>
            <p className="text-xs text-muted-foreground">with deliveries</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="by-type">
        <TabsList>
          <TabsTrigger value="by-type">By Farmer Type</TabsTrigger>
          <TabsTrigger value="balances">Farmer Balances</TabsTrigger>
          <TabsTrigger value="all">All Deliveries</TabsTrigger>
          <TabsTrigger value="report">Report & Filter</TabsTrigger>
        </TabsList>

        {/* ── By Farmer Type ── */}
        <TabsContent value="by-type" className="space-y-6 mt-4">
          {/* Big Farmers */}
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-blue-700 mb-3">
              <Building2 className="w-4 h-4" />Big Farmers (Acheteurs)
              <Badge className="bg-blue-100 text-blue-700 ml-1">{bigDeliveries.length}</Badge>
            </h2>
            {bigDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground pl-2">No deliveries from big farmers yet.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead className="text-right">Qty (kg)</TableHead>
                      <TableHead className="text-right">Price/kg</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bigDeliveries.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{fmtDate(d.delivery_date)}</TableCell>
                        <TableCell className="font-medium">{d.farmers?.name}</TableCell>
                        <TableCell className="text-right">{Number(d.quantity_kg).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{Number(d.price_per_kg).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(d.total_amount)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setReceiptData({
                            farmerName: d.farmers?.name ?? "",
                            stationName: d.stations?.name || currentStation?.name || "Liza CWS",
                            deliveryDate: d.delivery_date,
                            quantityKg: d.quantity_kg,
                            pricePerKg: d.price_per_kg,
                            totalAmount: d.total_amount,
                            receiptNumber: `DLV-${d.id.slice(-6).toUpperCase()}`,
                          })}>
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-right">{totalKgBig.toFixed(1)} kg</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{fmt(bigDeliveries.reduce((s, d) => s + Number(d.total_amount), 0))}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Small Farmers */}
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-green-700 mb-3">
              <User className="w-4 h-4" />Small Farmers
              <Badge className="bg-green-100 text-green-700 ml-1">{smallDeliveries.length}</Badge>
            </h2>
            {smallDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground pl-2">No deliveries from small farmers yet.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead className="text-right">Qty (kg)</TableHead>
                      <TableHead className="text-right">Price/kg</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smallDeliveries.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{fmtDate(d.delivery_date)}</TableCell>
                        <TableCell className="font-medium">{d.farmers?.name}</TableCell>
                        <TableCell className="text-right">{Number(d.quantity_kg).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{Number(d.price_per_kg).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(d.total_amount)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setReceiptData({
                            farmerName: d.farmers?.name ?? "",
                            stationName: d.stations?.name || currentStation?.name || "Liza CWS",
                            deliveryDate: d.delivery_date,
                            quantityKg: d.quantity_kg,
                            pricePerKg: d.price_per_kg,
                            totalAmount: d.total_amount,
                            receiptNumber: `DLV-${d.id.slice(-6).toUpperCase()}`,
                          })}>
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-right">{totalKgSmall.toFixed(1)} kg</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{fmt(smallDeliveries.reduce((s, d) => s + Number(d.total_amount), 0))}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Farmer Balances ── */}
        <TabsContent value="balances" className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">
            Balance = Delivery Value − Active Advances − Payments Made
          </p>
          {farmerBalances.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No data yet.</CardContent></Card>
          ) : (
            farmerBalances.map(fb => (
              <Card key={fb.farmer_id}>
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors rounded-lg"
                  onClick={() => setExpandedFarmer(expandedFarmer === fb.farmer_id ? null : fb.farmer_id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedFarmer === fb.farmer_id
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <span className="font-semibold">{fb.farmer_name}</span>
                      <div className="mt-0.5"><FarmerTypeBadge type={fb.farmer_type} /></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${fb.net_balance >= 0 ? "text-green-700" : "text-destructive"}`}>
                      {fmt(Math.abs(fb.net_balance))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fb.net_balance > 0 ? "We owe farmer" : fb.net_balance < 0 ? "Farmer has credit" : "Settled"}
                    </p>
                  </div>
                </button>
                {expandedFarmer === fb.farmer_id && (
                  <CardContent className="pt-0 pb-4 px-6 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total KG</p>
                        <p className="font-semibold">{fb.total_kg.toFixed(1)} kg</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Delivery Value</p>
                        <p className="font-semibold text-primary">{fmt(fb.total_delivery_value)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Active Advances</p>
                        <p className="font-semibold text-orange-600">{fmt(fb.total_advances)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payments Made</p>
                        <p className="font-semibold text-green-700">{fmt(fb.total_payments)}</p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── All Deliveries ── */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Farmer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty (kg)</TableHead>
                    <TableHead className="text-right">Price/kg</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {isAdmin && <TableHead>Station</TableHead>}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.delivery_date)}</TableCell>
                      <TableCell className="font-medium">{d.farmers?.name}</TableCell>
                      <TableCell><FarmerTypeBadge type={d.farmers?.farmer_type ?? null} /></TableCell>
                      <TableCell className="text-right">{Number(d.quantity_kg).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{Number(d.price_per_kg).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmt(d.total_amount)}</TableCell>
                      {isAdmin && <TableCell className="text-xs text-muted-foreground">{d.stations?.code ?? "—"}</TableCell>}
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setReceiptData({
                          farmerName: d.farmers?.name ?? "",
                          stationName: d.stations?.name || currentStation?.name || "Liza CWS",
                          deliveryDate: d.delivery_date,
                          quantityKg: d.quantity_kg,
                          pricePerKg: d.price_per_kg,
                          totalAmount: d.total_amount,
                          receiptNumber: `DLV-${d.id.slice(-6).toUpperCase()}`,
                        })}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Report & Filter ── */}
        <TabsContent value="report" className="space-y-4 mt-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Farmer Type</Label>
                  <Select value={filterFarmerType} onValueChange={(v: any) => setFilterFarmerType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="small">Small Farmers</SelectItem>
                      <SelectItem value="acheteur">Big Farmers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Farmer</Label>
                  <Select value={filterFarmerId} onValueChange={setFilterFarmerId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Farmers</SelectItem>
                      {farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterFarmerType("all"); setFilterFarmerId("all"); }}>
                  Clear Filters
                </Button>
                <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
                  <Download className="w-4 h-4 mr-2" />Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filtered summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Filtered Qty", value: `${filtered.reduce((s, d) => s + Number(d.quantity_kg), 0).toFixed(1)} kg`, color: "text-foreground" },
              { label: "Filtered Value", value: fmt(filtered.reduce((s, d) => s + Number(d.total_amount), 0)), color: "text-primary" },
              { label: "Deliveries", value: String(filtered.length), color: "text-foreground" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${color}`}>{value}</p></CardContent>
              </Card>
            ))}
          </div>

          {/* Filtered table */}
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No deliveries match the selected filters.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty (kg)</TableHead>
                      <TableHead className="text-right">Price/kg</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{fmtDate(d.delivery_date)}</TableCell>
                        <TableCell className="font-medium">{d.farmers?.name}</TableCell>
                        <TableCell><FarmerTypeBadge type={d.farmers?.farmer_type ?? null} /></TableCell>
                        <TableCell className="text-right">{Number(d.quantity_kg).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{Number(d.price_per_kg).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(d.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right">{filtered.reduce((s, d) => s + Number(d.quantity_kg), 0).toFixed(1)} kg</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{fmt(filtered.reduce((s, d) => s + Number(d.total_amount), 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Deliveries;
