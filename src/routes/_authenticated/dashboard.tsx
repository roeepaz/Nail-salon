import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarClock, LogOut, Plus, Sparkles, Trash2, Bell } from "lucide-react";
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
import { DAY_NAMES, normalizeTime, toDateKey } from "@/lib/salon";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Studio dashboard — Lumière Nails" },
      { name: "description", content: "Manage appointments, statuses and studio availability." },
      { property: "og:title", content: "Studio dashboard — Lumière Nails" },
      { property: "og:description", content: "Manage appointments and availability." },
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
  pending: "bg-secondary text-secondary-foreground",
  confirmed: "bg-primary/15 text-primary",
  canceled: "bg-destructive/10 text-destructive",
};

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const [pendingDelete, setPendingDelete] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAdmin) {
      toast.error("Studio dashboard is restricted to admins.");
      void navigate({ to: "/my-bookings", replace: true });
    }
  }, [isAdmin, isAuthLoading, navigate]);

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
      toast.success("Status updated");
      if (data.status === "confirmed") {
        void dispatchAppointmentNotification(data.id, "appointment_confirmation");
      } else if (data.status === "canceled") {
        void dispatchAppointmentNotification(data.id, "appointment_cancellation");
      }
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => toast.error("Could not update the status"),
  });

  const removeAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment deleted");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => toast.error("Could not delete the appointment"),
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <span className="truncate font-display text-xl tracking-wide">Studio dashboard</span>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Today" value={todays.length} />
          <StatCard label="Upcoming" value={upcoming.length} />
          <StatCard
            label="Awaiting confirmation"
            value={rows.filter((a) => a.status === "pending").length}
          />
        </div>

        <Tabs defaultValue="schedule" className="mt-8">
          <TabsList className="rounded-full">
            <TabsTrigger value="schedule" className="rounded-full">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-full">
              All appointments
            </TabsTrigger>
            <TabsTrigger value="availability" className="rounded-full">
              Availability
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-full gap-1.5">
              <Bell className="size-3.5" /> Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6 space-y-8">
            <ScheduleList title="Today" items={todays} />
            <ScheduleList title="Upcoming" items={upcoming} />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="shadow-card overflow-x-auto rounded-3xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No appointments yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(`${row.appointment_date}T00:00:00`), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>{normalizeTime(row.appointment_time)}</TableCell>
                      <TableCell className="font-medium">{row.client_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.client_phone}</TableCell>
                      <TableCell>{row.service_type}</TableCell>
                      <TableCell>
                        <Select
                          value={row.status}
                          onValueChange={(status) => updateStatus.mutate({ id: row.id, status })}
                        >
                          <SelectTrigger className="w-36 rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="canceled">Canceled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(row)}
                          aria-label="Delete appointment"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.client_name} ·{" "}
              {pendingDelete ? normalizeTime(pendingDelete.appointment_time) : ""}. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) removeAppointment.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="shadow-card rounded-3xl border border-border bg-card p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-4xl">{value}</p>
    </div>
  );
}

function ScheduleList({ title, items }: { title: string; items: Appointment[] }) {
  return (
    <section>
      <h2 className="text-2xl">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          Nothing scheduled.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.client_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {format(new Date(`${item.appointment_date}T00:00:00`), "EEE d MMM")} ·{" "}
                  {normalizeTime(item.appointment_time)} · {item.service_type}
                </p>
                {item.notes && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.notes}</p>
                )}
              </div>
              <Badge className={`shrink-0 rounded-full ${STATUS_STYLE[item.status] ?? ""}`}>
                {item.status}
              </Badge>
            </li>
          ))}
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
  reason: string | null;
};

function AvailabilityPanel() {
  const queryClient = useQueryClient();
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
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
      const { data, error } = await supabase.from("blocked_slots").select("*").order("block_date");
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
      toast.success("Working hours saved");
      void queryClient.invalidateQueries({ queryKey: ["working_hours"] });
    },
    onError: () => toast.error("Could not save working hours"),
  });

  const addBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("blocked_slots").insert({
        block_date: blockDate,
        block_time: blockTime || null,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Time blocked");
      setBlockDate("");
      setBlockTime("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["blocked_slots"] });
    },
    onError: () => toast.error("Could not block that time"),
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Block removed");
      void queryClient.invalidateQueries({ queryKey: ["blocked_slots"] });
    },
    onError: () => toast.error("Could not remove the block"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="shadow-card rounded-3xl border border-border bg-card p-6">
        <h2 className="text-2xl">Working hours</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Default opening times used to generate booking slots.
        </p>
        <div className="mt-5 space-y-3">
          {(hours.data ?? []).map((row) => (
            <div
              key={row.day_of_week}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{DAY_NAMES[row.day_of_week]}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="time"
                    className="h-9 w-28"
                    value={normalizeTime(row.open_time)}
                    onChange={(e) =>
                      saveHour.mutate({ ...row, open_time: e.target.value || "09:00" })
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    className="h-9 w-28"
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
        <h2 className="text-2xl">Blocked dates &amp; times</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave the time empty to block the entire day.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="block_date">Date</Label>
            <Input
              id="block_date"
              type="date"
              className="mt-2"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="block_time">Time (optional)</Label>
            <Input
              id="block_time"
              type="time"
              className="mt-2"
              value={blockTime}
              onChange={(e) => setBlockTime(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              className="mt-2"
              maxLength={120}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4 w-full rounded-full"
          disabled={!blockDate || addBlock.isPending}
          onClick={() => addBlock.mutate()}
        >
          <Plus className="size-4" /> Block time
        </Button>

        <ul className="mt-5 space-y-2">
          {(blocks.data ?? []).map((block) => (
            <li
              key={block.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm">
                  <CalendarClock className="size-4 shrink-0 text-primary" />
                  {format(new Date(`${block.block_date}T00:00:00`), "d MMM yyyy")}
                  {block.block_time ? ` · ${normalizeTime(block.block_time)}` : " · all day"}
                </p>
                {block.reason && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{block.reason}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove block"
                onClick={() => removeBlock.mutate(block.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
