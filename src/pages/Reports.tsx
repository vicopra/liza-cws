import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Users, DollarSign, Building2, ChevronDown, ChevronRight, Download, Loader2 } from "lucide-react";
import { useStation } from "@/contexts/StationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── Shared Types ─────────────────────────────────────────────────────────────

interface FarmerReport {
  id: string;
  name: string;
  total_deliveries: number;
  total_kg: number;
  total_value: number;
  total_paid: number;
  balance: number;
}

interface Farmer { id: string; name: string; }
interface Station { id: string; name: string; }

interface Payment {
  id: string;
  farmer_id: string;
  farmer_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  recorded_by: string | null;
  station_id: string | null;
}

interface CherryDelivery {
  id: string;
  farmer_id: string;
  farmer_name: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  delivery_date: string;
  station_id: string | null;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(n);

const fmtKg = (n: number) =>
  new Intl.NumberFormat("rw-RW", { maximumFractionDigits: 1 }).format(n) + " kg";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((r) => lines.push(r.map(escape).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Payment Report Tab ───────────────────────────────────────────────────────

const PaymentReport = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stationId, setStationId] = useState("all");
  const [farmerId, setFarmerId] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLookups();
    fetchPayments();
  }, []);

  const fetchLookups = async () => {
    const [{ data: f }, { data: s }] = await Promise.all([
      supabase.from("farmers").select("id, name").order("name"),
      supabase.from("stations").select("id, name").order("name"),
    ]);
    if (f) setFarmers(f);
    if (s) setStations(s);
  };

  const fetchPayments = async () => {
    setLoading(true);
    let q = supabase
      .from("payments")
      .select(`id, farmer_id, amount, payment_method, payment_date, recorded_by, station_id, farmers(name)`)
      .order("payment_date", { ascending: false });
    if (dateFrom) q = q.gte("payment_date", dateFrom);
    if (dateTo) q = q.lte("payment_date", dateTo);
    if (stationId !== "all") q = q.eq("station_id", stationId);
    if (farmerId !== "all") q = q.eq("farmer_id", farmerId);
    const { data, error } = await q;
    if (error) console.error(error);
    else setPayments((data ?? []).map((r: any) => ({ ...r, farmer_name: r.farmers?.name ?? "Unknown" })));
    setLoading(false);
  };

  const grouped = payments.reduce<Record<string, Payment[]>>((acc, p) => {
    (acc[p.farmer_id] = acc[p.farmer_id] ?? []).push(p);
    return acc;
  }, {});

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

  const exportCSV = () => {
    downloadCSV("payment_report.csv",
      payments.map((p) => [p.payment_date, p.farmer_name, String(Math.round(p.amount)), p.payment_method, p.recorded_by ?? ""]),
      ["Date", "Farmer", "Amount (RWF)", "Payment Method", "Recorded By"]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Station</Label>
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger><SelectValue placeholder="All stations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stations</SelectItem>
                  {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Farmer</Label>
              <Select value={farmerId} onValueChange={setFarmerId}>
                <SelectTrigger><SelectValue placeholder="All farmers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All farmers</SelectItem>
                  {farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={fetchPayments} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Apply Filters
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={payments.length === 0}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Amount Paid", value: fmt(totalAmount) },
          { label: "Farmers Paid", value: String(Object.keys(grouped).length) },
          { label: "Total Transactions", value: String(payments.length) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">No payments found.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([fid, rows]) => {
            const farmerTotal = rows.reduce((s, r) => s + r.amount, 0);
            const open = expanded[fid] ?? false;
            return (
              <Card key={fid}>
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors rounded-lg"
                  onClick={() => setExpanded((prev) => ({ ...prev, [fid]: !open }))}
                >
                  <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold">{rows[0].farmer_name}</span>
                    <span className="text-sm text-muted-foreground">{rows.length} transaction{rows.length !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="font-bold text-accent">{fmt(farmerTotal)}</span>
                </button>
                {open && (
                  <CardContent className="pt-0 pb-4 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>Recorded By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{fmtDate(r.payment_date)}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(r.amount)}</TableCell>
                            <TableCell className="capitalize">{r.payment_method.replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-muted-foreground">{r.recorded_by ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Cherry Collection Report Tab ────────────────────────────────────────────

const CherryCollectionReport = () => {
  const [deliveries, setDeliveries] = useState<CherryDelivery[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stationId, setStationId] = useState("all");

  useEffect(() => {
    fetchStations();
    fetchDeliveries();
  }, []);

  const fetchStations = async () => {
    const { data } = await supabase.from("stations").select("id, name").order("name");
    if (data) setStations(data);
  };

  const fetchDeliveries = async () => {
    setLoading(true);
    let q = supabase
      .from("cherry_deliveries")
      .select(`id, farmer_id, quantity_kg, price_per_kg, total_amount, delivery_date, station_id, farmers(name)`)
      .order("delivery_date", { ascending: false });
    if (dateFrom) q = q.gte("delivery_date", dateFrom);
    if (dateTo) q = q.lte("delivery_date", dateTo);
    if (stationId !== "all") q = q.eq("station_id", stationId);
    const { data, error } = await q;
    if (error) console.error(error);
    else {
      setDeliveries((data ?? []).map((r: any) => ({
        ...r,
        farmer_name: r.farmers?.name ?? "Unknown",
        total_amount: r.total_amount ?? r.quantity_kg * r.price_per_kg,
      })));
    }
    setLoading(false);
  };

  const totalKg = deliveries.reduce((s, d) => s + d.quantity_kg, 0);
  const totalValue = deliveries.reduce((s, d) => s + d.total_amount, 0);

  const exportCSV = () => {
    downloadCSV("cherry_collection_report.csv",
      deliveries.map((d) => [d.delivery_date, d.farmer_name, String(d.quantity_kg), String(d.price_per_kg), String(Math.round(d.total_amount))]),
      ["Date", "Farmer", "Quantity (kg)", "Price per kg (RWF)", "Total Amount (RWF)"]
    );
  };

  const byDate = deliveries.reduce<Record<string, CherryDelivery[]>>((acc, d) => {
    const key = d.delivery_date.slice(0, 10);
    (acc[key] = acc[key] ?? []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Station</Label>
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger><SelectValue placeholder="All stations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stations</SelectItem>
                  {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={fetchDeliveries} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Apply Filters
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={deliveries.length === 0}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Cherries Collected", value: fmtKg(totalKg) },
          { label: "Total Value", value: fmt(totalValue) },
          { label: "Total Deliveries", value: String(deliveries.length) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(byDate).length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">No deliveries found.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDate).map(([date, rows]) => {
            const dayKg = rows.reduce((s, r) => s + r.quantity_kg, 0);
            const dayVal = rows.reduce((s, r) => s + r.total_amount, 0);
            return (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{fmtDate(date)}</CardTitle>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span><strong className="text-foreground">{fmtKg(dayKg)}</strong> collected</span>
                      <span><strong className="text-foreground">{fmt(dayVal)}</strong> value</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Farmer</TableHead>
                        <TableHead className="text-right">Quantity (kg)</TableHead>
                        <TableHead className="text-right">Price / kg</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.farmer_name}</TableCell>
                          <TableCell className="text-right">{fmtKg(r.quantity_kg)}</TableCell>
                          <TableCell className="text-right">{fmt(r.price_per_kg)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Reports Page (your original code, unchanged) ───────────────────────

const Reports = () => {
  const [farmersReport, setFarmersReport] = useState<FarmerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentStation } = useStation();

  useEffect(() => {
    fetchReports();
  }, [currentStation]);

  const fetchReports = async () => {
    try {
      setLoading(true);

      let farmersQuery = supabase.from("farmers").select("id, name, station_id");
      if (currentStation) farmersQuery = farmersQuery.eq("station_id", currentStation.id);
      const { data: farmers, error: farmersError } = await farmersQuery;
      if (farmersError) throw farmersError;

      const reportsData: FarmerReport[] = await Promise.all(
        (farmers || []).map(async (farmer) => {
          let deliveriesQuery = supabase
            .from("cherry_deliveries")
            .select("quantity_kg, total_amount")
            .eq("farmer_id", farmer.id);
          if (currentStation) deliveriesQuery = deliveriesQuery.eq("station_id", currentStation.id);

          let paymentsQuery = supabase
            .from("payments")
            .select("amount")
            .eq("farmer_id", farmer.id);
          if (currentStation) paymentsQuery = paymentsQuery.eq("station_id", currentStation.id);

          const [{ data: deliveries }, { data: payments }] = await Promise.all([
            deliveriesQuery, paymentsQuery,
          ]);

          const totalKg = deliveries?.reduce((sum, d) => sum + Number(d.quantity_kg), 0) || 0;
          const totalValue = deliveries?.reduce((sum, d) => sum + Number(d.total_amount), 0) || 0;
          const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

          return {
            id: farmer.id,
            name: farmer.name,
            total_deliveries: deliveries?.length || 0,
            total_kg: totalKg,
            total_value: totalValue,
            total_paid: totalPaid,
            balance: totalValue - totalPaid,
          };
        })
      );

      setFarmersReport(reportsData.filter((r) => r.total_deliveries > 0));
    } catch (error: any) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View detailed reports and analytics</p>
        </div>
        {currentStation && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-sm font-medium">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Filtered: {currentStation.name}</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="farmers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="farmers">Farmer Summary</TabsTrigger>
          <TabsTrigger value="payments">Payment Report</TabsTrigger>
          <TabsTrigger value="cherry">Cherry Collection</TabsTrigger>
        </TabsList>

        {/* ── Your original Farmer Summary tab — not touched ── */}
        <TabsContent value="farmers" className="space-y-4">
          {farmersReport.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No data available yet</p>
              </CardContent>
            </Card>
          ) : (
            farmersReport.map((farmer) => (
              <Card key={farmer.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{farmer.name}</span>
                    <span className={`text-lg font-bold ${farmer.balance > 0 ? "text-destructive" : "text-accent"}`}>
                      Balance: {new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(farmer.balance)}
                    </span>
                  </CardTitle>
                  <CardDescription>Complete transaction history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-4 w-4" /><span className="text-sm">Deliveries</span>
                      </div>
                      <p className="text-2xl font-bold">{farmer.total_deliveries}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" /><span className="text-sm">Total Kg</span>
                      </div>
                      <p className="text-2xl font-bold">{farmer.total_kg.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" /><span className="text-sm">Total Value</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(farmer.total_value)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" /><span className="text-sm">Paid</span>
                      </div>
                      <p className="text-2xl font-bold text-accent">
                        {new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(farmer.total_paid)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── New Payment Report tab ── */}
        <TabsContent value="payments">
          <PaymentReport />
        </TabsContent>

        {/* ── New Cherry Collection tab ── */}
        <TabsContent value="cherry">
          <CherryCollectionReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
