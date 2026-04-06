import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";
import { Building2, Receipt, User, Download, Loader2, TrendingDown, Plus } from "lucide-react";
import DeliveryReceipt from "@/components/DeliveryReceipt";

// ─── Schema ───────────────────────────────────────────────────────────────────

const advanceSchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(1000000),
  advance_date: z.string().nonempty({ message: "Date is required" }),
  purpose: z.string().trim().max(500).optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Advance {
  id: string;
  farmer_id: string;
  amount: number;
  amount_recovered: number;
  balance: number;
  advance_date: string;
  purpose: string | null;
  status: string;
  created_at: string;
  station_id: string | null;
  farmers?: { name: string; farmer_type: string | null };
  stations?: { name: string; code: string } | null;
}

interface Farmer {
  id: string;
  name: string;
  farmer_type: string | null;
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
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = { active: "default", partial: "secondary", recovered: "outline" };
  return <Badge variant={(map[status] ?? "outline") as any}>{status}</Badge>;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Advances() {
  const { currentStation, userStations, isAdmin } = useStation();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Filters
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFarmerType, setFilterFarmerType] = useState("all");

  const [receiptData, setReceiptData] = useState<null | {
    farmerName: string; stationName: string; date: string;
    amount: number; purpose: string; receiptNumber: string;
  }>(null);

  const [formData, setFormData] = useState({
    farmer_id: "", amount: "",
    advance_date: new Date().toISOString().split("T")[0],
    purpose: "",
  });

  const stationId = currentStation?.id ?? (userStations.length === 1 ? userStations[0].id : null);

  const fetchData = useCallback(async () => {
    try {
      let aQ = supabase
        .from("farmer_advances")
        .select("*, stations(name, code)")
        .order("advance_date", { ascending: false });
      if (currentStation) aQ = aQ.eq("station_id", currentStation.id);

      let fQ = supabase.from("farmers").select("id, name, farmer_type").order("name");
      if (currentStation) fQ = fQ.eq("station_id", currentStation.id);

      const [aRes, fRes] = await Promise.all([aQ, fQ]);
      if (aRes.error) throw aRes.error;
      if (fRes.error) throw fRes.error;

      const farmersMap = new Map(fRes.data?.map(f => [f.id, f]));
      const advancesWithFarmers = (aRes.data || []).map(adv => ({
        ...adv,
        farmers: farmersMap.get(adv.farmer_id) ?? { name: "Unknown", farmer_type: null },
      }));

      setAdvances(advancesWithFarmers);
      setFarmers(fRes.data || []);
    } catch (error: any) {
      toast.error(getUserFriendlyError(error, "fetchAdvances"));
    } finally {
      setLoading(false);
    }
  }, [currentStation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in"); return; }
    if (!stationId && !isAdmin) { toast.error("Please select a station first"); return; }

    try {
      const validated = advanceSchema.parse({
        farmer_id: formData.farmer_id,
        amount: parseFloat(formData.amount),
        advance_date: formData.advance_date,
        purpose: formData.purpose,
      });

      const { error } = await supabase.from("farmer_advances").insert({
        farmer_id: validated.farmer_id,
        amount: validated.amount,
        amount_recovered: 0,
        balance: validated.amount,
        advance_date: validated.advance_date,
        purpose: validated.purpose || null,
        status: "active",
        recorded_by: user.id,
        station_id: stationId,
      });
      if (error) throw error;

      // Also record in wallet_transactions if table exists
      await supabase.from("wallet_transactions").insert({
        transaction_type: "advance",
        amount: validated.amount,
        transaction_date: validated.advance_date,
        notes: `Advance to farmer: ${validated.purpose || ""}`,
        recorded_by: user.id,
        station_id: stationId,
      }).then(() => {});  // fire and forget, don't fail if wallet not set up

      const farmer = farmers.find(f => f.id === validated.farmer_id);
      toast.success("Advance recorded successfully");
      setOpen(false);
      setFormData({ farmer_id: "", amount: "", advance_date: new Date().toISOString().split("T")[0], purpose: "" });
      fetchData();

      setReceiptData({
        farmerName: farmer?.name || "Farmer",
        stationName: currentStation?.name || "Liza CWS",
        date: validated.advance_date,
        amount: validated.amount,
        purpose: validated.purpose || "Cherry Purchase Support",
        receiptNumber: `ADV-${Date.now().toString().slice(-6)}`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
      else toast.error(getUserFriendlyError(error, "recordAdvance"));
    }
  };

  // ── Computed values ──────────────────────────────────────────────────────────
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalRecovered = advances.reduce((s, a) => s + Number(a.amount_recovered), 0);
  const totalOutstanding = advances.filter(a => a.status === "active" || a.status === "partial")
    .reduce((s, a) => s + Number(a.balance), 0);

  const filtered = useMemo(() => advances.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterFarmerType !== "all" && a.farmers?.farmer_type !== filterFarmerType) return false;
    if (filterFrom && a.advance_date < filterFrom) return false;
    if (filterTo && a.advance_date > filterTo) return false;
    return true;
  }), [advances, filterStatus, filterFarmerType, filterFrom, filterTo]);

  const activeAdvances = advances.filter(a => a.status === "active" || a.status === "partial");

  const exportCSV = () => {
    downloadCSV("advances_report.csv",
      filtered.map(a => [
        a.advance_date, a.farmers?.name ?? "", a.farmers?.farmer_type ?? "",
        String(a.amount), String(a.amount_recovered), String(a.balance), a.status, a.purpose ?? "",
      ]),
      ["Date", "Farmer", "Type", "Amount", "Recovered", "Balance", "Status", "Purpose"]
    );
  };

  const selectedFarmer = farmers.find(f => f.id === formData.farmer_id);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {receiptData && (
        <DeliveryReceipt
          type="advance"
          receiptNumber={receiptData.receiptNumber}
          farmerName={receiptData.farmerName}
          stationName={receiptData.stationName}
          date={receiptData.date}
          totalAmount={receiptData.amount}
          purpose={receiptData.purpose}
          onClose={() => setReceiptData(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Farmer Advances</h1>
          <p className="text-muted-foreground">Track and manage farmer advances by type</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Record Advance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Advance</DialogTitle>
              <DialogDescription>Give an advance payment to a farmer</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Farmer *</Label>
                <Select value={formData.farmer_id} onValueChange={v => setFormData(f => ({ ...f, farmer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
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
                {selectedFarmer && <FarmerTypeBadge type={selectedFarmer.farmer_type} />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.advance_date}
                    onChange={e => setFormData(f => ({ ...f, advance_date: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Amount (RWF) *</Label>
                  <Input type="number" required value={formData.amount}
                    onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Textarea value={formData.purpose}
                  onChange={e => setFormData(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="Pre-harvest support, seeds, etc." rows={2} />
              </div>
              <Button type="submit" className="w-full">Record Advance</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Advances Given</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalAdvances)}</p>
            <p className="text-xs text-muted-foreground">{advances.length} advances</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recovered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{fmt(totalRecovered)}</p>
            <p className="text-xs text-muted-foreground">via deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{fmt(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">{activeAdvances.length} active advances</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Advances</TabsTrigger>
          <TabsTrigger value="all">All Advances</TabsTrigger>
          <TabsTrigger value="report">Report & Filter</TabsTrigger>
        </TabsList>

        {/* ── Active Advances ── */}
        <TabsContent value="active" className="mt-4 space-y-3">
          {activeAdvances.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No active advances.</CardContent></Card>
          ) : (
            activeAdvances.map(a => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{a.farmers?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <FarmerTypeBadge type={a.farmers?.farmer_type ?? null} />
                        <span className="text-xs text-muted-foreground">{fmtDate(a.advance_date)}</span>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Given</p>
                      <p className="font-semibold">{fmt(Number(a.amount))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Recovered</p>
                      <p className="font-semibold text-green-600">{fmt(Number(a.amount_recovered))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className="font-semibold text-orange-600">{fmt(Number(a.balance))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purpose</p>
                      <p className="text-sm">{a.purpose || "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setReceiptData({
                      farmerName: a.farmers?.name || "Farmer",
                      stationName: a.stations?.name || currentStation?.name || "Liza CWS",
                      date: a.advance_date,
                      amount: Number(a.amount),
                      purpose: a.purpose || "Cherry Purchase Support",
                      receiptNumber: `ADV-${a.id.slice(-6).toUpperCase()}`,
                    })}>
                      <Receipt className="h-4 w-4 mr-1" />Receipt
                    </Button>
                    {isAdmin && a.stations && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{a.stations.code}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── All Advances ── */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Farmer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Recovered</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{fmtDate(a.advance_date)}</TableCell>
                      <TableCell className="font-medium">{a.farmers?.name}</TableCell>
                      <TableCell><FarmerTypeBadge type={a.farmers?.farmer_type ?? null} /></TableCell>
                      <TableCell className="text-right text-orange-600 font-semibold">{fmt(Number(a.amount))}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(Number(a.amount_recovered))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(a.balance))}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.purpose || "—"}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Report & Filter ── */}
        <TabsContent value="report" className="space-y-4 mt-4">
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
                  <Label>Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="recovered">Recovered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Farmer Type</Label>
                  <Select value={filterFarmerType} onValueChange={setFilterFarmerType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="small">Small Farmers</SelectItem>
                      <SelectItem value="acheteur">Big Farmers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterStatus("all"); setFilterFarmerType("all"); }}>
                  Clear Filters
                </Button>
                <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
                  <Download className="w-4 h-4 mr-2" />Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Filtered Total Given", value: fmt(filtered.reduce((s, a) => s + Number(a.amount), 0)), color: "text-foreground" },
              { label: "Filtered Recovered", value: fmt(filtered.reduce((s, a) => s + Number(a.amount_recovered), 0)), color: "text-green-700" },
              { label: "Filtered Outstanding", value: fmt(filtered.reduce((s, a) => s + Number(a.balance), 0)), color: "text-orange-600" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${color}`}>{value}</p></CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No advances match the selected filters.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Recovered</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>{fmtDate(a.advance_date)}</TableCell>
                        <TableCell className="font-medium">{a.farmers?.name}</TableCell>
                        <TableCell><FarmerTypeBadge type={a.farmers?.farmer_type ?? null} /></TableCell>
                        <TableCell className="text-right text-orange-600 font-semibold">{fmt(Number(a.amount))}</TableCell>
                        <TableCell className="text-right text-green-600">{fmt(Number(a.amount_recovered))}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(Number(a.balance))}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
