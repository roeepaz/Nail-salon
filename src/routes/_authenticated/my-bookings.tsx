import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, Loader2, Sparkles, XCircle, PlusCircle, Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserNotificationSettings } from "@/components/notifications/user-notification-settings";
import { dispatchAppointmentNotification, dispatchAdminNotification } from "@/lib/notifications/dispatcher";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey } from "@/lib/salon";
import { useServices, getServiceName, getServiceInfo } from "@/hooks/use-salon-data";

export const Route = createFileRoute("/_authenticated/my-bookings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "התורים שלי - אליאל ביוטי" },
      { name: "description", content: "צפייה וניהול התורים שלך בסטודיו אליאל ביוטי." },
    ],
  }),
  component: MyBookingsPage,
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
  user_id: string | null;
};

function getBadge(status: string): { label: string; className: string } {
  if (status === "confirmed") {
    return { label: "מאושר ✓", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" };
  }
  if (status === "canceled") {
    return {
      label: "מבוטל",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    };
  }
  return { label: "ממתין לאישור ⏳", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium" };
}

function MyBookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancelingAppointment, setCancelingAppointment] = useState<Appointment | null>(null);
  const { data: dbServices = [] } = useServices({ activeOnly: false });

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user!.id)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "canceled" })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (canceledId) => {
      toast.success("התור בוטל בהצלחה");
      void dispatchAppointmentNotification(canceledId, "appointment_cancellation");
      void dispatchAdminNotification(canceledId, "booking_canceled");
      setCancelingAppointment(null);
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: () => {
      toast.error("לא ניתן היה לבטל את התור. אנא צרי קשר עם הסטודיו.");
    },
  });

  const todayKey = toDateKey(new Date());
  const bookings = bookingsQuery.data ?? [];
  const upcoming = bookings.filter(
    (b) => b.appointment_date >= todayKey && b.status !== "canceled",
  );
  const past = bookings.filter((b) => b.appointment_date < todayKey || b.status === "canceled");

  return (
    <div className="flex min-h-screen flex-col bg-background text-right" dir="rtl">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-3xl font-display sm:text-4xl font-medium">התורים שלי</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              מעקב אחר תורים מתוכננים והיסטוריית ביקורים.
            </p>
          </div>
          <Button asChild className="rounded-full shadow-sm font-medium">
            <Link to="/book" className="flex items-center gap-2">
              <PlusCircle className="size-4" /> קביעת תור חדש
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="bookings" className="mt-8">
          <TabsList className="mb-8 rounded-full bg-muted/70 p-1">
            <TabsTrigger
              value="bookings"
              className="rounded-full px-5 py-2 text-xs font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Calendar className="size-3.5 ml-1" /> תורים מוזמנים
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-full px-5 py-2 text-xs font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Bell className="size-3.5 ml-1" /> הגדרות התראות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            {bookingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin ml-2" />
            <span>טוען את התורים שלך…</span>
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
            <div className="mx-auto size-14 rounded-full bg-primary/10 grid place-items-center text-primary mb-4">
              <Calendar className="size-7" />
            </div>
            <h2 className="text-2xl font-display font-medium">עדיין אין תורים מוזמנים</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              פנקי את הציפורניים שלך במניקור ג'ל ופדיקור מקצועיים.
            </p>
            <Button asChild className="mt-6 rounded-full px-6 font-medium">
              <Link to="/book">לקביעת התור הראשון שלך</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
                  <Clock className="size-5 text-primary ml-1" />
                  תורים קרובים ({upcoming.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((item) => {
                    const serviceInfo = getServiceInfo(item.service_type, dbServices);
                    const serviceTitle = serviceInfo?.name || getServiceName(item.service_type, dbServices);
                    const badge = getBadge(item.status);
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-lg">
                              {serviceTitle}
                            </span>
                            <Badge
                              variant="outline"
                              className={`rounded-full px-2.5 py-0.5 ${badge.className}`}
                            >
                              {badge.label}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <Calendar className="size-4 text-primary ml-1" />
                              {format(
                                new Date(`${item.appointment_date}T00:00:00`),
                                "EEEE, d בMMMM yyyy",
                                { locale: he },
                              )}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-foreground">
                              {item.appointment_time.slice(0, 5)}
                            </span>
                          </div>
                          {serviceInfo && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {serviceInfo.duration} · {serviceInfo.price}
                            </p>
                          )}
                          {item.notes && (
                            <p className="mt-3 text-xs bg-secondary/50 rounded-lg p-2.5 text-muted-foreground italic">
                              "{item.notes}"
                            </p>
                          )}
                          {item.status === "pending" && (
                            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20">
                              התור ממתין לאישור מנהלת הסטודיו. תישלח אלייך הודעה ברגע שהתור יאושר.
                            </p>
                          )}
                        </div>

                        <div className="mt-5 pt-4 border-t border-border/50 flex justify-start">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive text-xs cursor-pointer"
                            onClick={() => setCancelingAppointment(item)}
                          >
                            <XCircle className="size-3.5 ml-1.5" /> ביטול תור
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-xl font-medium mb-4 text-muted-foreground">
                  תורים קודמים ומבוטלים ({past.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {past.map((item) => {
                    const serviceTitle = getServiceName(item.service_type, dbServices);
                    const badge = getBadge(item.status);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/60 bg-card/60 p-4 opacity-75"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">
                            {serviceTitle}
                          </span>
                          <Badge
                            variant="outline"
                            className={`rounded-full text-xs px-2 py-0 ${badge.className}`}
                          >
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(`${item.appointment_date}T00:00:00`), "d בMMMM yyyy", {
                            locale: he,
                          })}{" "}
                          בשעה {item.appointment_time.slice(0, 5)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            </div>
          )}
          </TabsContent>

          <TabsContent value="notifications" className="outline-none">
            <UserNotificationSettings />
          </TabsContent>
        </Tabs>

        <AlertDialog
          open={Boolean(cancelingAppointment)}
          onOpenChange={() => setCancelingAppointment(null)}
        >
          <AlertDialogContent className="rounded-3xl text-right" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>לבטל את התור?</AlertDialogTitle>
              <AlertDialogDescription>
                האם את בטוחה שברצונך לבטל את התור ל-{" "}
                <span className="font-semibold text-foreground">
                  {getServiceName(cancelingAppointment?.service_type, dbServices)}{" "}
                  בתאריך {cancelingAppointment?.appointment_date} בשעה{" "}
                  {cancelingAppointment?.appointment_time.slice(0, 5)}
                </span>
                ? אם תשני את דעתך, יהיה עלייך לקבוע תור מחדש.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
              <AlertDialogCancel className="rounded-full">השארת התור</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (cancelingAppointment) cancelMutation.mutate(cancelingAppointment.id);
                }}
              >
                כן, בטלי תור
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>

      <SiteFooter />
    </div>
  );
}
