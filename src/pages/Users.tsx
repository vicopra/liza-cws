import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Shield, Trash2, Building2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Station {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  stations: Station[];
}

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [stationDialogOpen, setStationDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "clerk",
    station_ids: [] as string[],
  });
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    role: "clerk",
    station_ids: [] as string[],
  });

  useEffect(() => {
    checkAdminStatus();
    fetchStations();
    fetchUsers();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const fetchStations = async () => {
    const { data, error } = await supabase
      .from("stations")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name");
    if (!error) setStations(data || []);
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone");
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      const { data: assignments, error: assignmentsError } = await supabase
        .from("user_station_assignments")
        .select("user_id, station_id, stations(id, name, code)");
      if (assignmentsError) throw assignmentsError;

      const usersWithRoles = profiles?.map((profile) => {
        const userAssignments = assignments?.filter(a => a.user_id === profile.id) || [];
        return {
          ...profile,
          role: roles?.find((r) => r.user_id === profile.id)?.role || "clerk",
          stations: userAssignments.map(a => a.stations).filter(Boolean) as Station[],
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast({ title: "Access Denied", description: "Only admins can create users", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create user");

      if (formData.station_ids.length > 0 && result.userId) {
        const stationAssignments = formData.station_ids.map(stationId => ({
          user_id: result.userId,
          station_id: stationId,
        }));
        const { error: assignError } = await supabase.from("user_station_assignments").insert(stationAssignments);
        if (assignError) console.error("Error assigning stations:", assignError);
      }

      toast({ title: "Success", description: "User created successfully" });
      setOpen(false);
      setFormData({ email: "", password: "", full_name: "", phone: "", role: "clerk", station_ids: [] });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditData({
      full_name: user.full_name,
      phone: user.phone || "",
      role: user.role,
      station_ids: user.stations.map(s => s.id),
    });
    setEditOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: editData.full_name, phone: editData.phone || null })
        .eq("id", selectedUser.id);
      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: editData.role })
        .eq("user_id", selectedUser.id);
      if (roleError) throw roleError;

      await supabase.from("user_station_assignments").delete().eq("user_id", selectedUser.id);

      if (editData.role !== "admin" && editData.station_ids.length > 0) {
        const assignments = editData.station_ids.map(stationId => ({
          user_id: selectedUser.id,
          station_id: stationId,
        }));
        const { error: assignError } = await supabase.from("user_station_assignments").insert(assignments);
        if (assignError) throw assignError;
      }

      toast({ title: "Success", description: "User updated successfully" });
      setEditOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) {
      toast({ title: "Access Denied", description: "Only admins can delete users", variant: "destructive" });
      return;
    }
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );
      if (!response.ok) throw new Error("Failed to delete user");
      toast({ title: "Success", description: "User deleted successfully" });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openStationDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedStations(user.stations.map(s => s.id));
    setStationDialogOpen(true);
  };

  const handleSaveStations = async () => {
    if (!selectedUser) return;
    try {
      await supabase.from("user_station_assignments").delete().eq("user_id", selectedUser.id);
      if (selectedStations.length > 0) {
        const assignments = selectedStations.map(stationId => ({
          user_id: selectedUser.id,
          station_id: stationId,
        }));
        const { error } = await supabase.from("user_station_assignments").insert(assignments);
        if (error) throw error;
      }
      toast({ title: "Success", description: "Station assignments updated" });
      setStationDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update station assignments", variant: "destructive" });
    }
  };

  const toggleStationInForm = (stationId: string) => {
    setFormData(prev => ({
      ...prev,
      station_ids: prev.station_ids.includes(stationId)
        ? prev.station_ids.filter(id => id !== stationId)
        : [...prev.station_ids, stationId],
    }));
  };

  const toggleStationInEdit = (stationId: string) => {
    setEditData(prev => ({
      ...prev,
      station_ids: prev.station_ids.includes(stationId)
        ? prev.station_ids.filter(id => id !== stationId)
        : [...prev.station_ids, stationId],
    }));
  };

  const toggleStation = (stationId: string) => {
    setSelectedStations(prev =>
      prev.includes(stationId) ? prev.filter(id => id !== stationId) : [...prev, stationId]
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can manage users</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage system users, roles, and station assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" required value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (All Stations)</SelectItem>
                    <SelectItem value="clerk">Clerk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role !== "admin" && (
                <div>
                  <Label>Assign to Stations</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {stations.map((station) => (
                      <div key={station.id} className="flex items-center space-x-2">
                        <Checkbox id={`station-${station.id}`}
                          checked={formData.station_ids.includes(station.id)}
                          onCheckedChange={() => toggleStationInForm(station.id)} />
                        <label htmlFor={`station-${station.id}`} className="text-sm cursor-pointer">
                          {station.name} ({station.code})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full">Create User</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User — {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={editData.full_name}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editData.role} onValueChange={(value) => setEditData({ ...editData, role: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (All Stations)</SelectItem>
                  <SelectItem value="clerk">Clerk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editData.role !== "admin" && (
              <div>
                <Label>Assign to Stations</Label>
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {stations.map((station) => (
                    <div key={station.id} className="flex items-center space-x-2">
                      <Checkbox id={`edit-station-${station.id}`}
                        checked={editData.station_ids.includes(station.id)}
                        onCheckedChange={() => toggleStationInEdit(station.id)} />
                      <label htmlFor={`edit-station-${station.id}`} className="text-sm cursor-pointer">
                        {station.name} ({station.code})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleEditUser} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Station Assignment Dialog */}
      <Dialog open={stationDialogOpen} onOpenChange={setStationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Stations to {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {stations.map((station) => (
                <div key={station.id} className="flex items-center space-x-2">
                  <Checkbox id={`assign-${station.id}`}
                    checked={selectedStations.includes(station.id)}
                    onCheckedChange={() => toggleStation(station.id)} />
                  <label htmlFor={`assign-${station.id}`} className="text-sm cursor-pointer">
                    {station.name} ({station.code})
                  </label>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveStations} className="w-full">Save Assignments</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Stations</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === "admin" ? (
                      <span className="text-sm text-muted-foreground">All Stations</span>
                    ) : user.stations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.stations.map((station) => (
                          <Badge key={station.id} variant="outline">{station.code}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-destructive">No stations assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      {user.role !== "admin" && (
                        <Button variant="ghost" size="icon" onClick={() => openStationDialog(user)}>
                          <Building2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
