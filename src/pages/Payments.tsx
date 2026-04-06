import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus, Calendar, DollarSign, Building2, Receipt, TrendingUp,
  TrendingDown, Users, Download, Loader2, ChevronDown, ChevronRight, Printer, AlertCircle,
} from "lucide-react";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";
import DeliveryReceipt from "@/components/DeliveryReceipt";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(10000000),
  payment_date: z.string().nonempty({ message: "Payment date is required" }),
  payment_method: z.enum(["cash", "mobile_money", "bank_transfer"], { message: "Please select a payment method" }),
  notes: z.string().trim().max(500).optional(),
});

const advanceSchema = z.object({
  farmer_id: z.string().uuid({ message: "Please select a farmer" }),
  amount: z.number().positive({ message: "Amount must be greater than 0" }).max(10000000),
  advance_date: z.string().nonempty({ message: "Date is required" }),
  purpose: z.string().trim().max(500).optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  station_id: string | null;
  farmer_id: string;
  farmers: { name: string };
  stations?: { name: string; code: string } | null;
}

interface Advance {
  id: string;
  farmer_id: string;
  amount: number;
  amount_recovered: number;
  balance: number;
  advance_date: string;
  purpose: string | null;
  status: string;
  station_id: string | null;
  farmers?: { name: string };
}

interface Delivery {
  id: string;
  farmer_id: string;
  delivery_date: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  farmers?: { name: string };
}

interface Farmer {
  id: string;
  name: string;
}

interface FarmerBalance {
  farmer_id: string;
  farmer_name: string;
  total_deliveries: number;
  total_payments: number;
  total_advances: number;
  balance: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Advance Form ─────────────────────────────────────────────────────────────

interface AdvanceFormProps {
  farmers: Farmer[];
  stationId: string | null;
  onSuccess: () => void;
}

const AdvanceForm = ({ farmers, stationId, onSuccess }: AdvanceFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    farmer_id: "",
    amount: "",
    advance_date: new Date().toISOString().split("T")[0],
    purpose: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validated = advanceSchema.parse({
        farmer_id: form.farmer_id,
        amount: parseFloat(form.amount),
        advance_date: form.advance_date,
        purpose: form.purpose,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("farmer_advances").insert([{
        farmer_id: validated.farmer_id,
        amount: validated.amount,
        amount_recovered: 0,
        balance: validated.amount,
        advance_date: validated.advance_date,
        purpose: validated.purpose || null,
        status: "pending",
        recorded_by: user.id,
        station_id: stationId,
      }]);
      if (error) throw error;

      await supabase.from("wallet_transactions").insert([{
        transaction_type: "payment",
        amount: validated.amount,
        transaction_date: validated.advance_date,
        notes: `Advance to farmer: ${validated.purpose || ""}`,
        recorded_by: user.id,
        station_id: stationId,
      }]);

      toast({ title: "Success", description: "Advance recorded successfully." });
      setOpen(false);
      setForm({ farmer_id: "", amount: "", advance_date: new Date().toISOString().split("T")[0], purpose: "" });
      onSuccess();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({ title: "Validation Error", description: err.errors[0].message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: getUserFriendlyError(err, "recordAdvance"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />Record Advance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Advance Payment</DialogTitle>
          <DialogDescription>Give money to a farmer in advance — reduces their future balance</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Farmer *</Label>
            <Select value={form.farmer_id} onValueChange={(v) => setForm((f) => ({ ...f, farmer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select a farmer" /></SelectTrigger>
              <SelectContent>
                {farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.advance_date} onChange={(e) => setForm((f) => ({ ...f, advance_date: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Amount (RWF) *</Label>
              <Input type="number" step="0.01" placeholder="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Purpose / Notes</Label>
            <Textarea placeholder="e.g. Farming inputs, Emergency..." value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} rows={2} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Record Advance
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Farmer Statement Dialog ──────────────────────────────────────────────────

interface StatementProps {
  farmer: FarmerBalance;
  payments: Payment[];
  advances: Advance[];
  deliveries: Delivery[];
  onClose: () => void;
}

const FarmerStatement = ({ farmer, payments, advances, deliveries, onClose }: StatementProps) => {
  const farmerPayments = payments.filter((p) => p.farmer_id === farmer.farmer_id);
  const farmerAdvances = advances.filter((a) => a.farmer_id === farmer.farmer_id);
  const farmerDeliveries = deliveries.filter((d) => d.farmer_id === farmer.farmer_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Statement — {farmer.farmer_name}</span>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-2">
          {[
            { label: "Deliveries (owed)", value: fmt(farmer.total_deliveries), color: "text-green-700" },
            { label: "Payments made", value: fmt(farmer.total_payments), color: "text-orange-600" },
            { label: "Advances given", value: fmt(farmer.total_advances), color: "text-orange-600" },
            {
              label: "Net Balance",
              value: fmt(Math.abs(farmer.balance)),
              color: farmer.balance >= 0 ? "text-green-700" : "text-destructive",
              sub: farmer.balance >= 0 ? "We owe farmer" : "Farmer owes us",
            },
          ].map(({ label, value, color, sub }) => (
            <Card key={label}>
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Deliveries ({farmerDeliveries.length})</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Qty (kg)</TableHead>
                <TableHead className="text-right">Price/kg</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {farmerDeliveries.length === 0
                ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No deliveries</TableCell></TableRow>
                : farmerDeliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{fmtDate(d.delivery_date)}</TableCell>
                    <TableCell className="text-right">{d.quantity_kg}</TableCell>
                    <TableCell className="text-right">{fmt(d.price_per_kg)}</TableCell>
                    <TableCell className="text-right font-medium text-green-700">{fmt(d.total_amount)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Payments ({farmerPayments.length})</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {farmerPayments.length === 0
                ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No payments</TableCell></TableRow>
                : farmerPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{fmtDate(p.payment_date)}</TableCell>
                    <TableCell className="capitalize">{p.payment_method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-medium text-orange-600">{fmt(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Advances ({farmerAdvances.length})</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Recovered</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {farmerAdvances.length === 0
                ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No advances</TableCell></TableRow>
                : farmerAdvances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{fmtDate(a.advance_date)}</TableCell>
                    <TableCell className="text-right font-medium text-orange-600">{fmt(a.amount)}</TableCell>
                    <TableCell className="text-right">{fmt(a.amount_recovered)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.purpose ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "recovered" ? "default" : "secondary"}>{a.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Payments Page ───────────────────────────────────────────────────────

const Payments = () => {
  const { currentStation, userStations, isAdmin } = useStation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmerBalances, setFarmerBalances] = useState<FarmerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<FarmerBalance | null>(null);
  const [expandedFarmer, setExpandedFarmer] = useState<string | null>(null);

  // Payment preview state
  const [paymentPreview, setPaymentPreview] = useState<{
    amountOwed: number;
    paymentAmount: number;
    actualPayment: number;
    advanceAmount: number;
  } | null>(null);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterFarmer, setFilterFarmer] = useState("all");

  const [receiptData, setReceiptData] = useState<null | {
    farmerName: string; stationName: string; paymentDate: string;
    amount: number; paymentMethod: string; receiptNumber: string;
  }>(null);

  const [formData, setFormData] = useState({
    farmer_id: "", amount: "", payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0], notes: "",
  });

  const stationId = currentStation?.id ?? (userStations.length === 1 ? userStations[0].id : null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      let pQ = supabase.from("payments")
        .select("*, farmers(name), stations(name, code)")
        .order("payment_date", { ascending: false });
      if (currentStation) pQ = pQ.eq("station_id", currentStation.id);
      const { data: paymentsData, error: pErr } = await pQ;
      if (pErr) throw pErr;

      let aQ = supabase.from("farmer_advances")
        .select("*, farmers(name)")
        .order("advance_date", { ascending: false });
      if (currentStation) aQ = aQ.eq("station_id", currentStation.id);
      const { data: advancesData, error: aErr } = await aQ;
      if (aErr) throw aErr;

      let dQ = supabase.from("cherry_deliveries")
        .select("id, farmer_id, delivery_date, quantity_kg, price_per_kg, total_amount, farmers(name)")
        .order("delivery_date", { ascending: false });
      if (currentStation) dQ = dQ.eq("station_id", currentStation.id);
      const { data: deliveriesData, error: dErr } = await dQ;
      if (dErr) throw dErr;

      let fQ = supabase.from("farmers").select("id, name").order("name");
      if (currentStation) fQ = fQ.eq("station_id", currentStation.id);
      const { data: farmersData, error: fErr } = await fQ;
      if (fErr) throw fErr;

      const pList = (paymentsData ?? []) as Payment[];
      const aList = (advancesData ?? []) as Advance[];
      const dList = (deliveriesData ?? []) as Delivery[];
      const fList = (farmersData ?? []) as Farmer[];

      setPayments(pList);
      setAdvances(aList);
      setDeliveries(dList);
      setFarmers(fList);

      const balances: FarmerBalance[] = fList.map((farmer) => {
        const totalDeliveries = dList.filter((d) => d.farmer_id === farmer.id).reduce((s, d) => s + Number(d.total_amount), 0);
        const totalPayments = pList.filter((p) => p.farmer_id === farmer.id).reduce((s, p) => s + Number(p.amount), 0);
        const totalAdvances = aList.filter((a) => a.farmer_id === farmer.id).reduce((s, a) => s + Number(a.amount), 0);
        const balance = totalDeliveries - totalPayments - totalAdvances;
        return { farmer_id: farmer.id, farmer_name: farmer.name, total_deliveries: totalDeliveries, total_payments: totalPayments, total_advances: totalAdvances, balance };
      }).filter((b) => b.total_deliveries > 0 || b.total_payments > 0 || b.total_advances > 0);

      setFarmerBalances(balances);
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error, "fetchPayments"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentStation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Update payment preview when farmer or amount changes
  useEffect(() => {
    if (!formData.farmer_id || !formData.amount) {
      setPaymentPreview(null);
      return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentPreview(null);
      return;
    }
    const farmerBalance = farmerBalances.find(b => b.farmer_id === formData.farmer_id);
    const amountOwed = farmerBalance ? Math.max(0, farmerBalance.balance) : 0;

    if (amount > amountOwed && amountOwed > 0) {
      setPaymentPreview({
        amountOwed,
        paymentAmount: amount,
        actualPayment: amountOwed,
        advanceAmount: amount - amountOwed,
      });
    } else {
      setPaymentPreview(null);
    }
  }, [formData.farmer_id, formData.amount, farmerBalances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    try {
      const validatedData = paymentSchema.parse({
        farmer_id: formData.farmer_id,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        notes: formData.notes,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const farmerBalance = farmerBalances.find(b => b.farmer_id === validatedData.farmer_id);
      const amountOwed = farmerBalance ? Math.max(0, farmerBalance.balance) : 0;
      const totalPaid = validatedData.amount;

      // Determine if there's an overpayment
      const isOverpayment = totalPaid > amountOwed && amountOwed > 0;
      const actualPayment = isOverpayment ? amountOwed : totalPaid;
      const advanceAmount = isOverpayment ? totalPaid - amountOwed : 0;

      // 1. Record the payment (actual amount owed portion)
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert([{
          farmer_id: validatedData.farmer_id,
          amount: actualPayment,
          payment_method: validatedData.payment_method,
          payment_date: validatedData.payment_date,
          notes: isOverpayment
            ? `${validatedData.notes ? validatedData.notes + " | " : ""}Payment for deliveries (${fmt(actualPayment)})`
            : validatedData.notes || null,
          recorded_by: user.id,
          station_id: stationId,
        }])
        .select().single();
      if (paymentError) throw paymentError;

      // Record payment in wallet
      await supabase.from("wallet_transactions").insert([{
        transaction_type: "payment",
        amount: actualPayment,
        transaction_date: validatedData.payment_date,
        notes: `Payment to farmer`,
        recorded_by: user.id,
        payment_id: paymentData.id,
        station_id: stationId,
      }]);

      // 2. If overpayment — record the extra as an advance
      if (isOverpayment && advanceAmount > 0) {
        const { error: advanceError } = await supabase.from("farmer_advances").insert([{
          farmer_id: validatedData.farmer_id,
          amount: advanceAmount,
          amount_recovered: 0,
          balance: advanceAmount,
          advance_date: validatedData.payment_date,
          purpose: `Auto-advance from overpayment on ${validatedData.payment_date}`,
          status: "pending",
          recorded_by: user.id,
          station_id: stationId,
        }]);
        if (advanceError) throw advanceError;

        // Record advance in wallet
        await supabase.from("wallet_transactions").insert([{
          transaction_type: "payment",
          amount: advanceAmount,
          transaction_date: validatedData.payment_date,
          notes: `Advance to farmer (overpayment)`,
          recorded_by: user.id,
          station_id: stationId,
        }]);

        toast({
          title: "Payment Recorded with Advance",
          description: `✓ Payment: ${fmt(actualPayment)} for deliveries\n✓ Advance: ${fmt(advanceAmount)} saved as farmer advance`,
        });
      } else {
        toast({ title: "Success", description: "Payment recorded successfully." });
      }

      const farmer = farmers.find((f) => f.id === validatedData.farmer_id);
      setDialogOpen(false);
      setFormData({ farmer_id: "", amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0], notes: "" });
      setPaymentPreview(null);
      fetchData();

      setReceiptData({
        farmerName: farmer?.name || "Farmer",
        stationName: currentStation?.name || "Liza CWS",
        paymentDate: validatedData.payment_date,
        amount: totalPaid,
        paymentMethod: validatedData.payment_method,
        receiptNumber: `PAY-${Date.now().toString().slice(-6)}`,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: getUserFriendlyError(error, "recordPayment"), variant: "destructive" });
      }
    }
  };

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalOwed = farmerBalances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);

  const filteredPayments = payments.filter((p) => {
    if (filterFarmer !== "all" && p.farmer_id !== filterFarmer) return false;
    if (filterFrom && p.payment_date < filterFrom) return false;
    if (filterTo && p.payment_date > filterTo) return false;
    return true;
  });

  const filteredAdvances = advances.filter((a) => {
    if (filterFarmer !== "all" && a.farmer_id !== filterFarmer) return false;
    if (filterFrom && a.advance_date < filterFrom) return false;
    if (filterTo && a.advance_date > filterTo) return false;
    return true;
  });

  const exportPaymentsCSV = () => {
    downloadCSV("payments_report.csv",
      filteredPayments.map((p) => [p.payment_date, p.farmers.name, String(p.amount), p.payment_method, p.notes ?? ""]),
      ["Date", "Farmer", "Amount (RWF)", "Method", "Notes"]
    );
  };

  const exportAdvancesCSV = () => {
    downloadCSV("advances_report.csv",
      filteredAdvances.map((a) => [a.advance_date, a.farmers?.name ?? "", String(a.amount), String(a.amount_recovered), a.purpose ?? "", a.status]),
      ["Date", "Farmer", "Amount (RWF)", "Recovered", "Purpose", "Status"]
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {receiptData && (
        <DeliveryReceipt
          type="final_payment"
          receiptNumber={receiptData.receiptNumber}
          farmerName={receiptData.farmerName}
          stationName={receiptData.stationName}
          date={receiptData.paymentDate}
          totalAmount={receiptData.amount}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setReceiptData(null)}
        />
      )}

      {selectedStatement && (
        <FarmerStatement
          farmer={selectedStatement}
          payments={payments}
          advances={advances}
          deliveries={deliveries}
          onClose={() => setSelectedStatement(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track payments, advances, debts, and farmer balances</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {currentStation && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{currentStation.name}</span>
            </div>
          )}
          <AdvanceForm farmers={farmers} stationId={stationId} onSuccess={fetchData} />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setPaymentPreview(null); setFormData({ farmer_id: "", amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0], notes: "" }); } }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/90">
                <Plus className="mr-2 h-4 w-4" />Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>Payment will be automatically split if it exceeds the amount owed</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Farmer *</Label>
                  <Select value={formData.farmer_id} onValueChange={(v) => setFormData({ ...formData, farmer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a farmer" /></SelectTrigger>
                    <SelectContent>
                      {farmers.map((f) => {
                        const bal = farmerBalances.find(b => b.farmer_id === f.id);
                        return (
                          <SelectItem key={f.id} value={f.id}>
                            <span>{f.name}</span>
                            {bal && (
                              <span className={`ml-2 text-xs ${bal.balance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                ({bal.balance > 0 ? `owed: ${fmt(bal.balance)}` : `advance: ${fmt(Math.abs(bal.balance))}`})
                              </span>
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Show farmer's current balance */}
                {formData.farmer_id && (() => {
                  const bal = farmerBalances.find(b => b.farmer_id === formData.farmer_id);
                  if (!bal) return null;
                  return (
                    <div className={`p-3 rounded-lg text-sm ${bal.balance > 0 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                      <p className="font-medium">{bal.balance > 0 ? '💰 Amount owed to farmer:' : '⚠️ Farmer has advance balance:'}</p>
                      <p className={`text-lg font-bold ${bal.balance > 0 ? 'text-green-700' : 'text-orange-600'}`}>{fmt(Math.abs(bal.balance))}</p>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (RWF) *</Label>
                    <Input type="number" step="0.01" value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                  </div>
                </div>

                {/* Overpayment Preview */}
                {paymentPreview && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <AlertCircle className="h-4 w-4" />
                      <span>Overpayment Detected — Will be auto-split:</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment for deliveries:</span>
                        <span className="font-medium text-green-700">{fmt(paymentPreview.actualPayment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recorded as advance:</span>
                        <span className="font-medium text-orange-600">{fmt(paymentPreview.advanceAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 font-bold">
                        <span>Total paid:</span>
                        <span>{fmt(paymentPreview.paymentAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
                </div>
                <Button type="submit" className="w-full">
                  {paymentPreview ? `Record Payment + Advance` : `Record Payment`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments Made</CardTitle>
            <TrendingDown className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{fmt(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">{payments.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Advances Given</CardTitle>
            <DollarSign className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{fmt(totalAdvances)}</p>
            <p className="text-xs text-muted-foreground mt-1">{advances.length} advances</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Owed to Farmers</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700">{fmt(totalOwed)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {farmerBalances.filter((b) => b.balance > 0).length} farmers with outstanding balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="balances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="balances">Farmer Balances</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Farmer Balances */}
        <TabsContent value="balances" className="space-y-3">
          {farmerBalances.length === 0 ? (
            <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground py-8">No farmer data yet.</p></CardContent></Card>
          ) : (
            farmerBalances.map((fb) => (
              <Card key={fb.farmer_id} className={fb.balance < 0 ? "border-destructive/40" : ""}>
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
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-green-700">In: {fmt(fb.total_deliveries)}</span>
                        <span className="text-xs text-orange-600">Out: {fmt(fb.total_payments + fb.total_advances)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${fb.balance >= 0 ? "text-green-700" : "text-destructive"}`}>
                      {fmt(Math.abs(fb.balance))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fb.balance >= 0 ? "We owe farmer" : "Farmer owes us"}
                    </p>
                  </div>
                </button>
                {expandedFarmer === fb.farmer_id && (
                  <CardContent className="pt-0 pb-4 px-6 border-t">
                    <div className="grid grid-cols-3 gap-4 py-3 text-sm">
                      <div><p className="text-muted-foreground">Deliveries value</p><p className="font-semibold text-green-700">{fmt(fb.total_deliveries)}</p></div>
                      <div><p className="text-muted-foreground">Payments made</p><p className="font-semibold text-orange-600">{fmt(fb.total_payments)}</p></div>
                      <div><p className="text-muted-foreground">Advances given</p><p className="font-semibold text-yellow-600">{fmt(fb.total_advances)}</p></div>
                    </div>
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => setSelectedStatement(fb)}>
                      <Receipt className="w-4 h-4 mr-2" />View Full Statement
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          {payments.length === 0 ? (
            <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground py-8">No payments recorded yet.</p></CardContent></Card>
          ) : (
            payments.map((payment) => (
              <Card key={payment.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{payment.farmers.name}</span>
                    <span className="text-lg font-bold text-accent">{fmt(payment.amount)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-6 items-center justify-between">
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{fmtDate(payment.payment_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize">{payment.payment_method.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setReceiptData({
                      farmerName: payment.farmers.name,
                      stationName: payment.stations?.name || currentStation?.name || "Liza CWS",
                      paymentDate: payment.payment_date,
                      amount: payment.amount,
                      paymentMethod: payment.payment_method,
                      receiptNumber: `PAY-${payment.id.slice(-6).toUpperCase()}`,
                    })}>
                      <Receipt className="h-4 w-4 mr-1" />Receipt
                    </Button>
                  </div>
                  {payment.notes && <p className="text-sm text-muted-foreground">{payment.notes}</p>}
                  {payment.stations && isAdmin && (
                    <div className="flex items-center gap-2 text-primary">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm">{payment.stations.code}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Advances Tab */}
        <TabsContent value="advances" className="space-y-3">
          {advances.length === 0 ? (
            <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground py-8">No advances recorded yet.</p></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Recovered</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{fmtDate(a.advance_date)}</TableCell>
                        <TableCell className="font-medium">{a.farmers?.name ?? "—"}</TableCell>
                        <TableCell className="text-right text-orange-600 font-semibold">{fmt(a.amount)}</TableCell>
                        <TableCell className="text-right text-green-700">{fmt(a.amount_recovered)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(a.balance)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{a.purpose ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "recovered" ? "default" : a.status === "partial" ? "secondary" : "outline"}>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Farmer</Label>
                  <Select value={filterFarmer} onValueChange={setFilterFarmer}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Farmers</SelectItem>
                      {farmers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                <Button variant="outline" onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterFarmer("all"); }}>Clear Filters</Button>
                <Button variant="outline" onClick={exportPaymentsCSV} disabled={filteredPayments.length === 0}>
                  <Download className="w-4 h-4 mr-2" />Export Payments CSV
                </Button>
                <Button variant="outline" onClick={exportAdvancesCSV} disabled={filteredAdvances.length === 0}>
                  <Download className="w-4 h-4 mr-2" />Export Advances CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Filtered Payments Total</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{fmt(filteredPayments.reduce((s, p) => s + Number(p.amount), 0))}</p>
                <p className="text-xs text-muted-foreground">{filteredPayments.length} payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Filtered Advances Total</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">{fmt(filteredAdvances.reduce((s, a) => s + Number(a.amount), 0))}</p>
                <p className="text-xs text-muted-foreground">{filteredAdvances.length} advances</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No payments match the filters.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{fmtDate(p.payment_date)}</TableCell>
                        <TableCell className="font-medium">{p.farmers.name}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">{fmt(p.amount)}</TableCell>
                        <TableCell className="capitalize">{p.payment_method.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />Outstanding Balances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer</TableHead>
                    <TableHead className="text-right">Deliveries</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead className="text-right">Advances</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {farmerBalances.map((fb) => (
                    <TableRow key={fb.farmer_id}>
                      <TableCell className="font-medium">{fb.farmer_name}</TableCell>
                      <TableCell className="text-right text-green-700">{fmt(fb.total_deliveries)}</TableCell>
                      <TableCell className="text-right text-orange-600">{fmt(fb.total_payments)}</TableCell>
                      <TableCell className="text-right text-yellow-600">{fmt(fb.total_advances)}</TableCell>
                      <TableCell className={`text-right font-bold ${fb.balance >= 0 ? "text-green-700" : "text-destructive"}`}>
                        {fmt(Math.abs(fb.balance))}
                      </TableCell>
                      <TableCell>
                        {fb.balance > 0
                          ? <Badge variant="outline" className="text-green-700 border-green-300">We owe</Badge>
                          : fb.balance < 0
                          ? <Badge variant="destructive">Farmer owes</Badge>
                          : <Badge variant="secondary">Settled</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Payments;
