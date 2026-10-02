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

import { supabase } from '@nail-salon/api';
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
      toast.success("הגדרות ההתראות עודכנו בהצלחה");
      void queryClient.invalidateQueries({ queryKey: ["notification_preferences", user?.id] });
    },
    onError: (err) => {
      toast.error("שגיאה בעדכון ההגדרות: " + (err instanceof Error ? err.message : "שגיאה לא ידועה"));
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
      toast.success("התראות דפדפן הופעלו בהצלחה!");
      updateMutation.mutate({ web_push_enabled: true });
    } else {
      toast.error(res.error || "לא ניתן היה להפעיל התראות דפדפן");
    }
  };

  const handleDisablePush = async () => {
    if (!user) return;
    setIsSubscribingPush(true);
    await unsubscribeFromPush(user.id);
    setIsSubscribingPush(false);
    updateMutation.mutate({ web_push_enabled: false });
    toast.success("התראות דפדפן בוטלו עבור מכשיר זה");
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!isValidE164(normalized)) {
      toast.error("נא להזין מספר טלפון תקין (לדוגמה 050-123-4567 או 972501234567+)");
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
      toast.success(`מספר ה-WhatsApp עודכן ל-${normalized}`);
    } catch (err) {
      toast.error("שגיאה בעדכון מספר הטלפון: " + (err instanceof Error ? err.message : ""));
    } finally {
      setIsSavingPhone(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin ml-2" />
        <span>טוען הגדרות התראות…</span>
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
    <div className="space-y-8" dir="rtl">
      {/* Section 1: Notification Channels */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <h3 className="text-lg font-display font-medium text-foreground mb-1">
          ערוצי התראה
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          בחרי היכן וכיצד תרצי לקבל תזכורות ועדכונים על התורים שלך.
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
                      התראות דפדפן (Web Push)
                    </Label>
                    {pushState === "granted" && (
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[11px] gap-1 py-0">
                        <CheckCircle2 className="size-3" /> פעיל
                      </Badge>
                    )}
                    {pushState === "denied" && (
                      <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20 text-[11px] gap-1 py-0">
                        <XCircle className="size-3" /> חסום
                      </Badge>
                    )}
                    {pushState === "prompt" && (
                      <Badge variant="outline" className="text-muted-foreground text-[11px] py-0">
                        טרם הופעל
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    קבלת התראות קופצות ישירות לדפדפן במכשיר זה.
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
                      <Loader2 className="size-3 animate-spin ml-1" />
                    ) : null}
                    הפעלת התראות דפדפן
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
                  <strong>התראות הדפדפן חסומות.</strong> כדי להפעילן: לחצי על סמל המנעול בסרגל הכתובות של הדפדפן, פתחי את <em>הגדרות האתר</em>, ושני את הרשאת <em>ההתראות (Notifications)</em> ל-<strong>אפשר (Allow)</strong>.
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
                  התראות באימייל
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  נשלח לכתובת <span className="font-mono text-foreground">{profile?.email || user?.email}</span>
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
                    הודעות WhatsApp
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    הודעות תזכורת ואישור ישירות ל-WhatsApp שלך
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
                <span>טלפון ל-WhatsApp:</span>
              </div>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="050-1234567"
                dir="ltr"
                className="h-8 text-xs font-mono bg-background text-left"
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs px-3 shrink-0 rounded-lg gap-1.5"
                disabled={isSavingPhone || !phoneNumber.trim()}
                onClick={handleSavePhone}
              >
                {isSavingPhone ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                עדכון טלפון
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Notification Event Triggers */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <h3 className="text-lg font-display font-medium text-foreground mb-1">
          סוגי התראות
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          בחרי אילו תזכורות ועדכונים תרצי לקבל.
        </p>

        <div className="space-y-5 divide-y divide-border/50">
          <div className="pt-3 first:pt-0 flex items-center justify-between">
            <div>
              <Label htmlFor="pref_confirmation" className="font-medium text-sm cursor-pointer">
                אישור תור
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                נשלח באופן מיידי בעת קביעת התור
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
                תזכורת 24 שעות מראש
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                נשלחת יום לפני מועד התור המתוכנן
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
                תזכורת שעה לפני
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                נשלחת שעה אחת לפני מועד תחילת הטיפול
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
                הודעת ביטול תור
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                נשלחת במידה והתור בוטל
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
