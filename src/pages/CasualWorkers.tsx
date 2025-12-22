import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, UserPlus, Calendar, Download, FileSpreadsheet, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from "date-fns";
import { z } from "zod";

interface CasualWorker {
  id: string;
  name: string;
  id_number: string | null;
  phone: string | null;
  role: string | null;
  daily_wage: number;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  worker_id: string;
  work_date: string;
  is_present: boolean;
  daily_wage: number;
  notes: string | null;
}

const workerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  id_number: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  role: z.string().max(50).optional(),
  daily_wage: z.number().min(0, "Wage must be positive"),
});

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CasualWorkers() {
  const [workers, setWorkers] = useState<CasualWorker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [userId, setUserId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [dailyWage, setDailyWage] = useState("");

  const weekDates = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (workers.length > 0) {
      fetchAttendance();
    }
  }, [currentWeekStart, workers]);

  const fetchWorkers = async () => {
    const { data, error } = await supabase
      .from("casual_workers")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast({ title: "Error", description: "Failed to fetch workers", variant: "destructive" });
    } else {
      setWorkers(data || []);
    }
    setLoading(false);
  };

  const fetchAttendance = async () => {
    const startDate = format(currentWeekStart, "yyyy-MM-dd");
    const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("casual_attendance")
      .select("*")
      .gte("work_date", startDate)
      .lte("work_date", endDate);

    if (error) {
      toast({ title: "Error", description: "Failed to fetch attendance", variant: "destructive" });
    } else {
      setAttendance(data || []);
    }
  };

  const handleAddWorker = async () => {
    const validation = workerSchema.safeParse({
      name,
      id_number: idNumber || undefined,
      phone: phone || undefined,
      role: role || undefined,
      daily_wage: parseFloat(dailyWage) || 0,
    });

    if (!validation.success) {
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("casual_workers").insert({
      name: validation.data.name,
      id_number: validation.data.id_number || null,
      phone: validation.data.phone || null,
      role: validation.data.role || null,
      daily_wage: validation.data.daily_wage,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add worker", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Worker added successfully" });
      setDialogOpen(false);
      resetForm();
      fetchWorkers();
    }
  };

  const resetForm = () => {
    setName("");
    setIdNumber("");
    setPhone("");
    setRole("");
    setDailyWage("");
  };

  const toggleAttendance = async (workerId: string, date: Date, worker: CasualWorker) => {
    if (!userId) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const existingRecord = attendance.find(
      (a) => a.worker_id === workerId && a.work_date === dateStr
    );

    if (existingRecord) {
      if (existingRecord.is_present) {
        // Delete the record if unmarking
        const { error } = await supabase
          .from("casual_attendance")
          .delete()
          .eq("id", existingRecord.id);

        if (error) {
          toast({ title: "Error", description: "Failed to update attendance", variant: "destructive" });
        } else {
          fetchAttendance();
        }
      } else {
        // Update to present
        const { error } = await supabase
          .from("casual_attendance")
          .update({ is_present: true })
          .eq("id", existingRecord.id);

        if (error) {
          toast({ title: "Error", description: "Failed to update attendance", variant: "destructive" });
        } else {
          fetchAttendance();
        }
      }
    } else {
      // Create new attendance record
      const { error } = await supabase.from("casual_attendance").insert({
        worker_id: workerId,
        work_date: dateStr,
        is_present: true,
        daily_wage: worker.daily_wage,
        recorded_by: userId,
      });

      if (error) {
        toast({ title: "Error", description: "Failed to record attendance", variant: "destructive" });
      } else {
        fetchAttendance();
      }
    }
  };

  const isPresent = (workerId: string, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return attendance.some((a) => a.worker_id === workerId && a.work_date === dateStr && a.is_present);
  };

  const getWorkerWeeklyStats = (workerId: string) => {
    const workerAttendance = attendance.filter((a) => a.worker_id === workerId && a.is_present);
    const daysWorked = workerAttendance.length;
    const totalPayment = workerAttendance.reduce((sum, a) => sum + Number(a.daily_wage), 0);
    return { daysWorked, totalPayment };
  };

  const getGrandTotal = () => {
    return workers.reduce((sum, worker) => {
      const { totalPayment } = getWorkerWeeklyStats(worker.id);
      return sum + totalPayment;
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(amount);
  };

  const exportToCSV = () => {
    const weekRange = `${format(currentWeekStart, "MMM dd")} - ${format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd, yyyy")}`;
    
    // Build CSV content
    const headers = ["Worker Name", "ID Number", "Role", "Daily Wage", ...DAYS_OF_WEEK, "Days Worked", "Total Payment"];
    const rows = workers.map((worker) => {
      const { daysWorked, totalPayment } = getWorkerWeeklyStats(worker.id);
      const dayColumns = weekDates.map((date) => (isPresent(worker.id, date) ? "Present" : "Absent"));
      return [
        worker.name,
        worker.id_number || "-",
        worker.role || "-",
        worker.daily_wage.toString(),
        ...dayColumns,
        daysWorked.toString(),
        totalPayment.toString(),
      ];
    });

    // Add grand total row
    rows.push([
      "GRAND TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      workers.reduce((sum, w) => sum + getWorkerWeeklyStats(w.id).daysWorked, 0).toString(),
      getGrandTotal().toString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `casual-workers-report-${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Success", description: "CSV exported successfully" });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Casual Workers</h1>
          <p className="text-muted-foreground">Attendance & Payment Management</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Worker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Worker</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Worker name" />
              </div>
              <div>
                <Label htmlFor="idNumber">ID Number</Label>
                <Input id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="National ID" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., Sorter, Washer" />
              </div>
              <div>
                <Label htmlFor="dailyWage">Daily Wage (RWF) *</Label>
                <Input id="dailyWage" type="number" value={dailyWage} onChange={(e) => setDailyWage(e.target.value)} placeholder="0" />
              </div>
              <Button onClick={handleAddWorker} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Worker
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">
            <Calendar className="mr-2 h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Weekly Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          {/* Week Navigation */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">
                  {format(currentWeekStart, "MMM dd")} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd, yyyy")}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Attendance Table */}
          {workers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No workers registered yet. Add a worker to start tracking attendance.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Worker</TableHead>
                      <TableHead>Role</TableHead>
                      {weekDates.map((date, index) => (
                        <TableHead key={date.toISOString()} className="text-center min-w-[60px]">
                          <div className="text-xs">{DAYS_OF_WEEK[index]}</div>
                          <div className="text-xs text-muted-foreground">{format(date, "dd")}</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Days</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workers.map((worker) => {
                      const { daysWorked, totalPayment } = getWorkerWeeklyStats(worker.id);
                      return (
                        <TableRow key={worker.id}>
                          <TableCell className="font-medium">{worker.name}</TableCell>
                          <TableCell className="text-muted-foreground">{worker.role || "-"}</TableCell>
                          {weekDates.map((date) => (
                            <TableCell key={date.toISOString()} className="text-center">
                              <Checkbox
                                checked={isPresent(worker.id, date)}
                                onCheckedChange={() => toggleAttendance(worker.id, date, worker)}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-medium">{daysWorked}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(totalPayment)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          {/* Export Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>

          {/* Weekly Summary */}
          <Card className="print:shadow-none" id="printable-report">
            <CardHeader>
              <CardTitle>
                Weekly Attendance & Payment Report
                <div className="text-sm font-normal text-muted-foreground mt-1">
                  {format(currentWeekStart, "MMMM dd")} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMMM dd, yyyy")}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No workers to report.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>ID Number</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-center">Daily Wage</TableHead>
                        <TableHead className="text-center">Days Worked</TableHead>
                        <TableHead className="text-right">Total Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workers.map((worker) => {
                        const { daysWorked, totalPayment } = getWorkerWeeklyStats(worker.id);
                        return (
                          <TableRow key={worker.id}>
                            <TableCell className="font-medium">{worker.name}</TableCell>
                            <TableCell>{worker.id_number || "-"}</TableCell>
                            <TableCell>{worker.role || "-"}</TableCell>
                            <TableCell className="text-center">{formatCurrency(worker.daily_wage)}</TableCell>
                            <TableCell className="text-center">{daysWorked}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(totalPayment)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={4}>Grand Total</TableCell>
                        <TableCell className="text-center">
                          {workers.reduce((sum, w) => sum + getWorkerWeeklyStats(w.id).daysWorked, 0)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(getGrandTotal())}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
