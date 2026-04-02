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
import { Plus, UserPlus, Calendar, Download, Printer, ChevronLeft, ChevronRight, Users, UserX, FileText } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from "date-fns";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { useStation } from "@/contexts/StationContext";

interface CasualWorker {
  id: string;
  name: string;
  id_number: string | null;
  phone: string | null;
  role: string | null;
  daily_wage: number;
  is_active: boolean;
  station_id: string | null;
  stations?: { name: string; code: string } | null;
}

interface AttendanceRecord {
  id: string;
  worker_id: string;
  work_date: string;
  is_present: boolean;
  daily_wage: number;
  notes: string | null;
  station_id: string | null;
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
  const { currentStation, userStations, isAdmin } = useStation();
  const [workers, setWorkers] = useState<CasualWorker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [userId, setUserId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [dailyWage, setDailyWage] = useState("");

  const weekDates = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [currentStation]);

  useEffect(() => {
    if (workers.length > 0) fetchAttendance();
  }, [currentWeekStart, workers]);

  const fetchWorkers = async () => {
    let query = supabase
      .from("casual_workers")
      .select("*, stations(name, code)")
      .eq("is_active", true)
      .order("name");
    if (currentStation) query = query.eq('station_id', currentStation.id);
    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error, "fetchWorkers"), variant: "destructive" });
    } else {
      setWorkers(data || []);
    }
    setLoading(false);
  };

  const fetchAttendance = async () => {
    const startDate = format(currentWeekStart, "yyyy-MM-dd");
    const endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
    let query = supabase
      .from("casual_attendance")
      .select("*")
      .gte("work_date", startDate)
      .lte("work_date", endDate);
    if (currentStation) query = query.eq('station_id', currentStation.id);
    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error, "fetchAttendance"), variant: "destructive" });
    } else {
      setAttendance(data || []);
    }
  };

  const handleAddWorker = async () => {
    const stationId = currentStation?.id || (userStations.length === 1 ? userStations[0].id : null);
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    const validation = workerSchema.safeParse({
      name, id_number: idNumber || undefined, phone: phone || undefined,
      role: role || undefined, daily_wage: parseFloat(dailyWage) || 0,
    });
    if (!validation.success) {
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("casual_workers").insert({
      name: validation.data.name, id_number: validation.data.id_number || null,
      phone: validation.data.phone || null, role: validation.data.role || null,
      daily_wage: validation.data.daily_wage, station_id: stationId,
    });
    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error, "addWorker"), variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Worker added successfully" });
      setDialogOpen(false);
      resetForm();
      fetchWorkers();
    }
  };

  const resetForm = () => { setName(""); setIdNumber(""); setPhone(""); setRole(""); setDailyWage(""); };

  const toggleAttendance = async (workerId: string, date: Date, worker: CasualWorker) => {
    if (!userId) return;
    const stationId = currentStation?.id || (userStations.length === 1 ? userStations[0].id : null);
    if (!stationId && !isAdmin) {
      toast({ title: "Error", description: "Please select a station first", variant: "destructive" });
      return;
    }
    const dateStr = format(date, "yyyy-MM-dd");
    const existingRecord = attendance.find(a => a.worker_id === workerId && a.work_date === dateStr);
    if (existingRecord) {
      if (existingRecord.is_present) {
        const { error } = await supabase.from("casual_attendance").delete().eq("id", existingRecord.id);
        if (error) toast({ title: "Error", description: getUserFriendlyError(error, "updateAttendance"), variant: "destructive" });
        else fetchAttendance();
      } else {
        const { error } = await supabase.from("casual_attendance").update({ is_present: true }).eq("id", existingRecord.id);
        if (error) toast({ title: "Error", description: getUserFriendlyError(error, "updateAttendance"), variant: "destructive" });
        else fetchAttendance();
      }
    } else {
      const { error } = await supabase.from("casual_attendance").insert({
        worker_id: workerId, work_date: dateStr, is_present: true,
        daily_wage: worker.daily_wage, recorded_by: userId, station_id: stationId,
      });
      if (error) toast({ title: "Error", description: getUserFriendlyError(error, "recordAttendance"), variant: "destructive" });
      else fetchAttendance();
    }
  };

  const isPresent = (workerId: string, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return attendance.some(a => a.worker_id === workerId && a.work_date === dateStr && a.is_present);
  };

  const getWorkerWeeklyStats = (workerId: string) => {
    const workerAttendance = attendance.filter(a => a.worker_id === workerId && a.is_present);
    const daysWorked = workerAttendance.length;
    const totalPayment = workerAttendance.reduce((sum, a) => sum + Number(a.daily_wage), 0);
    return { daysWorked, totalPayment };
  };

  const getGrandTotal = () => workers.reduce((sum, w) => sum + getWorkerWeeklyStats(w.id).totalPayment, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" }).format(amount);

  // Stats calculations
  const todayPresentCount = workers.filter(w => isPresent(w.id, new Date())).length;
  const todayAbsentCount = workers.length - todayPresentCount;
  const weeklyPresentWorkers = workers.filter(w => getWorkerWeeklyStats(w.id).daysWorked > 0).length;
  const weeklyAbsentCount = workers.length - weeklyPresentWorkers;
  const totalDaysWorked = workers.reduce((sum, w) => sum + getWorkerWeeklyStats(w.id).daysWorked, 0);

  const exportToCSV = () => {
    const headers = ["Worker Name", "ID Number", "Role", "Daily Wage", ...DAYS_OF_WEEK, "Days Worked", "Total Payment"];
    const rows = workers.map(worker => {
      const { daysWorked, totalPayment } = getWorkerWeeklyStats(worker.id);
      const dayColumns = weekDates.map(date => isPresent(worker.id, date) ? "✔" : "✗");
      return [worker.name, worker.id_number || "-", worker.role || "-", worker.daily_wage.toString(), ...dayColumns, daysWorked.toString(), totalPayment.toString()];
    });
    rows.push(["GRAND TOTAL", "", "", "", "", "", "", "", "", "", "", totalDaysWorked.toString(), getGrandTotal().toString()]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `timesheet-${format(currentWeekStart, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Success", description: "Timesheet exported as CSV" });
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-timesheet, #printable-timesheet * { visibility: visible; }
          #printable-timesheet { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold">Casual Workers</h1>
            <p className="text-muted-foreground">Attendance & Payment Management</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Add Worker</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Worker</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Worker name" /></div>
                <div><Label>ID Number</Label><Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="National ID" /></div>
                <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" /></div>
                <div><Label>Role</Label><Input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g., Sorter, Washer" /></div>
                <div><Label>Daily Wage (RWF) *</Label><Input type="number" value={dailyWage} onChange={e => setDailyWage(e.target.value)} placeholder="0" /></div>
                <Button onClick={handleAddWorker} className="w-full"><Plus className="mr-2 h-4 w-4" />Add Worker</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 no-print">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Today</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{todayPresentCount}</div>
              <p className="text-xs text-muted-foreground">Workers present today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{todayAbsentCount}</div>
              <p className="text-xs text-muted-foreground">Workers absent today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Worked This Week</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weeklyPresentWorkers}</div>
              <p className="text-xs text-muted-foreground">{totalDaysWorked} total days worked</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Total Pay</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(getGrandTotal())}</div>
              <p className="text-xs text-muted-foreground">{weeklyAbsentCount} workers had absences</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList className="no-print">
            <TabsTrigger value="attendance"><Calendar className="mr-2 h-4 w-4" />Attendance</TabsTrigger>
            <TabsTrigger value="timesheet"><FileText className="mr-2 h-4 w-4" />Timesheet</TabsTrigger>
          </TabsList>

          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="space-y-4">
            <Card className="no-print">
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

            {workers.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No workers registered yet.</CardContent></Card>
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
                      {workers.map(worker => {
                        const { daysWorked, totalPayment } = getWorkerWeeklyStats(worker.id);
                        return (
                          <TableRow key={worker.id}>
                            <TableCell className="font-medium">{worker.name}</TableCell>
                            <TableCell className="text-muted-foreground">{worker.role || "-"}</TableCell>
                            {weekDates.map(date => (
                              <TableCell key={date.toISOString()} className="text-center">
                                <Checkbox checked={isPresent(worker.id, date)} onCheckedChange={() => toggleAttendance(worker.id, date, worker)} />
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

          {/* TIMESHEET TAB */}
          <TabsContent value="timesheet" className="space-y-4">
            <div className="flex flex-wrap gap-2 no-print">
              <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4 mr-1" />Previous Week
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                Next Week<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />Print Timesheet
              </Button>
            </div>

            {/* Printable Timesheet */}
            <div id="printable-timesheet">
              <Card>
                <CardHeader>
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold">LIZA Coffee Washing Station</h2>
                    <h3 className="text-lg font-semibold">Weekly Casual Workers Timesheet</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(currentWeekStart, "MMMM dd")} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMMM dd, yyyy")}
                    </p>
                    {currentStation && (
                      <p className="text-sm font-medium">Station: {currentStation.name}</p>
                    )}
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Total Workers</p>
                      <p className="text-lg font-bold">{workers.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Total Days Worked</p>
                      <p className="text-lg font-bold">{totalDaysWorked}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="text-lg font-bold">{formatCurrency(getGrandTotal())}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {workers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No workers to display.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border border-gray-300 p-2 text-left">#</th>
                            <th className="border border-gray-300 p-2 text-left">Name</th>
                            <th className="border border-gray-300 p-2 text-left">Role</th>
                            {weekDates.map((date, i) => (
                              <th key={date.toISOString()} className="border border-gray-300 p-2 text-center">
                                <div>{DAYS_OF_WEEK[i]}</div>
                                <div className="text-xs text-muted-foreground">{format(date, "dd/MM")}</div>
                              </th>
                            ))}
                            <th className="border border-gray-300 p-2 text-center">Days</th>
                            <th className="border border-gray-300 p-2 text-right">Daily Rate</th>
                            <th className="border border-gray-300 p-2 text-right">Amount (RWF)</th>
                            <th className="border border-gray-300 p-2 text-center min-w-[80px]">Signature</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workers.map((worker, index) => {
                            const { daysWorked, totalPayment } = getWorkerWeeklyStats(worker.id);
                            return (
                              <tr key={worker.id} className={index % 2 === 0 ? "" : "bg-muted/20"}>
                                <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                                <td className="border border-gray-300 p-2 font-medium">{worker.name}</td>
                                <td className="border border-gray-300 p-2 text-muted-foreground">{worker.role || "-"}</td>
                                {weekDates.map(date => {
                                  const present = isPresent(worker.id, date);
                                  return (
                                    <td key={date.toISOString()} className="border border-gray-300 p-2 text-center">
                                      <span className={present ? "text-green-600 font-bold text-base" : "text-red-500 font-bold text-base"}>
                                        {present ? "✔" : "✗"}
                                      </span>
                                    </td>
                                  );
                                })}
                                <td className="border border-gray-300 p-2 text-center font-bold">{daysWorked}</td>
                                <td className="border border-gray-300 p-2 text-right">{worker.daily_wage.toLocaleString()}</td>
                                <td className="border border-gray-300 p-2 text-right font-bold">{totalPayment.toLocaleString()}</td>
                                <td className="border border-gray-300 p-2 text-center">
                                  <div className="h-8 border-b border-gray-400 mx-2"></div>
                                </td>
                              </tr>
                            );
                          })}
                          {/* Grand Total Row */}
                          <tr className="bg-muted/50 font-bold">
                            <td colSpan={3} className="border border-gray-300 p-2 text-right font-bold">GRAND TOTAL</td>
                            {weekDates.map(date => {
                              const presentCount = workers.filter(w => isPresent(w.id, date)).length;
                              return (
                                <td key={date.toISOString()} className="border border-gray-300 p-2 text-center text-xs">
                                  {presentCount}/{workers.length}
                                </td>
                              );
                            })}
                            <td className="border border-gray-300 p-2 text-center">{totalDaysWorked}</td>
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2 text-right">{getGrandTotal().toLocaleString()}</td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Absentee Summary */}
                      <div className="mt-6">
                        <h4 className="font-semibold mb-2">Absentee Summary</h4>
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="border border-gray-300 p-2 text-left">Day</th>
                              <th className="border border-gray-300 p-2 text-center">Present</th>
                              <th className="border border-gray-300 p-2 text-center">Absent</th>
                              <th className="border border-gray-300 p-2 text-left">Absent Workers</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weekDates.map((date, i) => {
                              const presentWorkers = workers.filter(w => isPresent(w.id, date));
                              const absentWorkers = workers.filter(w => !isPresent(w.id, date));
                              return (
                                <tr key={date.toISOString()}>
                                  <td className="border border-gray-300 p-2">{DAYS_OF_WEEK[i]} {format(date, "dd/MM")}</td>
                                  <td className="border border-gray-300 p-2 text-center text-green-600 font-bold">{presentWorkers.length}</td>
                                  <td className="border border-gray-300 p-2 text-center text-red-600 font-bold">{absentWorkers.length}</td>
                                  <td className="border border-gray-300 p-2 text-sm text-muted-foreground">
                                    {absentWorkers.length > 0 ? absentWorkers.map(w => w.name).join(", ") : "None"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Signatures */}
                      <div className="mt-8 grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-sm font-medium mb-6">Prepared by:</p>
                          <div className="border-b border-gray-400 mb-1"></div>
                          <p className="text-xs text-muted-foreground">Name & Signature</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-6">Approved by:</p>
                          <div className="border-b border-gray-400 mb-1"></div>
                          <p className="text-xs text-muted-foreground">Name & Signature</p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mt-4 text-center">
                        Generated on {format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
