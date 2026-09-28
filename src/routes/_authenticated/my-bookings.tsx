import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
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
import { dispatchAppointmentNotification } from "@/lib/notifications/dispatcher";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { SERVICES, toDateKey } from "@/lib/salon";

export const Route = createFileRoute("/_authenticated/my-bookings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Appointments — Lumière Nails" },
      { name: "description", content: "View and manage your upcoming and past salon bookings." },
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
    return { label: "Confirmed", className: "bg-primary/15 text-primary border-primary/20" };
  }
  if (status === "canceled") {
    return {
      label: "Canceled",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    };
  }
  return { label: "Pending", className: "bg-secondary text-secondary-foreground" };
}

function MyBookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancelingAppointment, setCancelingAppointment] = useState<Appointment | null>(null);

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
      toast.success("Appointment canceled");
      void dispatchAppointmentNotification(canceledId, "appointment_cancellation");
      setCancelingAppointment(null);
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: () => {
      toast.error("Could not cancel the appointment. Please contact the studio.");
    },
  });

  const todayKey = toDateKey(new Date());
  const bookings = bookingsQuery.data ?? [];
  const upcoming = bookings.filter(
    (b) => b.appointment_date >= todayKey && b.status !== "canceled",
  );
  const past = bookings.filter((b) => b.appointment_date < todayKey || b.status === "canceled");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-3xl font-display sm:text-4xl">My appointments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your scheduled visits and appointment status.
            </p>
          </div>
          <Button asChild className="rounded-full shadow-sm">
            <Link to="/book">
              <PlusCircle className="size-4 mr-2" /> Book new appointment
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="bookings" className="mt-8">
          <TabsList className="mb-8 rounded-full bg-muted/70 p-1">
            <TabsTrigger
              value="bookings"
              className="rounded-full px-5 py-2 text-xs font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Calendar className="size-3.5" /> Scheduled Visits
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-full px-5 py-2 text-xs font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Bell className="size-3.5" /> Notification Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            {bookingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin mr-2" />
            <span>Loading your appointments…</span>
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
            <div className="mx-auto size-14 rounded-full bg-primary/10 grid place-items-center text-primary mb-4">
              <Calendar className="size-7" />
            </div>
            <h2 className="text-2xl font-display">No appointments yet</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Treat your nails with our professional gel manicure and pedicure services.
            </p>
            <Button asChild className="mt-6 rounded-full px-6">
              <Link to="/book">Book your first visit</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  Upcoming appointments ({upcoming.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((item) => {
                    const serviceInfo = SERVICES.find((s) => s.id === item.service_type);
                    const badge = getBadge(item.status);
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-lg">
                              {serviceInfo?.name || item.service_type}
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
                              <Calendar className="size-4 text-primary" />
                              {format(
                                new Date(`${item.appointment_date}T00:00:00`),
                                "EEEE, d MMM yyyy",
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
                        </div>

                        <div className="mt-5 pt-4 border-t border-border/50 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                            onClick={() => setCancelingAppointment(item)}
                          >
                            <XCircle className="size-3.5 mr-1.5" /> Cancel appointment
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
                  Past &amp; canceled ({past.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {past.map((item) => {
                    const serviceInfo = SERVICES.find((s) => s.id === item.service_type);
                    const badge = getBadge(item.status);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/60 bg-card/60 p-4 opacity-75"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">
                            {serviceInfo?.name || item.service_type}
                          </span>
                          <Badge
                            variant="outline"
                            className={`rounded-full text-xs px-2 py-0 ${badge.className}`}
                          >
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(`${item.appointment_date}T00:00:00`), "d MMM yyyy")} at{" "}
                          {item.appointment_time.slice(0, 5)}
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
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel appointment?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel your appointment for{" "}
                <span className="font-semibold text-foreground">
                  {cancelingAppointment?.service_type} on {cancelingAppointment?.appointment_date}{" "}
                  at {cancelingAppointment?.appointment_time.slice(0, 5)}
                </span>
                ? You will need to re-book if you change your mind.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Keep appointment</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (cancelingAppointment) cancelMutation.mutate(cancelingAppointment.id);
                }}
              >
                Yes, cancel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>

      <SiteFooter />
    </div>
  );
}
