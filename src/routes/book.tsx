import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useServices } from "@/hooks/use-salon-data";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { dispatchAdminNotification } from "@/lib/notifications/dispatcher";
import {
  buildDaySlots,
  isPastSlot,
  isSlotBlocked,
  normalizeTime,
  toDateKey,
  type Service,
} from "@/lib/salon";


export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "קביעת תור - אליאל ביוטי" },
      {
        name: "description",
        content:
          "בחרי את הטיפול המבוקש, קבעי מועד נוח ושרייני תור אונליין בסטודיו אליאל ביוטי.",
      },
      { property: "og:title", content: "קביעת תור - אליאל ביוטי" },
      {
        property: "og:description",
        content: "בחרי טיפול, שעה פנויה ואשרי את התור שלך בקלות.",
      },
    ],
  }),
  component: BookPage,
});

const detailsSchema = z.object({
  client_name: z.string().trim().min(2, "אנא הזיני את שמך").max(80),
  client_phone: z
    .string()
    .trim()
    .min(7, "אנא הזיני מספר טלפון תקין")
    .max(25)
    .regex(/^[0-9+\-\s()]+$/, "מספר טלפון יכול להכיל ספרות בלבד"),
  notes: z.string().trim().max(500, "הערות עד 500 תווים"),
});

const STEPS = ["טיפול", "תאריך ושעה", "פרטים", "אישור"];

function BookPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { data: services = [] } = useServices({ activeOnly: true });

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
        supabase.from("blocked_slots").select("block_time, end_time").eq("block_date", key),
        supabase.rpc("get_taken_times", { _date: key }),
      ]);

      if (hours.error) throw hours.error;
      if (blocked.error) throw blocked.error;
      if (taken.error) throw taken.error;

      if (!hours.data || !hours.data.is_open) return [] as string[];
      if ((blocked.data ?? []).some((b) => b.block_time === null)) return [] as string[];

      const takenTimes = new Set(
        ((taken.data ?? []) as { taken_time: string }[]).map((t) => normalizeTime(t.taken_time)),
      );

      return buildDaySlots(hours.data.open_time, hours.data.close_time).filter(
        (slot) =>
          !isSlotBlocked(slot, blocked.data ?? []) &&
          !takenTimes.has(slot) &&
          !isPastSlot(key, slot),
      );
    },
  });

  const booking = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("יש להתחבר כדי לקבוע תור.");
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
      // Send immediate alert (email + browser push) to salon manager so they know a new booking is pending
      if (data?.id) {
        void dispatchAdminNotification(data.id, "new_booking");
      }
      // Note: We do NOT send "appointment_confirmation" to client here.
      // Appointments are created with status 'pending' and are confirmed only when
      // the manager approves them in the admin dashboard.
    },
    onSuccess: () => setStep(3),
    onError: (error: { code?: string; message: string }) => {
      if (error.code === "23505") {
        toast.error("שעה זו נתפסה זה עתה. אנא בחרי שעה אחרת.");
        setTime(null);
        setStep(1);
        void availability.refetch();
        return;
      }
      toast.error(error.message || "לא הצלחנו לשמור את התור. אנא נסי שוב.");
    },
  });

  async function handleInlineAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        if (!authName.trim() || authName.trim().length < 2) {
          toast.error("אנא הזיני את שמך המלא");
          setAuthLoading(false);
          return;
        }
        const cleanPhone = authPhone.trim();
        if (!cleanPhone || cleanPhone.length < 7) {
          toast.error("אנא הזיני מספר טלפון תקין");
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

          toast.success("החשבון נוצר בהצלחה!");
        } else {
          toast.success("החשבון נוצר! אנא אשרי את החשבון במייל ולאחר מכן התחברי.");
          setAuthMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw error;

        await refreshProfile();
        toast.success("התחברת בהצלחה!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההתחברות נכשלה");
    } finally {
      setAuthLoading(false);
    }
  }

  function submitDetails() {
    if (!user) {
      toast.error("אנא התחברי או צרי חשבון כדי לקבוע תור.");
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
    <div className="flex min-h-screen flex-col bg-background text-right" dir="rtl">
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
                <h1 className="text-4xl font-medium">בחירת טיפול</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  מתלבטת? בחרי את הטיפול הקרוב ביותר - נוכל להתאים בסטודיו.
                </p>
              </div>
              {!user && (
                <div className="hidden sm:block text-left shrink-0">
                  <p className="text-xs text-muted-foreground">לקוחה רשומה?</p>
                  <Link
                    to="/auth"
                    search={{ redirect: "/book" }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    התחברי כאן
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3">
              {services.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setService(item);
                    setStep(1);
                  }}
                  className={cn(
                    "w-full rounded-2xl border border-border bg-card p-5 text-start transition-all hover:border-primary hover:shadow-card cursor-pointer",
                    service?.id === item.id && "border-primary shadow-card",
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <span className="truncate text-xl font-medium">{item.name}</span>
                    <span className="shrink-0 text-primary font-semibold">{item.price}</span>
                  </div>
                  <p className="eyebrow mt-1">{item.duration}</p>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-4xl font-medium">בחירת תאריך ושעה</h1>
            <p className="mt-2 text-sm text-muted-foreground font-medium text-primary">
              {service?.name} · {service?.price} ({service?.duration})
            </p>

            <div className="mt-6 w-full max-w-md mx-auto rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-soft" dir="rtl">
              <Calendar
                locale={he}
                mode="single"
                selected={date}
                onSelect={(value) => {
                  setDate(value);
                  setTime(null);
                }}
                disabled={{ before: today }}
                className="w-full p-0 pointer-events-auto"
              />
              <div className="mt-3.5 flex items-center justify-center gap-5 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary inline-block" />
                  תאריך נבחר
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full border border-primary/50 bg-primary/10 inline-block" />
                  היום
                </span>
              </div>
            </div>

            {date && (
              <div className="mt-5 w-full max-w-md mx-auto rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-soft">
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">מועדים פנויים</p>
                    <h3 className="text-base font-medium text-foreground">
                      יום {format(date, "EEEE, d בMMMM yyyy", { locale: he })}
                    </h3>
                  </div>
                  {time && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-xs font-mono font-medium px-2 py-0.5">
                      {time} נבחר
                    </Badge>
                  )}
                </div>

                {availability.isLoading ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>בודק שעות פנויות ביומן…</span>
                  </div>
                ) : availability.data && availability.data.length > 0 ? (
                  <div className="mt-3.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availability.data.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        className={cn(
                          "rounded-xl border border-border/80 bg-background py-2.5 text-xs sm:text-sm font-mono font-medium transition-all hover:border-primary hover:bg-primary/5 hover:scale-[1.02] cursor-pointer",
                          time === slot && "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]",
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3.5 rounded-2xl bg-secondary/60 p-4 text-center text-xs text-muted-foreground">
                    אין תורים פנויים ביום זה. אנא בחרי תאריך אחר בלוח השנה.
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 w-full max-w-md mx-auto flex gap-3">
              <Button variant="outline" className="rounded-full" onClick={() => setStep(0)}>
                <ArrowRight className="size-4 ml-1" /> חזרה
              </Button>
              <Button
                className="flex-1 rounded-full font-medium"
                disabled={!date || !time}
                onClick={() => setStep(2)}
              >
                המשך
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-4xl font-medium">פרטי ההזמנה</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {service?.name} · {date ? format(date, "EEEE, d בMMMM", { locale: he }) : ""} · {time}
            </p>

            {/* REQUIRE SIGNED-IN USER */}
            {!user ? (
              <div className="mt-6 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium">התחברי לקביעת תור</h2>
                    <p className="text-xs text-muted-foreground">
                      נדרש חשבון כדי לשריין את התור שלך ולנהל את ההזמנות.
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
                    יצירת חשבון
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
                    התחברות
                  </button>
                </div>

                <form onSubmit={handleInlineAuth} className="mt-5 space-y-4">
                  {authMode === "signup" && (
                    <>
                      <div>
                        <Label htmlFor="authName" className="flex items-center gap-1.5 text-xs">
                          <User className="size-3.5 text-muted-foreground" />
                          שם מלא
                        </Label>
                        <Input
                          id="authName"
                          type="text"
                          required
                          placeholder="לדוגמה: מיה כהן"
                          className="mt-1.5 text-right"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="authPhone" className="flex items-center gap-1.5 text-xs">
                          <Phone className="size-3.5 text-muted-foreground" />
                          מספר טלפון
                        </Label>
                        <Input
                          id="authPhone"
                          type="tel"
                          inputMode="tel"
                          required
                          placeholder="050-1234567"
                          dir="ltr"
                          className="mt-1.5 text-right"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="authEmail" className="flex items-center gap-1.5 text-xs">
                      <Mail className="size-3.5 text-muted-foreground" />
                      כתובת אימייל
                    </Label>
                    <Input
                      id="authEmail"
                      type="email"
                      required
                      placeholder="you@example.com"
                      dir="ltr"
                      className="mt-1.5 text-right"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="authPassword" className="flex items-center gap-1.5 text-xs">
                      <Lock className="size-3.5 text-muted-foreground" />
                      סיסמה
                    </Label>
                    <Input
                      id="authPassword"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      dir="ltr"
                      className="mt-1.5 text-right"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full rounded-full py-5 mt-2 font-medium"
                    disabled={authLoading}
                  >
                    {authLoading && <Loader2 className="size-4 animate-spin ml-2" />}
                    {authMode === "signup" ? "צרי חשבון והמשיכי" : "התחברי והמשיכי"}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    to="/auth"
                    search={{ redirect: "/book" }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    אפשרויות נוספות? עברי לעמוד ההתחברות המלא
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
                      הזמנה כ-{" "}
                      <span className="font-semibold text-foreground">
                        {profile?.full_name || user.email}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-xs text-muted-foreground hover:text-destructive underline cursor-pointer"
                  >
                    החלפת חשבון
                  </button>
                </div>

                <div>
                  <Label htmlFor="client_name">שם מלא</Label>
                  <Input
                    id="client_name"
                    className="mt-2 text-right"
                    maxLength={80}
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                  {errors["client_name"] && (
                    <p className="mt-1 text-xs text-destructive">{errors["client_name"]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="client_phone">מספר טלפון</Label>
                  <Input
                    id="client_phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    className="mt-2 text-right"
                    maxLength={25}
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                  {errors["client_phone"] && (
                    <p className="mt-1 text-xs text-destructive">{errors["client_phone"]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">הערות (אופציונלי)</Label>
                  <Textarea
                    id="notes"
                    className="mt-2 text-right"
                    maxLength={500}
                    rows={4}
                    placeholder="צבעים מבוקשים, אלרגיות, או כל דבר שחשוב שנדע"
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
                <ArrowRight className="size-4 ml-1" /> חזרה
              </Button>
              <Button
                className="flex-1 rounded-full font-medium"
                disabled={!user || booking.isPending}
                onClick={submitDetails}
              >
                {booking.isPending && <Loader2 className="size-4 animate-spin ml-2" />}
                שליחת בקשה לקביעת תור
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="py-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10">
              <Check className="size-8 text-primary" />
            </div>
            <h1 className="mt-6 text-3xl sm:text-4xl font-display font-medium">בקשת התור נשלחה בהצלחה! ✨</h1>
            <p className="mt-3 text-muted-foreground text-lg">
              {service?.name} ביום {date ? format(date, "EEEE, d בMMMM", { locale: he }) : ""} בשעה {time}.
            </p>
            <div className="mx-auto mt-5 max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-right">
              <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-1.5">
                <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                התור ממתין לאישור מנהלת הסטודיו
              </p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                בקשתך נקלטה במערכת. ברגע שמנהלת הסטודיו תאשר את התור בדף הניהול, תישלח אלייך הודעת אישור רשמית למספר <strong>{form.client_phone}</strong> ולמייל.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/my-bookings">לצפייה בסטטוס התור ב"תורים שלי"</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/">חזרה לדף הבית</Link>
              </Button>
              <Button
                className="rounded-full font-medium"
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
                <CalendarCheck className="size-4 ml-2" /> קביעת תור נוסף
              </Button>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
