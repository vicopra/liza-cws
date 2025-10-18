import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Coffee,
  Users,
  TrendingUp,
  DollarSign,
  Package,
  FileText,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/auth");
  };

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/farmers", icon: Users, label: "Farmers" },
    { path: "/deliveries", icon: TrendingUp, label: "Deliveries" },
    { path: "/payments", icon: DollarSign, label: "Payments" },
    { path: "/stock", icon: Package, label: "Parch Stock" },
    { path: "/reports", icon: FileText, label: "Reports" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-primary to-primary/90 backdrop-blur supports-[backdrop-filter]:bg-primary/80">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center">
              <Coffee className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground">Liza Coffee</h1>
              <p className="text-xs text-primary-foreground/80">Washing Station</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container flex gap-6 py-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="space-y-1 sticky top-24">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start ${
                      isActive ? "bg-secondary font-medium" : ""
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
