import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Sparkles, User, Mail, Phone, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search) => authSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in & Register — Lumière Nails" },
      {
        name: "description",
        content: "Sign in or create your account to book your nail appointments.",
      },
      { property: "og:title", content: "Sign in & Register — Lumière Nails" },
      {
        property: "og:description",
        content: "Sign in or create an account to book your appointment.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAdmin, refreshProfile } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(search.mode || "signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = search.redirect || (isAdmin ? "/dashboard" : "/book");

  useEffect(() => {
    if (user) {
      void navigate({ to: redirectTo, replace: true });
    }
  }, [user, redirectTo, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim() || fullName.trim().length < 2) {
          toast.error("Please enter your full name.");
          setLoading(false);
          return;
        }

        const cleanPhone = phone.trim();
        if (!cleanPhone || cleanPhone.length < 7) {
          toast.error("Please enter a valid phone number.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: cleanPhone,
            },
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
          },
        });

        if (error) throw error;

        if (data.session && data.user) {
          // Explicit profile upsert to guarantee profile row is populated immediately
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            phone: cleanPhone,
            email: email.trim(),
          });

          await refreshProfile();
          toast.success("Welcome! Your account has been created.");
          await navigate({ to: redirectTo, replace: true });
        } else {
          toast.success(
            "Account created! Please check your email to verify your account, then sign in.",
          );
          setMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        await refreshProfile();

        // Check if user is admin
        let dest = search.redirect;
        if (!dest) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .eq("role", "admin")
            .maybeSingle();

          dest = roleData ? "/dashboard" : "/book";
        }

        toast.success("Signed in successfully!");
        await navigate({ to: dest, replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-hero flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-display text-xl tracking-wide">Lumière Nails</span>
          </Link>
          <div className="w-12" /> {/* balance spacing */}
        </div>

        <div className="shadow-soft mt-8 rounded-3xl border border-border/70 bg-card p-8 sm:p-9">
          <div className="flex rounded-full bg-secondary/70 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                mode === "signin"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <h1 className="text-3xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to manage your appointments and book faster."
              : "Sign up with your details to book and manage appointments."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="fullName" className="flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    Full name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    required
                    placeholder="e.g. Maya Cohen"
                    autoComplete="name"
                    className="mt-2"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" />
                    Phone number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="e.g. 050-1234567"
                    autoComplete="tel"
                    className="mt-2"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Required for appointment confirmations &amp; reminders.
                  </p>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="password" className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="mt-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && (
                <p className="mt-1 text-xs text-muted-foreground">At least 6 characters</p>
              )}
            </div>

            <Button type="submit" className="w-full rounded-full py-6 mt-2" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              {mode === "signin" ? "Sign in" : "Create account & continue"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
