import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Clock,
  Loader2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { dispatchAppointmentNotification } from "@/lib/notifications/dispatcher";
import {
  SERVICES,
  buildDaySlots,
  isPastSlot,
  normalizeTime,
  toDateKey,
  type Service,
} from "@/lib/salon";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book an appointment — Lumière Nails" },
      {
        name: "description",
        content:
          "Choose your gel polish service, pick an available date and time, and confirm your booking online.",
      },
      { property: "og:title", content: "Book an appointment — Lumière Nails" },
      {
        property: "og:description",
        content: "Pick a service, a free time slot and confirm your nail appointment.",
      },
    ],
  }),
  component: BookPage,
});

const detailsSchema = z.object({
  client_name: z.string().trim().min(2, "Please enter your name").max(80),
  client_phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number")
    .max(25)
    .regex(/^[0-9+\-\s()]+$/, "Phone can only contain digits and + - ( )"),
  notes: z.string().trim().max(500, "Notes must be under 500 characters"),
});

const STEPS = ["Service", "Date & time", "Details", "Done"];

function BookPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [step, setStep] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ client_name: "", client_phone: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auth sub-form state when user is not signed in
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Sync profile data to form when available
  useEffect(() => {
    if (profile) {
      setForm((prev) => ({
        ...prev,
        client_name: prev.client_name || profile.full_name || "",
        client_phone: prev.client_phone || profile.phone || "",
      }));
    } else if (user?.user_metadata) {
      const meta = user.user_metadata;
      const metaName = typeof meta["full_name"] === "string" ? meta["full_name"] : "";
      const metaPhone = typeof meta["phone"] === "string" ? meta["phone"] : "";
      setForm((prev) => ({
        ...prev,
        client_name: prev.client_name || metaName,
        client_phone: prev.client_phone || metaPhone,
      }));
    }
  }, [profile, user]);

  const dateKey = date ? toDateKey(date) : null;

  const availability = useQuery({
    queryKey: ["availability", dateKey],
    enabled: Boolean(dateKey),
    queryFn: async () => {
      const key = dateKey!;
      const weekday = new Date(`${key}T00:00:00`).getDay();

      const [hours, blocked, taken] = await Promise.all([
        supabase.from("working_hours").select("*").eq("day_of_week", weekday).maybeSingle(),
        supabase.from("blocked_slots").select("block_time").eq("block_date", key),
        supabase.rpc("get_taken_times", { _date: key }),
      ]);

      if (hours.error) throw hours.error;
      if (blocked.error) throw blocked.error;
      if (taken.error) throw taken.error;

      if (!hours.data || !hours.data.is_open) return [] as string[];
      if ((blocked.data ?? []).some((b) => b.block_time === null)) return [] as string[];

      const blockedTimes = new Set(
        (blocked.data ?? []).filter((b) => b.block_time).map((b) => normalizeTime(b.block_time!)),
      );
      const takenTimes = new Set(
        ((taken.data ?? []) as { taken_time: string }[]).map((t) => normalizeTime(t.taken_time)),
      );

      return buildDaySlots(hours.data.open_time, hours.data.close_time).filter(
        (slot) => !blockedTimes.has(slot) && !takenTimes.has(slot) && !isPastSlot(key, slot),
      );
    },
  });

  const booking = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be signed in to book an appointment.");
      }

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          client_name: form.client_name.trim(),
          client_phone: form.client_phone.trim(),
          notes: form.notes.trim() || null,
          service_type: service!.id,
          appointment_date: dateKey!,
          appointment_time: time!,
          user_id: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (data?.id) {
        void dispatchAppointmentNotification(data.id, "appointment_confirmation");
      }
    },
    onSuccess: () => setStep(3),
    onError: (error: { code?: string; message: string }) => {
      if (error.code === "23505") {
        toast.error("That slot was just taken. Please choose another time.");
        setTime(null);
        setStep(1);
        void availability.refetch();
        return;
      }
      toast.error(error.message || "We couldn't save your booking. Please try again.");
    },
  });

  async function handleInlineAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        if (!authName.trim() || authName.trim().length < 2) {
          toast.error("Please enter your full name");
          setAuthLoading(false);
          return;
        }
        const cleanPhone = authPhone.trim();
        if (!cleanPhone || cleanPhone.length < 7) {
          toast.error("Please enter a valid phone number");
          setAuthLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              full_name: authName.trim(),
              phone: cleanPhone,
            },
          },
        });

        if (error) throw error;

        if (data.session && data.user) {
          // Guarantee profile record
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: authName.trim(),
            phone: cleanPhone,
            email: authEmail.trim(),
          });
          await refreshProfile();

          setForm((prev) => ({
            ...prev,
            client_name: authName.trim(),
            client_phone: cleanPhone,
          }));

          toast.success("Account created successfully!");
        } else {
          toast.success("Account created! Please check your email to verify, then sign in.");
          setAuthMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw error;

        await refreshProfile();
        toast.success("Signed in successfully!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  function submitDetails() {
    if (!user) {
      toast.error("Please sign in or create an account to book.");
      return;
    }

    const parsed = detailsSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    booking.mutate();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <ol className="mb-10 grid grid-cols-4 gap-2">
          {STEPS.map((label, index) => (
            <li key={label} className="min-w-0">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  index <= step ? "bg-primary" : "bg-border",
                )}
              />
              <p
                className={cn(
                  "mt-2 truncate text-xs",
                  index <= step ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </p>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl">Choose a service</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not sure? Pick the closest one — we can adjust in the studio.
                </p>
              </div>
              {!user && (
                <div className="hidden sm:block text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Already a client?</p>
                  <Link
                    to="/auth"
                    search={{ redirect: "/book" }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Sign in here
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3">
              {SERVICES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setService(item);
                    setStep(1);
                  }}
                  className={cn(
                    "w-full rounded-2xl border border-border bg-card p-5 text-start transition-all hover:border-primary hover:shadow-card",
                    service?.id === item.id && "border-primary shadow-card",
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <span className="truncate text-xl">{item.name}</span>
                    <span className="shrink-0 text-primary font-medium">{item.price}</span>
                  </div>
                  <p className="eyebrow mt-1">{item.duration}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-4xl">Pick a date &amp; time</h1>
            <p className="mt-2 text-sm text-muted-foreground font-medium text-primary">
              {service?.name} · {service?.price} ({service?.duration})
            </p>

            <div className="mt-6 flex justify-center rounded-3xl border border-border bg-card p-3 shadow-soft">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(value) => {
                  setDate(value);
                  setTime(null);
                }}
                disabled={{ before: today }}
                className={cn("pointer-events-auto")}
              />
            </div>

            {date && (
              <div className="mt-6">
                <p className="eyebrow">Available on {format(date, "EEEE, d MMM")}</p>
                {availability.isLoading ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Checking the diary…
                  </p>
                ) : availability.data && availability.data.length > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availability.data.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        className={cn(
                          "rounded-xl border border-border bg-card py-3 text-sm font-medium transition-colors hover:border-primary",
                          time === slot && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
                    No free slots on this day. Please try another date.
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(0)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={!date || !time}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-4xl">Your details</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {service?.name} · {date ? format(date, "EEEE, d MMM") : ""} · {time}
            </p>

            {/* REQUIRE SIGNED-IN USER */}
            {!user ? (
              <div className="mt-6 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Sign in to book</h2>
                    <p className="text-xs text-muted-foreground">
                      An account is required to reserve your slot and manage your bookings.
                    </p>
                  </div>
                </div>

                <div className="flex rounded-full bg-secondary/70 p-1 mt-6">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                      authMode === "signup"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signin")}
                    className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                      authMode === "signin"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sign in
                  </button>
                </div>

                <form onSubmit={handleInlineAuth} className="mt-5 space-y-4">
                  {authMode === "signup" && (
                    <>
                      <div>
                        <Label htmlFor="authName" className="flex items-center gap-1.5 text-xs">
                          <User className="size-3.5 text-muted-foreground" />
                          Full name
                        </Label>
                        <Input
                          id="authName"
                          type="text"
                          required
                          placeholder="e.g. Maya Cohen"
                          className="mt-1.5"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="authPhone" className="flex items-center gap-1.5 text-xs">
                          <Phone className="size-3.5 text-muted-foreground" />
                          Phone number
                        </Label>
                        <Input
                          id="authPhone"
                          type="tel"
                          inputMode="tel"
                          required
                          placeholder="e.g. 050-1234567"
                          className="mt-1.5"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="authEmail" className="flex items-center gap-1.5 text-xs">
                      <Mail className="size-3.5 text-muted-foreground" />
                      Email address
                    </Label>
                    <Input
                      id="authEmail"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="mt-1.5"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="authPassword" className="flex items-center gap-1.5 text-xs">
                      <Lock className="size-3.5 text-muted-foreground" />
                      Password
                    </Label>
                    <Input
                      id="authPassword"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="mt-1.5"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full rounded-full py-5 mt-2"
                    disabled={authLoading}
                  >
                    {authLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                    {authMode === "signup" ? "Create account & continue" : "Sign in & continue"}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    to="/auth"
                    search={{ redirect: "/book" }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Need more options? Go to full sign-in page
                  </Link>
                </div>
              </div>
            ) : (
              /* ALREADY SIGNED IN */
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-4 text-primary" />
                    <span>
                      Booking as{" "}
                      <span className="font-semibold text-foreground">
                        {profile?.full_name || user.email}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-xs text-muted-foreground hover:text-destructive underline"
                  >
                    Switch account
                  </button>
                </div>

                <div>
                  <Label htmlFor="client_name">Full name</Label>
                  <Input
                    id="client_name"
                    className="mt-2"
                    maxLength={80}
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                  {errors["client_name"] && (
                    <p className="mt-1 text-xs text-destructive">{errors["client_name"]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="client_phone">Phone number</Label>
                  <Input
                    id="client_phone"
                    type="tel"
                    inputMode="tel"
                    className="mt-2"
                    maxLength={25}
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                  {errors["client_phone"] && (
                    <p className="mt-1 text-xs text-destructive">{errors["client_phone"]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    className="mt-2"
                    maxLength={500}
                    rows={4}
                    placeholder="Colour ideas, allergies, anything we should know"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                  {errors["notes"] && (
                    <p className="mt-1 text-xs text-destructive">{errors["notes"]}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={!user || booking.isPending}
                onClick={submitDetails}
              >
                {booking.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Confirm booking
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="py-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10">
              <Check className="size-8 text-primary" />
            </div>
            <h1 className="mt-6 text-4xl">You're booked!</h1>
            <p className="mt-3 text-muted-foreground">
              {service?.name} on {date ? format(date, "EEEE, d MMMM") : ""} at {time}.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              We'll send updates and confirm via {form.client_phone}.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/my-bookings">View my appointments</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/">Back home</Link>
              </Button>
              <Button
                className="rounded-full"
                onClick={() => {
                  setStep(0);
                  setService(null);
                  setDate(undefined);
                  setTime(null);
                  setForm({
                    client_name: profile?.full_name || "",
                    client_phone: profile?.phone || "",
                    notes: "",
                  });
                }}
              >
                <CalendarCheck className="size-4 mr-2" /> Book another
              </Button>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
