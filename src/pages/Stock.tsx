import { useEffect, useState, useCallback } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ArrowUp, ArrowDown, Package, Building2, TrendingUp,
  TrendingDown, AlertTriangle, Download, RefreshCw, Loader2,
} from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 500; // kg — change this to suit your needs

const SOURCES = [
  "Drying Table A",
  "Drying Table B",
  "Drying Table C",
  "External Purchase",
  "Transfer In",
  "Other",
];

const DESTINATIONS = [
  "Dry Mill",
  "Export Warehouse",
  "Transfer Out",
  "Quality Control",
  "Other",
];

// ─── Validation schemas ───────────────────────────────────────────────────────

const stockInSchema = z.object({
  quantity_kg: z
    .number()
    .positive({ message: "Quantity must be greater than 0" })
    .max(100000, { message: "Quantity must be less than 100,000 kg" }),
  transaction_date: z.string().nonempty({ message: "Transaction date is required" }),
  source: z.string().nonempty({ message: "Please select a source" }),
  notes: z.string().trim().max(500, { message: "Notes must be less than 500 characters" }).optional(),
});

const stockOutSchema = z.object({
  quantity_kg: z
    .number()
    .positive({ message: "Quantity must be greater than 0" })
    .max(100000, { message: "Quantity must be less than 100,000 kg" }),
  transaction_date: z.string().nonempty({ message: "Transaction date is required" }),
  destination: z.string().nonempty({ message: "Please select a destination" }),
  notes: z.string().trim().max(500, { message: "Notes must be less than 500 characters" }).optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;   // "input" | "output" — keeping your existing values
  quantity_kg: number;
  source: string | null;
  destination: string | null;
  notes: string | null;
  station_id: string | null;
  created_at: string;
  stations?: { name: string; code: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtKg = (n: number) =>
  new Intl.NumberFormat("en-RW", { maximumFractionDigits: 2 }).format(n) + " kg";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Stock In Form ────────────────────────────────────────────────────────────

interface StockInFormProps {
  stationId: string | null;
  onSuccess: () => void;
}

const StockInForm = ({ stationId, onSuccess }: StockInFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    quantity_kg: "",
    transaction_date: new Date().toISOString().split("T")[0],
    source: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validated = stockInSchema.parse({
        quantity_kg: parseFloat(form.quantity_kg),
        transaction_date: form.transaction_date,
        source: form.source,
        notes: form.notes,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("parch_stock").insert([{
        transaction_type: "input",
        quantity_kg: validated.quantity_kg,
        transaction_date: validated.transaction_date,
        source: validated.source,
        destination: null,
        notes: validated.notes || null,
        recorded_by: user.id,
        station_id: stationId,
      }]);

      if (error) throw error;

      toast({ title: "Success", description: "Stock In recorded successfully." });
      setOpen(false);
      setForm({ quantity_kg: "", transaction_date: new Date().toISOString().split("T")[0], source: "", notes: "" });
      onSuccess();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: "Validation Error", description: err.errors[0].message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: getUserFriendlyError(err, "recordStockIn"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ArrowDown className="mr-2 h-4 w-4" />
          Stock In
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Stock In</DialogTitle>
          <DialogDescription>Add parchment coffee to stock</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.transaction_date}
                onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity (kg) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 120.5"
                value={form.quantity_kg}
                onChange={(e) => setForm((f) => ({ ...f, quantity_kg: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Source *</Label>
            <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Record Stock In
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Stock Out Form ───────────────────────────────────────────────────────────

interface StockOutFormProps {
  stationId: string | null;
  currentStock: number;
  onSuccess: () => void;
}

const StockOutForm = ({ stationId, currentStock, onSuccess }: StockOutFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    quantity_kg: "",
    transaction_date: new Date().toISOString().split("T")[0],
    destination: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(form.quantity_kg);

    // Prevent negative stock
    if (qty > currentStock) {
      toast({
        title: "Insufficient stock",
        description: `You only have ${fmtKg(currentStock)} available.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const validated = stockOutSchema.parse({
        quantity_kg: qty,
        transaction_date: form.transaction_date,
        destination: form.destination,
        notes: form.notes,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("parch_stock").insert([{
        transaction_type: "output",
        quantity_kg: validated.quantity_kg,
        transaction_date: validated.transaction_date,
        source: null,
        destination: validated.destination,
        notes: validated.notes || null,
        recorded_by: user.id,
        station_id: stationId,
      }]);

      if (error) throw error;

      toast({ title: "Success", description: "Stock Out recorded successfully." });
      setOpen(false);
      setForm({ quantity_kg: "", transaction_date: new Date().toISOString().split("T")[0], destination: "", notes: "" });
      onSuccess();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: "Validation Error", description: err.errors[0].message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: getUserFriendlyError(err, "recordStockOut"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUp className="mr-2 h-4 w-4" />
          Stock Out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Stock Out</DialogTitle>
          <DialogDescription>
            Remove parchment coffee from stock — available: <strong>{fmtKg(currentStock)}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.transaction_date}
                onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity (kg) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={currentStock}
                placeholder="e.g. 80"
                value={form.quantity_kg}
                onChange={(e) => setForm((f) => ({ ...f, quantity_kg: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Destination *</Label>
            <Select value={form.destination} onValueChange={(v) => setForm((f) => ({ ...f, destination: v }))}>
              <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <p className="text-sm text-muted-foreground bg-muted rounded px-3 py-2">
            Available: <strong>{fmtKg(currentStock)}</strong>
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Record Stock Out
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Stock Page ──────────────────────────────────────────────────────────

const Stock = () => {
  const { currentStation, userStations, isAdmin } = useStation();
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [loading, setLoading] = useState(true);

  // Report filters
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState<"all" | "input" | "output">("all");
  const [filterSource, setFilterSource] = useState("all");

  const stationId =
    currentStation?.id ?? (userStations.length === 1 ? userStations[0].id : null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("parch_stock")
        .select("*, stations(name, code)")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (currentStation) {
        query = query.eq("station_id", currentStation.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const txns = (data || []) as StockTransaction[];
      setTransactions(txns);

      const inTotal = txns
        .filter((t) => t.transaction_type === "input")
        .reduce((s, t) => s + Number(t.quantity_kg), 0);
      const outTotal = txns
        .filter((t) => t.transaction_type === "output")
        .reduce((s, t) => s + Number(t.quantity_kg), 0);

      setTotalIn(inTotal);
      setTotalOut(outTotal);
      setCurrentStock(inTotal - outTotal);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error, "fetchStock"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentStation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered transactions for report tab
  const filtered = transactions.filter((t) => {
    if (filterType !== "all" && t.transaction_type !== filterType) return false;
    if (filterFrom && t.transaction_date < filterFrom) return false;
    if (filterTo && t.transaction_date > filterTo) return false;
    if (filterSource !== "all") {
      const val = t.transaction_type === "input" ? t.source : t.destination;
      if (val !== filterSource) return false;
    }
    return true;
  });

  const filteredIn = filtered
    .filter((t) => t.transaction_type === "input")
    .reduce((s, t) => s + Number(t.quantity_kg), 0);
  const filteredOut = filtered
    .filter((t) => t.transaction_type === "output")
    .reduce((s, t) => s + Number(t.quantity_kg), 0);

  const allSourcesDests = Array.from(new Set([
    ...transactions.map((t) => t.source).filter(Boolean),
    ...transactions.map((t) => t.destination).filter(Boolean),
  ])) as string[];

  const exportCSV = () => {
    const headers = ["Date", "Type", "Quantity (kg)", "Source / Destination", "Station", "Notes", "Recorded At"];
    const rows = filtered.map((t) => [
      t.transaction_date,
      t.transaction_type === "input" ? "Stock In" : "Stock Out",
      String(t.quantity_kg),
      t.source ?? t.destination ?? "",
      t.stations?.name ?? "",
      t.notes ?? "",
      new Date(t.created_at).toLocaleString(),
    ]);
    downloadCSV("parch_stock_report.csv", rows, headers);
  };

  const isLow = currentStock < LOW_STOCK_THRESHOLD && currentStock >= 0;
  const recent = transactions.slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parch Stock</h1>
          <p className="text-muted-foreground">Manage parchment coffee inventory</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {currentStation && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{currentStation.name}</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={fetchData} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <StockInForm stationId={stationId} onSuccess={fetchData} />
          <StockOutForm stationId={stationId} currentStock={currentStock} onSuccess={fetchData} />
        </div>
      </div>

      {/* ── Low Stock Alert ── */}
      {isLow && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            Low stock alert — only <strong>{fmtKg(currentStock)}</strong> remaining. Consider adding more stock.
          </p>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30 border-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Stock</CardTitle>
            <Package className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${isLow ? "text-destructive" : "text-accent"}`}>
              {currentStock.toFixed(2)} kg
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total In − Total Out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock In</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{fmtKg(totalIn)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {transactions.filter((t) => t.transaction_type === "input").length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock Out</CardTitle>
            <TrendingDown className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{fmtKg(totalOut)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {transactions.filter((t) => t.transaction_type === "output").length} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="report">Report & Filter</TabsTrigger>
          <TabsTrigger value="history">Full History</TabsTrigger>
        </TabsList>

        {/* ── Dashboard: recent transactions ── */}
        <TabsContent value="dashboard" className="space-y-4">
          {recent.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  No transactions yet. Use Stock In or Stock Out above to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty (kg)</TableHead>
                      <TableHead>Source / Destination</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDate(t.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge variant={t.transaction_type === "input" ? "default" : "secondary"}>
                            {t.transaction_type === "input"
                              ? <><ArrowDown className="w-3 h-3 mr-1 inline" />In</>
                              : <><ArrowUp className="w-3 h-3 mr-1 inline" />Out</>}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${t.transaction_type === "input" ? "text-green-700" : "text-orange-600"}`}>
                          {t.transaction_type === "input" ? "+" : "−"}{Number(t.quantity_kg).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.source ?? t.destination ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Report & Filter tab ── */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="input">Stock In</SelectItem>
                      <SelectItem value="output">Stock Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Source / Destination</Label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {allSourcesDests.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterType("all"); setFilterSource("all"); }}
                >
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
              { label: "Filtered Stock In",  value: fmtKg(filteredIn),  color: "text-green-700" },
              { label: "Filtered Stock Out", value: fmtKg(filteredOut), color: "text-orange-600" },
              {
                label: "Net (In − Out)",
                value: fmtKg(filteredIn - filteredOut),
                color: filteredIn - filteredOut >= 0 ? "text-accent" : "text-destructive",
              },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No records match the selected filters.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty (kg)</TableHead>
                      <TableHead>Source / Destination</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDate(t.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge variant={t.transaction_type === "input" ? "default" : "secondary"}>
                            {t.transaction_type === "input" ? "Stock In" : "Stock Out"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${t.transaction_type === "input" ? "text-green-700" : "text-orange-600"}`}>
                          {t.transaction_type === "input" ? "+" : "−"}{Number(t.quantity_kg).toFixed(2)}
                        </TableCell>
                        <TableCell>{t.source ?? t.destination ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Full History / Audit Trail ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Full Transaction History (Audit Trail)</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty (kg)</TableHead>
                        <TableHead>Source / Dest</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Recorded At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{fmtDate(t.transaction_date)}</TableCell>
                          <TableCell>
                            <Badge variant={t.transaction_type === "input" ? "default" : "secondary"}>
                              {t.transaction_type === "input" ? "In" : "Out"}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${t.transaction_type === "input" ? "text-green-700" : "text-orange-600"}`}>
                            {t.transaction_type === "input" ? "+" : "−"}{Number(t.quantity_kg).toFixed(2)}
                          </TableCell>
                          <TableCell>{t.source ?? t.destination ?? "—"}</TableCell>
                          <TableCell>
                            {(isAdmin && t.stations?.code) ? (
                              <div className="flex items-center gap-1 text-primary">
                                <Building2 className="h-3 w-3" />
                                <span className="text-sm">{t.stations.code}</span>
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                            {t.notes ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Stock;
