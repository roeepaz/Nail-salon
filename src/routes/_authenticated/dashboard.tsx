import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarClock, LogOut, Plus, Sparkles, Trash2, Bell, Check, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { AdminNotificationSettings } from "@/components/notifications/admin-notification-settings";
import { dispatchAppointmentNotification } from "@/lib/notifications/dispatcher";
import { DAY_NAMES, normalizeTime, toDateKey, SERVICES } from "@/lib/salon";
import { useServices } from "@/hooks/use-salon-data";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "לוח ניהול סטודיו - אליאל ביוטי" },
      { name: "description", content: "ניהול תורים, סטטוסים ושעות פעילות הסטודיו." },
      { property: "og:title", content: "לוח ניהול סטודיו - אליאל ביוטי" },
      { property: "og:description", content: "ניהול תורים ושעות פעילות הסטודיו." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Appointment = {
  id: string;
  client_name: string;
  client_phone: string;
  service_type: string;
  notes: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  canceled: "bg-destructive/10 text-destructive border border-destructive/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "מאושר",
  canceled: "מבוטל",
};

function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Non-fatal if audio context is blocked
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const [pendingDelete, setPendingDelete] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAdmin) {
      toast.error("גישה ללוח הניהול מוגבלת למנהלים בלבד.");
      void navigate({ to: "/my-bookings", replace: true });
    }
  }, [isAdmin, isAuthLoading, navigate]);

  // Live Realtime listener for incoming appointments & cancellations
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-appointments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ["appointments"] });

          if (payload.eventType === "INSERT") {
            playNotificationSound();
            const newApt = payload.new as Appointment;
            toast.info(`🔔 תור חדש התקבל! ${newApt.client_name} ממתינה לאישורך.`, {
              duration: 8000,
            });
          } else if (
            payload.eventType === "UPDATE" &&
            (payload.new as Appointment).status === "canceled" &&
            (payload.old as Appointment).status !== "canceled"
          ) {
            playNotificationSound();
            const apt = payload.new as Appointment;
            toast.warning(`⚠️ תור בוטל על ידי הלקוחה: ${apt.client_name}`);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);

  const appointments = useQuery({
    queryKey: ["appointments"],
    enabled: !isAuthLoading && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: (data) => {
      if (data.status === "confirmed") {
        toast.success("התור אושר והודעת אישור נשלחה ללקוחה ✨");
        void dispatchAppointmentNotification(data.id, "appointment_confirmation");
      } else if (data.status === "canceled") {
        toast.success("התור בוטל והודעת ביטול נשלחה ללקוחה");
        void dispatchAppointmentNotification(data.id, "appointment_cancellation");
      } else {
        toast.success("סטטוס התור עודכן לממתין לאישור");
      }
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => toast.error("לא ניתן היה לעדכן את הסטטוס"),
  });

  const removeAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("התור נמחק בהצלחה");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => toast.error("לא ניתן היה למחוק את התור"),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const todayKey = toDateKey(new Date());
  const rows = appointments.data ?? [];
  const todays = rows.filter((a) => a.appointment_date === todayKey && a.status !== "canceled");
  const upcoming = rows.filter((a) => a.appointment_date > todayKey && a.status !== "canceled");
  const { data: dbServices = SERVICES } = useServices({ activeOnly: false });

  function getServiceName(serviceType: string) {
    const found = dbServices.find((s) => s.id === serviceType || s.name === serviceType);
    return found?.name || serviceType;
  }


  return (
    <div className="min-h-screen bg-background text-right" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <span className="truncate font-display text-xl font-medium tracking-wide">
              אליאל ביוטי - ניהול סטודיו
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full gap-1.5"
              onClick={() => void navigate({ to: "/settings" })}
            >
              <Settings2 className="size-4" /> עריכה
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 rounded-full gap-1.5" onClick={signOut}>
              <LogOut className="size-4" /> התנתקות
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="היום" value={todays.length} />
          <StatCard label="תורים קרובים" value={upcoming.length} />
          <StatCard
            label="ממתינים לאישור"
            value={rows.filter((a) => a.status === "pending").length}
          />
        </div>

        <Tabs defaultValue="schedule" className="mt-8">
          <TabsList className="rounded-full">
            <TabsTrigger value="schedule" className="rounded-full">
              לוח זמנים
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-full">
              כל התורים
            </TabsTrigger>
            <TabsTrigger value="availability" className="rounded-full">
              שעות פעילות ויומן
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-full gap-1.5">
              <Bell className="size-3.5" /> התראות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6 space-y-8">
            <ScheduleList
              title="היום"
              items={todays}
              onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
            />
            <ScheduleList
              title="תורים עתידיים"
              items={upcoming}
              onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="shadow-card overflow-x-auto rounded-3xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">שעה</TableHead>
                    <TableHead className="text-right">לקוחה</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">טיפול</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        אין תורים עדיין.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => {
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(`${row.appointment_date}T00:00:00`), "d בMMMM yyyy", {
                            locale: he,
                          })}
                        </TableCell>
                        <TableCell>{normalizeTime(row.appointment_time)}</TableCell>
                        <TableCell className="font-medium">{row.client_name}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs" dir="ltr">
                          {row.client_phone}
                        </TableCell>
                        <TableCell>{getServiceName(row.service_type)}</TableCell>
                        <TableCell>
                          <Select
                            value={row.status}
                            onValueChange={(status) => updateStatus.mutate({ id: row.id, status })}
                          >
                            <SelectTrigger className="w-32 rounded-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="pending">ממתין</SelectItem>
                              <SelectItem value="confirmed">מאושר</SelectItem>
                              <SelectItem value="canceled">מבוטל</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(row)}
                            aria-label="מחיקת תור"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="availability" className="mt-6">
            <AvailabilityPanel />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <AdminNotificationSettings />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את התור לצמיתות?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.client_name} ·{" "}
              {pendingDelete ? normalizeTime(pendingDelete.appointment_time) : ""}. פעולה זו תמחק
              את התור מהמערכת ולא ניתן לשחזר אותה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
            <AlertDialogCancel className="rounded-full">ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) removeAppointment.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              מחיקה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="shadow-card rounded-3xl border border-border bg-card p-5 text-right">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold">{value}</p>
    </div>
  );
}

function ScheduleList({
  title,
  items,
  onUpdateStatus,
}: {
  title: string;
  items: Appointment[];
  onUpdateStatus: (id: string, status: string) => void;
}) {
  return (
    <section>
      <h2 className="text-2xl font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          אין תורים מתוכננים.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const serviceInfo = SERVICES.find(
              (s) => s.id === item.service_type || s.name === item.service_type,
            );
            return (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{item.client_name}</p>
                    <Badge className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[item.status] ?? ""}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground mt-0.5">
                    {format(new Date(`${item.appointment_date}T00:00:00`), "EEEE, d בMMMM", {
                      locale: he,
                    })}{" "}
                    · {normalizeTime(item.appointment_time)} · {serviceInfo?.name || item.service_type}
                  </p>
                  {item.notes && (
                    <p className="mt-1 truncate text-xs text-muted-foreground italic">"{item.notes}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "pending" && (
                    <Button
                      size="sm"
                      className="h-8 rounded-full text-xs font-medium px-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-sm"
                      onClick={() => onUpdateStatus(item.id, "confirmed")}
                    >
                      <Check className="size-3.5 ml-1" />
                      אישור תור
                    </Button>
                  )}
                  <Select
                    value={item.status}
                    onValueChange={(status) => onUpdateStatus(item.id, status)}
                  >
                    <SelectTrigger className="w-28 h-8 rounded-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="pending">ממתין</SelectItem>
                      <SelectItem value="confirmed">מאושר</SelectItem>
                      <SelectItem value="canceled">מבוטל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type WorkingHour = {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

type BlockedSlot = {
  id: string;
  block_date: string;
  block_time: string | null;
  end_time: string | null;
  reason: string | null;
};

function AvailabilityPanel() {
  const queryClient = useQueryClient();
  const [blockDate, setBlockDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");

  const hours = useQuery({
    queryKey: ["working_hours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("working_hours").select("*").order("day_of_week");
      if (error) throw error;
      return (data ?? []) as WorkingHour[];
    },
  });

  const blocks = useQuery({
    queryKey: ["blocked_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("*")
        .order("block_date", { ascending: true })
        .order("block_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as BlockedSlot[];
    },
  });

  const saveHour = useMutation({
    mutationFn: async (row: WorkingHour) => {
      const { error } = await supabase
        .from("working_hours")
        .update({ is_open: row.is_open, open_time: row.open_time, close_time: row.close_time })
        .eq("day_of_week", row.day_of_week);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("שעות הפעילות נשמרו");
      void queryClient.invalidateQueries({ queryKey: ["working_hours"] });
    },
    onError: () => toast.error("לא ניתן היה לשמור את שעות הפעילות"),
  });

  const addBlock = useMutation({
    mutationFn: async () => {
      if (!blockDate) {
        toast.error("אנא בחרי תאריך לחסימה");
        return;
      }

      if (!isAllDay) {
        if (!startTime || !endTime) {
          toast.error("אנא הזיני שעת התחלה ושעת סיום");
          return;
        }
        if (startTime >= endTime) {
          toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
          return;
        }
      }

      const { error } = await supabase.from("blocked_slots").insert({
        block_date: blockDate,
        block_time: isAllDay ? null : startTime,
        end_time: isAllDay ? null : endTime,
        reason: reason.trim() || null,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("חסימה זו כבר קיימת עבור תאריך ושעות אלו");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(isAllDay ? "היום נחסם בהצלחה" : "טווח השעות נחסם בהצלחה");
      setBlockDate("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["blocked_slots"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "לא ניתן היה לחסום את המועד");
    },
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("החסימה הוסרה בהצלחה");
      void queryClient.invalidateQueries({ queryKey: ["blocked_slots"] });
    },
    onError: () => toast.error("לא ניתן היה להסיר את החסימה"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="shadow-card rounded-3xl border border-border bg-card p-6">
        <h2 className="text-2xl font-medium">שעות פעילות</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          שעות פעילות שבועיות לקביעת חלונות תורים פנויים
        </p>
        <div className="mt-5 space-y-3">
          {(hours.data ?? []).map((row) => (
            <div
              key={row.day_of_week}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">יום {DAY_NAMES[row.day_of_week]}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="time"
                    className="h-9 w-28 text-center"
                    value={normalizeTime(row.open_time)}
                    onChange={(e) =>
                      saveHour.mutate({ ...row, open_time: e.target.value || "09:00" })
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    className="h-9 w-28 text-center"
                    value={normalizeTime(row.close_time)}
                    onChange={(e) =>
                      saveHour.mutate({ ...row, close_time: e.target.value || "18:00" })
                    }
                  />
                </div>
              </div>
              <Switch
                checked={row.is_open}
                onCheckedChange={(checked) => saveHour.mutate({ ...row, is_open: checked })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="shadow-card rounded-3xl border border-border bg-card p-6">
        <h2 className="text-2xl font-medium">תאריכים ושעות חסומים</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          חסימת יום שלם או טווח שעות מסוים בתוך תאריך (למשל להפסקות או חופשות).
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="block_date">תאריך</Label>
            <Input
              id="block_date"
              type="date"
              className="mt-1.5"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="all_day_toggle" className="cursor-pointer text-sm font-medium">
                חסימת יום שלם
              </Label>
              <p className="text-xs text-muted-foreground">
                {isAllDay ? "כל שעות היום ייחסמו לקביעת תורים" : "חסימת טווח שעות מוגדר בתוך היום"}
              </p>
            </div>
            <Switch
              id="all_day_toggle"
              checked={isAllDay}
              onCheckedChange={setIsAllDay}
            />
          </div>

          {!isAllDay && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start_time">משעה</Label>
                  <Input
                    id="start_time"
                    type="time"
                    className="mt-1.5 text-center font-mono"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">עד שעה</Label>
                  <Input
                    id="end_time"
                    type="time"
                    className="mt-1.5 text-center font-mono"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              {startTime && endTime && startTime >= endTime && (
                <p className="text-xs font-medium text-destructive">
                  שעת הסיום חייבת להיות אחרי שעת ההתחלה.
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="reason">סיבה לחסימה (אופציונלי)</Label>
            <Input
              id="reason"
              className="mt-1.5 text-right"
              maxLength={120}
              placeholder="חופשה, סידורים אישיים, הפסקה וכו'"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Button
            className="w-full rounded-full font-medium"
            disabled={
              !blockDate ||
              (!isAllDay && (!startTime || !endTime || startTime >= endTime)) ||
              addBlock.isPending
            }
            onClick={() => addBlock.mutate()}
          >
            <Plus className="size-4 ml-1" />
            {isAllDay ? "חסימת יום שלם" : `חסימת טווח שעות (${startTime} – ${endTime})`}
          </Button>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">רשימת חסימות קיימות</h3>
          <ul className="space-y-2">
            {(blocks.data ?? []).length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                אין תאריכים או שעות חסומים כרגע
              </li>
            ) : (
              (blocks.data ?? []).map((block) => {
                const isWholeDay = !block.block_time;
                return (
                  <li
                    key={block.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 p-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <CalendarClock className="size-4 shrink-0 text-primary" />
                          {format(new Date(`${block.block_date}T00:00:00`), "EEEE, d בMMMM yyyy", {
                            locale: he,
                          })}
                        </span>
                        {isWholeDay ? (
                          <Badge variant="secondary" className="rounded-full text-xs font-normal">
                            יום שלם
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary/30 bg-primary/5 text-xs font-mono font-normal text-primary"
                            dir="ltr"
                          >
                            {normalizeTime(block.block_time!)}{" "}
                            {block.end_time ? `– ${normalizeTime(block.end_time)}` : ""}
                          </Badge>
                        )}
                      </div>
                      {block.reason && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{block.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="הסרת חסימה"
                      className="hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeBlock.mutate(block.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
