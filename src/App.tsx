import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import Deliveries from "./pages/Deliveries";
import Payments from "./pages/Payments";
import Stock from "./pages/Stock";
import Reports from "./pages/Reports";
import { Users } from "./pages/Users";
import Wallet from "./pages/Wallet";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <Layout>
                  <Dashboard />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/farmers"
            element={
              <AuthGuard>
                <Layout>
                  <Farmers />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/deliveries"
            element={
              <AuthGuard>
                <Layout>
                  <Deliveries />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/payments"
            element={
              <AuthGuard>
                <Layout>
                  <Payments />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/stock"
            element={
              <AuthGuard>
                <Layout>
                  <Stock />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/reports"
            element={
              <AuthGuard>
                <Layout>
                  <Reports />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/users"
            element={
              <AuthGuard>
                <Layout>
                  <Users />
                </Layout>
              </AuthGuard>
            }
          />
          <Route
            path="/wallet"
            element={
              <AuthGuard>
                <Layout>
                  <Wallet />
                </Layout>
              </AuthGuard>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
