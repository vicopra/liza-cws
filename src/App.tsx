import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { Layout } from "./components/Layout";
import { StationProvider } from "./contexts/StationContext";
import Auth from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import Deliveries from "./pages/Deliveries";
import Payments from "./pages/Payments";
import Stock from "./pages/Stock";
import Reports from "./pages/Reports";
import { Users } from "./pages/Users";
import Wallet from "./pages/Wallet";
import CasualWorkers from "./pages/CasualWorkers";
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
                <StationProvider>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/farmers"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Farmers />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/deliveries"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Deliveries />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/payments"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Payments />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/stock"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Stock />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/reports"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Reports />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/casual-workers"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <CasualWorkers />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/users"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Users />
                  </Layout>
                </StationProvider>
              </AuthGuard>
            }
          />
          <Route
            path="/wallet"
            element={
              <AuthGuard>
                <StationProvider>
                  <Layout>
                    <Wallet />
                  </Layout>
                </StationProvider>
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
