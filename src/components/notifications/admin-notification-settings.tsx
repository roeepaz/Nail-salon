import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  Loader2,
  Calendar,
  Globe,
  Sliders,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BusinessNotificationSettings {
  id: string;
  appointment_confirmation: boolean;
  appointment_cancellation: boolean;
  appointment_reminder_24h: boolean;
  appointment_reminder_1h: boolean;
  reminder_24h_window_minutes: number;
  reminder_1h_window_minutes: number;
  timezone: string;
}

interface NotificationLog {
  id: string;
  appointment_id: string;
  user_id: string | null;
  type: string;
  channel: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

export function AdminNotificationSettings() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch business settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["business_notification_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_notification_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (error) throw error;
      return (
        data || {
          id: "default",
          appointment_confirmation: true,
          appointment_cancellation: true,
          appointment_reminder_24h: true,
          appointment_reminder_1h: true,
          reminder_24h_window_minutes: 10,
          reminder_1h_window_minutes: 10,
          timezone: "Asia/Jerusalem",
        }
      );
    },
  });

  // Fetch notification logs
  const { data: logs, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["notification_logs", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as NotificationLog[];
    },
  });

  // Update business settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updated: Partial<BusinessNotificationSettings>) => {
      const { error } = await supabase
        .from("business_notification_settings")
        .upsert({ id: "default", ...settings, ...updated });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Studio notification settings saved");
      void queryClient.invalidateQueries({ queryKey: ["business_notification_settings"] });
    },
    onError: (err) => {
      toast.error("Failed to update settings: " + (err instanceof Error ? err.message : ""));
    },
  });

  const handleToggle = (key: keyof BusinessNotificationSettings, val: boolean | number | string) => {
    updateSettingsMutation.mutate({ [key]: val });
  };

  // Trigger reminder scheduler test
  const handleTriggerProcessor = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-appointment-notifications", {
        body: {},
      });

      if (error) {
        toast.error(`Processor error: ${error.message}`);
      } else {
        toast.success(`Processed reminders successfully! ${JSON.stringify(data?.stats || {})}`);
        void refetchLogs();
      }
    } catch (err) {
      toast.error("Processor invocation failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs gap-1">
            <CheckCircle2 className="size-3" /> Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20 text-xs gap-1">
            <XCircle className="size-3" /> Failed
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs gap-1">
            <AlertTriangle className="size-3" /> Skipped
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs gap-1">
            <Clock className="size-3" /> {status}
          </Badge>
        );
    }
  };

  const getChannelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      push: "bg-purple-50 text-purple-700 border-purple-200",
      email: "bg-blue-50 text-blue-700 border-blue-200",
      whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return (
      <Badge variant="outline" className={`text-[11px] font-mono capitalize ${colors[channel] || ""}`}>
        {channel}
      </Badge>
    );
  };

  return (
    <div className="space-y-8">
      {/* Studio Notification Rules */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            <h3 className="text-lg font-display font-medium text-foreground">
              Studio Notification System Rules
            </h3>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1.5 text-xs"
            onClick={handleTriggerProcessor}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Run Reminder Scheduler Now
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Global notification toggles for Lumière Nails. Disabling a notification here stops it studio-wide regardless of individual client preferences.
        </p>

        {isLoadingSettings ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline-block mr-2" />
            Loading studio settings…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">Appointment Confirmation</Label>
                  <p className="text-xs text-muted-foreground">Sent upon booking creation</p>
                </div>
                <Switch
                  checked={settings?.appointment_confirmation ?? true}
                  onCheckedChange={(val) => handleToggle("appointment_confirmation", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">Cancellation Notification</Label>
                  <p className="text-xs text-muted-foreground">Sent when appointment is canceled</p>
                </div>
                <Switch
                  checked={settings?.appointment_cancellation ?? true}
                  onCheckedChange={(val) => handleToggle("appointment_cancellation", val)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">24-Hour Reminder</Label>
                  <p className="text-xs text-muted-foreground">Automatic reminder 1 day prior</p>
                </div>
                <Switch
                  checked={settings?.appointment_reminder_24h ?? true}
                  onCheckedChange={(val) => handleToggle("appointment_reminder_24h", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">1-Hour Reminder</Label>
                  <p className="text-xs text-muted-foreground">Automatic reminder 1 hour prior</p>
                </div>
                <Switch
                  checked={settings?.appointment_reminder_1h ?? true}
                  onCheckedChange={(val) => handleToggle("appointment_reminder_1h", val)}
                />
              </div>
            </div>

            {/* Timezone and window config */}
            <div className="md:col-span-2 pt-2 flex flex-col sm:flex-row gap-4 text-xs text-muted-foreground bg-muted/20 p-4 rounded-xl border border-border/40">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <span>Timezone: <strong>{settings?.timezone || "Asia/Jerusalem"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span>24h Reminder Window: <strong>±{settings?.reminder_24h_window_minutes || 10} min</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span>1h Reminder Window: <strong>±{settings?.reminder_1h_window_minutes || 10} min</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification Logs History & Duplicate Prevention Inspector */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-display font-medium text-foreground">
              Notification History & Delivery Logs
            </h3>
            <p className="text-xs text-muted-foreground">
              Immutable audit log of all notification attempts with idempotent duplicate prevention.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1.5"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-8 px-2.5 text-xs"
              onClick={() => void refetchLogs()}
            >
              <RefreshCw className="size-3" />
            </Button>
          </div>
        </div>

        {isLoadingLogs ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline-block mr-2" />
            Loading logs…
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No notification logs found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider ID / Error</TableHead>
                  <TableHead className="w-[120px]">Appointment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="font-mono text-muted-foreground">
                      {new Date(log.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {log.type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>{getChannelBadge(log.channel)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="max-w-[280px] truncate font-mono text-[11px] text-muted-foreground">
                      {log.provider_message_id ? (
                        <span className="text-emerald-700 font-semibold">ID: {log.provider_message_id}</span>
                      ) : log.error_message ? (
                        <span className="text-destructive" title={log.error_message}>
                          {log.error_message}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {log.appointment_id.slice(0, 8)}…
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
