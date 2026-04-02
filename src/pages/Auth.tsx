import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Coffee, ArrowLeft, Mail } from "lucide-react";
import { getUserFriendlyError } from "@/lib/errorHandler";

type AuthView = "signin" | "forgot-password" | "check-email";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<AuthView>("signin");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [resetEmail, setResetEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) throw error;
      toast({ title: "Welcome back!", description: "You have successfully signed in." });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error, 'authentication'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setView("check-email");
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error, 'resetPassword'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary via-primary/90 to-accent/30">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Coffee className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Liza Coffee Washing Station
          </CardTitle>
          <CardDescription>
            {view === "signin" && "Sign in to your account"}
            {view === "forgot-password" && "Reset your password"}
            {view === "check-email" && "Check your email"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* SIGN IN VIEW */}
          {view === "signin" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Need an account? Contact your system administrator.
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a secure link to reset your password. The link expires in 1 hour.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <button
                type="button"
                onClick={() => setView("signin")}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </button>
            </form>
          )}

          {/* CHECK EMAIL VIEW */}
          {view === "check-email" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Email Sent!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  We sent a password reset link to <span className="font-medium text-foreground">{resetEmail}</span>.
                  Check your inbox and click the link to reset your password.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  The link will expire in <span className="font-medium">1 hour</span>. Check your spam folder if you don't see it.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setView("signin"); setResetEmail(""); }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
              <button
                type="button"
                onClick={() => handleForgotPassword({ preventDefault: () => {} } as React.FormEvent)}
                className="text-sm text-primary hover:underline"
                disabled={loading}
              >
                {loading ? "Sending..." : "Resend email"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
