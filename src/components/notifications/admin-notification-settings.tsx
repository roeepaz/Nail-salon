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
import { runReminderSchedulerFn } from "@/server/scheduler";
import { dispatchNotificationServerFn } from "@/server/notifications";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "failed" | "skipped">("all");

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
      const res = await runReminderSchedulerFn();

      if (!res.success) {
        toast.error(`Processor error: ${res.error || "Unknown error"}`);
      } else {
        const stats = res.stats;
        toast.success(
          `Evaluated ${stats?.evaluated || 0} appointments (24h reminders: ${stats?.reminders24hTriggered || 0}, 1h: ${stats?.reminders1hTriggered || 0})`,
        );
        void refetchLogs();
      }
    } catch (err) {
      toast.error("Processor invocation failed: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsProcessing(false);
    }
  };

  const [isSendingTest, setIsSendingTest] = useState(false);

  // Send a test confirmation email for the latest appointment (forces send past idempotency guard)
  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const { data: apts } = await supabase
        .from("appointments")
        .select("id, client_name, user_id")
        .order("created_at", { ascending: false })
        .limit(5);

      const target = apts?.[0];
      if (!target) {
        toast.error("No appointments found in database to test with.");
        return;
      }

      const res = await dispatchNotificationServerFn({
        data: {
          appointmentId: target.id,
          type: "appointment_confirmation",
          channels: ["email"],
          force: true,
        },
      });

      if (!res.success) {
        toast.error(`Error: ${res.error || "Failed to dispatch test email"}`);
        return;
      }

      const emailResult = res.results?.find((r) => r.channel === "email");
      if (!emailResult) {
        toast.error("No email result returned from notification service.");
      } else if (emailResult.status === "sent") {
        toast.success(
          `Confirmation email sent to ${target.client_name}! (Resend ID: ${emailResult.providerMessageId || "OK"})`,
        );
        void refetchLogs();
      } else if (emailResult.status === "skipped") {
        toast.warning(`Email was skipped: ${emailResult.errorMessage || "No email available or disabled"}`);
        void refetchLogs();
      } else {
        toast.error(`Email delivery failed: ${emailResult.errorMessage || "Unknown provider error"}`);
        void refetchLogs();
      }
    } catch (err) {
      toast.error("Failed to send test: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSendingTest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs gap-1">
            <CheckCircle2 className="size-3" /> נשלח
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20 text-xs gap-1">
            <XCircle className="size-3" /> נכשל
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs gap-1">
            <AlertTriangle className="size-3" /> דולג
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
    const labels: Record<string, string> = {
      push: "התראת דפדפן",
      email: "דוא״ל",
      whatsapp: "ווטסאפ",
    };
    return (
      <Badge variant="outline" className={`text-[11px] font-mono capitalize ${colors[channel] || ""}`}>
        {labels[channel] || channel}
      </Badge>
    );
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Studio Notification Rules */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            <h3 className="text-lg font-display font-medium text-foreground">
              הגדרות התראות סטודיו — אליאל ביוטי
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="rounded-full gap-1.5 text-xs shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer"
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
            >
              {isSendingTest ? <Loader2 className="size-3.5 animate-spin ml-1" /> : <Send className="size-3.5 ml-1" />}
              שליחת מייל אישור לדוגמה
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 text-xs font-medium cursor-pointer"
              onClick={handleTriggerProcessor}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="size-3.5 animate-spin ml-1" /> : <RefreshCw className="size-3.5 ml-1" />}
              הפעלת תזמון תזכורות עכשיו
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          מתגי שליטה גלובליים עבור סטודיו אליאל ביוטי. כיבוי התראה כאן ישבית אותה בכל הסטודיו.
        </p>

        {isLoadingSettings ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline-block ml-2" />
            טוען הגדרות סטודיו…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">אישור תור אוטומטי</Label>
                  <p className="text-xs text-muted-foreground">נשלח מיד עם קביעת התור ע"י הלקוחה</p>
                </div>
                <Switch
                  checked={settings?.appointment_confirmation ?? true}
                  onCheckedChange={(val) => handleToggle("appointment_confirmation", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">הודעת ביטול תור</Label>
                  <p className="text-xs text-muted-foreground">נשלחת כאשר תור מבוטל</p>
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
                  <Label className="text-sm font-medium">תזכורת 24 שעות לפני</Label>
                  <p className="text-xs text-muted-foreground">תזכורת אוטומטית יום לפני המועד</p>
                </div>
                <Switch
                  checked={settings?.appointment_reminder_24h ?? true}
                  onCheckedChange={(val) => handleToggle("appointment_reminder_24h", val)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <Label className="text-sm font-medium">תזכורת שעה לפני</Label>
                  <p className="text-xs text-muted-foreground">תזכורת אוטומטית שעה לפני תחילת התור</p>
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
                <Globe className="size-4 text-primary ml-1" />
                <span>אזור זמן: <strong>{settings?.timezone || "Asia/Jerusalem"}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary ml-1" />
                <span>חלון תזכורת 24 שעות: <strong>±{settings?.reminder_24h_window_minutes || 10} דק'</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary ml-1" />
                <span>חלון תזכורת שעה לפני: <strong>±{settings?.reminder_1h_window_minutes || 10} דק'</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification Logs History */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-display font-medium text-foreground">
              היסטוריית התראות ויומן משלוחים
            </h3>
            <p className="text-xs text-muted-foreground">
              יומן מעקב מלא אחר כל ההתראות שנשלחו עם מנגנון מניעת כפילויות.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "sent" | "failed" | "skipped")}
              className="text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1.5"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="sent">נשלח</option>
              <option value="failed">נכשל</option>
              <option value="skipped">דולג</option>
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
            <Loader2 className="size-5 animate-spin inline-block ml-2" />
            טוען יומן התראות…
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            לא נמצאו רשומות ביומן התראות.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] text-right">זמן</TableHead>
                  <TableHead className="text-right">סוג התראה</TableHead>
                  <TableHead className="text-right">ערוץ</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">מזהה ספק / שגיאה</TableHead>
                  <TableHead className="w-[120px] text-right">מזהה תור</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="font-mono text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("he-IL", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {log.type === "appointment_confirmation"
                        ? "אישור תור"
                        : log.type === "appointment_cancellation"
                        ? "ביטול תור"
                        : log.type === "appointment_reminder_24h"
                        ? "תזכורת 24 שעות"
                        : log.type === "appointment_reminder_1h"
                        ? "תזכורת שעה לפני"
                        : log.type}
                    </TableCell>
                    <TableCell>{getChannelBadge(log.channel)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="max-w-[280px] truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
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
                    <TableCell className="font-mono text-[11px] text-muted-foreground" dir="ltr">
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
