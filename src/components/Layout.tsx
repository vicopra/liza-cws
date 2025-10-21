import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Coffee,
  Users,
  TrendingUp,
  DollarSign,
  Package,
  FileText,
  LogOut,
  LayoutDashboard,
  Menu,
  Shield,
  Wallet,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

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
    { path: "/wallet", icon: Wallet, label: "Wallet" },
    { path: "/stock", icon: Package, label: "Parch Stock" },
    { path: "/reports", icon: FileText, label: "Reports" },
    { path: "/users", icon: Shield, label: "Users" },
  ];

  const NavLinks = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} onClick={() => setSheetOpen(false)}>
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
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-primary to-primary/90 backdrop-blur supports-[backdrop-filter]:bg-primary/80">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Coffee className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold">Liza Coffee</h1>
                    <p className="text-xs text-muted-foreground">Washing Station</p>
                  </div>
                </div>
                <NavLinks />
              </SheetContent>
            </Sheet>

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
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="container flex gap-6 py-6">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <NavLinks />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
