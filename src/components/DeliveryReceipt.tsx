import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export type ReceiptType = "delivery" | "final_payment" | "advance";

interface DeliveryReceiptProps {
  type: ReceiptType;
  receiptNumber: string;
  farmerName: string;
  stationName: string;
  date: string;
  totalAmount: number;
  paymentMethod?: string;
  // delivery fields
  quantityKg?: number;
  pricePerKg?: number;
  // final payment breakdown
  cherryTotal?: number;
  advanceDeducted?: number;
  // advance fields
  purpose?: string;
  onClose: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-RW", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmt(amount: number) {
  return `RWF ${Number(amount).toLocaleString()}`;
}

const BADGES = {
  delivery:      { label: "⏳  DELIVERY RECEIPT — PAYMENT PENDING", bg: "transparent", color: "#92400e", border: "1.5px solid #92400e" },
  final_payment: { label: "✓  FINAL PAYMENT RECEIPT",               bg: "#14532d",     color: "#fff",    border: "none" },
  advance:       { label: "💵  ADVANCE PAYMENT RECEIPT",             bg: "#1e3a8a",     color: "#fff",    border: "none" },
};

const FOOTERS = {
  delivery:      (n: string) => `Thank you, ${n}, for trusting Liza Coffee Washing Station. Your payment will be processed after verification.`,
  final_payment: (n: string) => `Payment confirmed. Thank you, ${n}, for your continued partnership with Liza Coffee Washing Station!`,
  advance:       (n: string) => `This advance has been given to ${n} to support cherry purchases. The amount will be recovered upon delivery.`,
};

const STAMPS = {
  delivery:      "*** PRESENT ON PAYMENT DAY ***",
  final_payment: "*** KEEP FOR YOUR RECORDS ***",
  advance:       "*** ADVANCE — TO BE RECOVERED ***",
};

export default function DeliveryReceipt({
  type, receiptNumber, farmerName, stationName, date,
  totalAmount, paymentMethod, quantityKg, pricePerKg,
  cherryTotal, advanceDeducted, purpose, onClose,
}: DeliveryReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const badge = BADGES[type];

  const titles = {
    delivery:      "Delivery Receipt",
    final_payment: "Final Payment Receipt",
    advance:       "Advance Payment Receipt",
  };

  const handlePrint = () => {
    const content = receiptRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=350,height=750");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt ${receiptNumber}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; font-size:11px; color:#111; background:#fff; width:280px; padding:16px 12px; }
        .row { display:flex; justify-content:space-between; margin:3px 0; }
        .row span:first-child { color:#666; }
        .row span:last-child { font-weight:600; }
        .total { display:flex; justify-content:space-between; font-weight:700; font-size:13px; margin:4px 0; }
        .section-label { font-size:9px; font-weight:700; color:#888; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase; }
        .dash { border-top:1px dashed #999; margin:8px 0; }
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div style={{ background:"#fff", borderRadius:10, padding:20, width:360, boxShadow:"0 24px 64px rgba(0,0,0,0.35)", maxHeight:"90vh", overflowY:"auto" }}>

        {/* Toolbar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontWeight:700, fontSize:14 }}>{titles[type]}</span>
          <div style={{ display:"flex", gap:8 }}>
            <Button size="sm" onClick={handlePrint} className="bg-amber-800 hover:bg-amber-900 text-white">
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Receipt */}
        <div style={{ border:"1px solid #e5e7eb", borderRadius:6, padding:"14px 12px", background:"#fafafa" }}>
          <div ref={receiptRef} style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"#111", lineHeight:1.6 }}>

            {/* Header */}
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:15, fontWeight:700, letterSpacing:2 }}>☕ LIZA CWS</div>
              <div style={{ fontSize:10, color:"#555" }}>{stationName}</div>
              <div style={{ fontSize:10, color:"#555" }}>Coffee Washing Station — Rwanda</div>
            </div>

            <D />

            {/* Badge */}
            <div style={{ textAlign:"center", margin:"8px 0" }}>
              <span style={{ background:badge.bg, color:badge.color, border:badge.border, padding:"3px 10px", fontSize:10, fontWeight:700, letterSpacing:1, display:"inline-block" }}>
                {badge.label}
              </span>
            </div>

            <D />

            <R label="Receipt #" value={receiptNumber} />
            <R label="Date"      value={formatDate(date)} />
            <R label="Farmer"    value={farmerName} />

            <D />

            {/* DELIVERY receipt */}
            {type === "delivery" && quantityKg !== undefined && pricePerKg !== undefined && (
              <>
                <SL>CHERRY DELIVERY</SL>
                <R label="Quantity"   value={`${quantityKg} kg`} />
                <R label="Unit Price" value={`${fmt(pricePerKg)}/kg`} />
                <D />
                <Total label="TOTAL VALUE" value={fmt(totalAmount)} />
                <Status label="Payment Status" value="PENDING" color="#92400e" />
              </>
            )}

            {/* FINAL PAYMENT receipt */}
            {type === "final_payment" && (
              <>
                {/* Cherry delivery section */}
                {quantityKg !== undefined && pricePerKg !== undefined && (
                  <>
                    <SL>CHERRY DELIVERY</SL>
                    <R label="Quantity"    value={`${quantityKg} kg`} />
                    <R label="Unit Price"  value={`${fmt(pricePerKg)}/kg`} />
                    <R label="Cherry Total" value={fmt(cherryTotal ?? totalAmount)} />
                    <D />
                  </>
                )}

                {/* Payment breakdown */}
                <SL>PAYMENT BREAKDOWN</SL>
                {cherryTotal !== undefined && (
                  <R label="Cherry Total" value={fmt(cherryTotal)} />
                )}
                {advanceDeducted !== undefined && advanceDeducted > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3, color:"#92400e" }}>
                    <span>Advance Deducted</span>
                    <span style={{ fontWeight:600 }}>- {fmt(advanceDeducted)}</span>
                  </div>
                )}
                {paymentMethod && (
                  <R label="Pay Method" value={paymentMethod.replace(/_/g," ").toUpperCase()} />
                )}
                <D />
                <Total label="NET AMOUNT PAID" value={fmt(totalAmount)} />
                <Status label="Payment Status" value="✓ PAID" color="#14532d" />
              </>
            )}

            {/* ADVANCE receipt */}
            {type === "advance" && (
              <>
                <SL>ADVANCE PAYMENT</SL>
                <R label="Type"    value="ADVANCE PAYMENT" />
                <R label="Purpose" value={purpose || "Cherry Purchase Support"} />
                <D />
                <Total label="AMOUNT ADVANCED" value={fmt(totalAmount)} />
                <Status label="Recovery Status" value="PENDING RECOVERY" color="#1e3a8a" />
              </>
            )}

            <D />

            <div style={{ fontSize:10, textAlign:"center", fontStyle:"italic", color:"#444", lineHeight:1.6 }}>
              {FOOTERS[type](farmerName.split(" ")[0])}
            </div>
            <div style={{ textAlign:"center", fontSize:9, color:"#bbb", marginTop:8, letterSpacing:1 }}>
              {STAMPS[type]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function R({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
      <span style={{ color:"#666" }}>{label}</span>
      <span style={{ fontWeight:600 }}>{value}</span>
    </div>
  );
}

function D() {
  return <div style={{ borderTop:"1px dashed #ccc", margin:"8px 0" }} />;
}

function SL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:9, fontWeight:700, color:"#888", letterSpacing:1, marginBottom:4, textTransform:"uppercase" }}>{children}</div>;
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:13, margin:"4px 0" }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function Status({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginTop:2, color }}>
      <span>{label}</span>
      <span style={{ fontWeight:700 }}>{value}</span>
    </div>
  );
}
