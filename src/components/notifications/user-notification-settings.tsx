import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  HelpCircle,
  Loader2,
  Save,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getPushPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushPermissionState,
} from "@/lib/push-client";
import { normalizePhoneNumber, isValidE164 } from "@/lib/phone-utils";

interface NotificationPreferences {
  web_push_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  appointment_confirmation: boolean;
  appointment_cancellation: boolean;
  appointment_reminder_24h: boolean;
  appointment_reminder_1h: boolean;
}

export function UserNotificationSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const [pushState, setPushState] = useState<PushPermissionState>("unsupported");
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  // Phone editing state
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone || "");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  useEffect(() => {
    setPushState(getPushPermissionState());
  }, []);

  useEffect(() => {
    if (profile?.phone) {
      setPhoneNumber(profile.phone);
    }
  }, [profile?.phone]);

  // Load preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification_preferences", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch preferences:", error);
        throw error;
      }

      if (!data) {
        // Create default record if none exists
        const defaults: NotificationPreferences = {
          web_push_enabled: true,
          email_enabled: true,
          whatsapp_enabled: true,
          appointment_confirmation: true,
          appointment_cancellation: true,
          appointment_reminder_24h: true,
          appointment_reminder_1h: true,
        };

        const { data: created, error: insertError } = await supabase
          .from("notification_preferences")
          .upsert({ user_id: user!.id, ...defaults })
          .select()
          .single();

        if (insertError) throw insertError;
        return created;
      }

      return data;
    },
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (updated: Partial<NotificationPreferences>) => {
      const { error } = await supabase
        .from("notification_preferences")
        .update(updated)
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification preferences updated");
      void queryClient.invalidateQueries({ queryKey: ["notification_preferences", user?.id] });
    },
    onError: (err) => {
      toast.error("Failed to update preferences: " + (err instanceof Error ? err.message : "Unknown error"));
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleEnablePush = async () => {
    if (!user) return;
    setIsSubscribingPush(true);
    const res = await subscribeToPush(user.id);
    setIsSubscribingPush(false);
    setPushState(getPushPermissionState());

    if (res.success) {
      toast.success("Browser notifications enabled!");
      updateMutation.mutate({ web_push_enabled: true });
    } else {
      toast.error(res.error || "Could not enable browser notifications");
    }
  };

  const handleDisablePush = async () => {
    if (!user) return;
    setIsSubscribingPush(true);
    await unsubscribeFromPush(user.id);
    setIsSubscribingPush(false);
    updateMutation.mutate({ web_push_enabled: false });
    toast.success("Browser notifications disabled for this device");
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!isValidE164(normalized)) {
      toast.error("Please enter a valid phone number (e.g. 050-123-4567 or +972501234567)");
      return;
    }

    setIsSavingPhone(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: normalized, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      setPhoneNumber(normalized);
      toast.success(`WhatsApp number updated to ${normalized}`);
    } catch (err) {
      toast.error("Failed to update phone number: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingPhone(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        <span>Loading notification settings…</span>
      </div>
    );
  }

  const prefs = preferences || {
    web_push_enabled: true,
    email_enabled: true,
    whatsapp_enabled: true,
    appointment_confirmation: true,
    appointment_cancellation: true,
    appointment_reminder_24h: true,
    appointment_reminder_1h: true,
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Notification Channels */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <h3 className="text-lg font-display font-medium text-foreground mb-1">
          Notification Channels
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          Choose where and how you want to receive appointment reminders.
        </p>

        <div className="space-y-6 divide-y divide-border/50">
          {/* Browser / Web Push */}
          <div className="pt-4 first:pt-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center">
                  <Bell className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="web_push_toggle" className="font-medium text-sm cursor-pointer">
                      Browser notifications
                    </Label>
                    {pushState === "granted" && (
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[11px] gap-1 py-0">
                        <CheckCircle2 className="size-3" /> Granted
                      </Badge>
                    )}
                    {pushState === "denied" && (
                      <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20 text-[11px] gap-1 py-0">
                        <XCircle className="size-3" /> Denied
                      </Badge>
                    )}
                    {pushState === "prompt" && (
                      <Badge variant="outline" className="text-muted-foreground text-[11px] py-0">
                        Not requested
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Receive instant push alerts on this browser.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {pushState !== "granted" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs h-8 px-3"
                    disabled={isSubscribingPush || pushState === "denied"}
                    onClick={handleEnablePush}
                  >
                    {isSubscribingPush ? (
                      <Loader2 className="size-3 animate-spin mr-1" />
                    ) : null}
                    Enable browser notifications
                  </Button>
                ) : (
                  <Switch
                    id="web_push_toggle"
                    checked={prefs.web_push_enabled}
                    onCheckedChange={(val) => handleToggle("web_push_enabled", val)}
                  />
                )}
              </div>
            </div>

            {pushState === "denied" && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Browser notifications are blocked.</strong> To enable them: click the settings/lock icon in your browser address bar next to the website URL, open <em>Site Settings</em>, and change <em>Notifications</em> to <strong>Allow</strong>.
                </div>
              </div>
            )}
          </div>

          {/* Email Notifications */}
          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-blue-50 text-blue-600 grid place-items-center">
                <Mail className="size-4" />
              </div>
              <div>
                <Label htmlFor="email_toggle" className="font-medium text-sm cursor-pointer">
                  Email notifications
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sent to <span className="font-mono text-foreground">{profile?.email || user?.email}</span>
                </p>
              </div>
            </div>

            <Switch
              id="email_toggle"
              checked={prefs.email_enabled}
              onCheckedChange={(val) => handleToggle("email_enabled", val)}
            />
          </div>

          {/* WhatsApp Notifications */}
          <div className="pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <Label htmlFor="whatsapp_toggle" className="font-medium text-sm cursor-pointer">
                    WhatsApp notifications
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sent via official WhatsApp Business API
                  </p>
                </div>
              </div>

              <Switch
                id="whatsapp_toggle"
                checked={prefs.whatsapp_enabled}
                onCheckedChange={(val) => handleToggle("whatsapp_enabled", val)}
              />
            </div>

            {/* Phone number update field for WhatsApp */}
            <div className="mt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted/40 p-3 rounded-xl border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <Phone className="size-3.5" />
                <span>WhatsApp Phone:</span>
              </div>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+972501234567"
                className="h-8 text-xs font-mono bg-background"
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs px-3 shrink-0 rounded-lg gap-1.5"
                disabled={isSavingPhone || !phoneNumber.trim()}
                onClick={handleSavePhone}
              >
                {isSavingPhone ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                Update Phone
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Notification Event Triggers */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <h3 className="text-lg font-display font-medium text-foreground mb-1">
          Notification Preferences
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          Specify which reminders and updates you wish to receive.
        </p>

        <div className="space-y-5 divide-y divide-border/50">
          <div className="pt-3 first:pt-0 flex items-center justify-between">
            <div>
              <Label htmlFor="pref_confirmation" className="font-medium text-sm cursor-pointer">
                Appointment confirmation
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent immediately after you book an appointment
              </p>
            </div>
            <Switch
              id="pref_confirmation"
              checked={prefs.appointment_confirmation}
              onCheckedChange={(val) => handleToggle("appointment_confirmation", val)}
            />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <Label htmlFor="pref_24h" className="font-medium text-sm cursor-pointer">
                24-hour reminder
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent one day prior to your scheduled appointment
              </p>
            </div>
            <Switch
              id="pref_24h"
              checked={prefs.appointment_reminder_24h}
              onCheckedChange={(val) => handleToggle("appointment_reminder_24h", val)}
            />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <Label htmlFor="pref_1h" className="font-medium text-sm cursor-pointer">
                1-hour reminder
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent 1 hour before your appointment starts
              </p>
            </div>
            <Switch
              id="pref_1h"
              checked={prefs.appointment_reminder_1h}
              onCheckedChange={(val) => handleToggle("appointment_reminder_1h", val)}
            />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <Label htmlFor="pref_cancellation" className="font-medium text-sm cursor-pointer">
                Cancellation notification
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent if an appointment is canceled
              </p>
            </div>
            <Switch
              id="pref_cancellation"
              checked={prefs.appointment_cancellation}
              onCheckedChange={(val) => handleToggle("appointment_cancellation", val)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
