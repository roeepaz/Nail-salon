// Supabase Edge Function: send-notification
// Dispatches appointment notifications across Web Push, Email, and WhatsApp with idempotency tracking.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase backend credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify Authorization: caller must have valid user JWT or service key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let callingUserId: string | null = null;

    if (token !== supabaseServiceKey) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callingUserId = userData.user.id;
    }

    const { appointmentId, type, channels } = await req.json();

    if (!appointmentId || !type) {
      return new Response(JSON.stringify({ error: "Missing appointmentId or type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch appointment
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .maybeSingle();

    if (aptError || !appointment) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If caller is regular user, ensure they own the appointment
    if (callingUserId && appointment.user_id && appointment.user_id !== callingUserId) {
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callingUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: Not your appointment" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const targetUserId = appointment.user_id;

    // Fetch user profile
    let customerEmail: string | null = null;
    let customerPhone: string = appointment.client_phone;
    let customerName: string = appointment.client_name;

    if (targetUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profile) {
        customerEmail = profile.email || null;
        customerPhone = profile.phone || appointment.client_phone;
        customerName = profile.full_name || appointment.client_name;
      }
    }

    // Check business notification settings
    const { data: businessSettings } = await supabase
      .from("business_notification_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (businessSettings) {
      if (type === "appointment_confirmation" && !businessSettings.appointment_confirmation) {
        return new Response(JSON.stringify({ skipped: true, reason: "Studio disabled confirmation notifications" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (type === "appointment_cancellation" && !businessSettings.appointment_cancellation) {
        return new Response(JSON.stringify({ skipped: true, reason: "Studio disabled cancellation notifications" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (type === "appointment_reminder_24h" && !businessSettings.appointment_reminder_24h) {
        return new Response(JSON.stringify({ skipped: true, reason: "Studio disabled 24h reminders" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (type === "appointment_reminder_1h" && !businessSettings.appointment_reminder_1h) {
        return new Response(JSON.stringify({ skipped: true, reason: "Studio disabled 1h reminders" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check user preferences
    let prefs = {
      web_push_enabled: true,
      email_enabled: true,
      whatsapp_enabled: true,
      appointment_confirmation: true,
      appointment_cancellation: true,
      appointment_reminder_24h: true,
      appointment_reminder_1h: true,
    };

    if (targetUserId) {
      const { data: userPrefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (userPrefs) {
        prefs = userPrefs;
      }
    }

    if (type === "appointment_confirmation" && !prefs.appointment_confirmation) {
      return new Response(JSON.stringify({ skipped: true, reason: "User disabled confirmation notifications" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (type === "appointment_cancellation" && !prefs.appointment_cancellation) {
      return new Response(JSON.stringify({ skipped: true, reason: "User disabled cancellation notifications" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (type === "appointment_reminder_24h" && !prefs.appointment_reminder_24h) {
      return new Response(JSON.stringify({ skipped: true, reason: "User disabled 24h reminders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (type === "appointment_reminder_1h" && !prefs.appointment_reminder_1h) {
      return new Response(JSON.stringify({ skipped: true, reason: "User disabled 1h reminders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidateChannels = channels || ["push", "email", "whatsapp"];
    const results: Array<{ channel: string; status: string; error?: string; messageId?: string }> = [];

    // Process channels
    for (const channel of candidateChannels) {
      try {
        // Idempotency check: see if log already exists
        const { data: existingLog } = await supabase
          .from("notification_logs")
          .select("id, status")
          .eq("appointment_id", appointmentId)
          .eq("type", type)
          .eq("channel", channel)
          .maybeSingle();

        if (existingLog && existingLog.status === "sent") {
          results.push({ channel, status: "skipped", error: "Already sent (idempotent)" });
          continue;
        }

        if (channel === "email") {
          if (!prefs.email_enabled || !customerEmail) {
            results.push({ channel: "email", status: "skipped", error: !prefs.email_enabled ? "Disabled by user" : "No email address" });
            continue;
          }

          const resendApiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("SMTP_PASS");
          let fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || Deno.env.get("SMTP_FROM") || "Lumière Nails <onboarding@resend.dev>";

          if (!resendApiKey) {
            results.push({ channel: "email", status: "skipped", error: "Neither RESEND_API_KEY nor SMTP_PASS is configured" });
            continue;
          }

          let subject = "Appointment confirmed";
          let headline = "Your appointment is confirmed!";
          if (type === "appointment_reminder_24h") {
            subject = "Reminder: Your appointment is tomorrow";
            headline = "Reminder: Your appointment is tomorrow";
          } else if (type === "appointment_reminder_1h") {
            subject = "Reminder: Your appointment is in 1 hour";
            headline = "Reminder: Your appointment is in 1 hour";
          } else if (type === "appointment_cancellation") {
            subject = "Appointment cancelled";
            headline = "Your appointment has been cancelled";
          }

          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #f0e6e8; border-radius: 12px;">
              <h2 style="color: #2b2325;">${headline}</h2>
              <p>Hi ${customerName},</p>
              <div style="background: #fff8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Service:</strong> ${appointment.service_type}</p>
                <p><strong>Date:</strong> ${appointment.appointment_date}</p>
                <p><strong>Time:</strong> ${appointment.appointment_time.slice(0, 5)}</p>
                <p><strong>Booking Ref:</strong> ${appointment.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <p style="font-size: 13px; color: #7d6b6e;">Lumière Nails Studio • 120 Dizengoff St, Tel Aviv</p>
            </div>
          `;

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [customerEmail],
              subject,
              html,
            }),
          });

          const emailJson = await emailRes.json();
          const emailStatus = emailRes.ok ? "sent" : "failed";

          await supabase.from("notification_logs").upsert(
            {
              user_id: targetUserId,
              appointment_id: appointmentId,
              type,
              channel: "email",
              status: emailStatus,
              provider_message_id: emailJson.id || null,
              error_message: emailRes.ok ? null : (emailJson.message || "Failed sending email"),
              sent_at: emailRes.ok ? new Date().toISOString() : null,
            },
            { onConflict: "appointment_id,type,channel" },
          );

          results.push({
            channel: "email",
            status: emailStatus,
            messageId: emailJson.id,
            error: emailRes.ok ? undefined : emailJson.message,
          });
        } else if (channel === "whatsapp") {
          if (!prefs.whatsapp_enabled || !customerPhone) {
            results.push({ channel: "whatsapp", status: "skipped", error: !prefs.whatsapp_enabled ? "Disabled by user" : "No phone" });
            continue;
          }

          const waToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
          const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
          const waApiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v21.0";

          if (!waToken || !waPhoneId) {
            results.push({ channel: "whatsapp", status: "skipped", error: "WhatsApp credentials not configured" });
            continue;
          }

          // Normalize phone to E.164 without '+'
          const cleanPhone = customerPhone.replace(/[^\d]/g, "");
          const formattedPhone = cleanPhone.startsWith("0") ? "972" + cleanPhone.slice(1) : cleanPhone;

          let templateName = "appointment_confirmation";
          if (type === "appointment_reminder_24h") {
            templateName = Deno.env.get("WHATSAPP_TEMPLATE_REMINDER_24H") || "appointment_reminder_24h";
          } else if (type === "appointment_reminder_1h") {
            templateName = Deno.env.get("WHATSAPP_TEMPLATE_REMINDER_1H") || "appointment_reminder_1h";
          } else if (type === "appointment_cancellation") {
            templateName = Deno.env.get("WHATSAPP_TEMPLATE_CANCELLATION") || "appointment_cancellation";
          } else {
            templateName = Deno.env.get("WHATSAPP_TEMPLATE_CONFIRMATION") || "appointment_confirmation";
          }

          const waRes = await fetch(
            `https://graph.facebook.com/${waApiVersion}/${waPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${waToken}`,
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedPhone,
                type: "template",
                template: {
                  name: templateName,
                  language: { code: "en_US" },
                  components: [
                    {
                      type: "body",
                      parameters: [
                        { type: "text", text: customerName },
                        { type: "text", text: appointment.service_type },
                        { type: "text", text: appointment.appointment_date },
                        { type: "text", text: appointment.appointment_time.slice(0, 5) },
                      ],
                    },
                  ],
                },
              }),
            },
          );

          const waJson = await waRes.json();
          const waStatus = waRes.ok && !waJson.error ? "sent" : "failed";
          const waMsgId = waJson.messages?.[0]?.id || null;
          const waError = waJson.error?.message || (waRes.ok ? null : "WhatsApp send error");

          await supabase.from("notification_logs").upsert(
            {
              user_id: targetUserId,
              appointment_id: appointmentId,
              type,
              channel: "whatsapp",
              status: waStatus,
              provider_message_id: waMsgId,
              error_message: waError,
              sent_at: waStatus === "sent" ? new Date().toISOString() : null,
            },
            { onConflict: "appointment_id,type,channel" },
          );

          results.push({ channel: "whatsapp", status: waStatus, messageId: waMsgId, error: waError });
        } else if (channel === "push") {
          if (!prefs.web_push_enabled || !targetUserId) {
            results.push({ channel: "push", status: "skipped", error: !prefs.web_push_enabled ? "Disabled by user" : "Anonymous user" });
            continue;
          }

          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", targetUserId);

          if (!subs || subs.length === 0) {
            results.push({ channel: "push", status: "skipped", error: "No push subscriptions found" });
            continue;
          }

          let sentCount = 0;
          const payload = JSON.stringify({
            title: type === "appointment_cancellation" ? "Appointment Cancelled" : "Lumière Nails",
            body: `${customerName}, your appointment for ${appointment.service_type} is ${type === "appointment_cancellation" ? "cancelled" : "scheduled for " + appointment.appointment_time.slice(0, 5)}.`,
            url: "/my-bookings",
            appointmentId,
            type,
          });

          for (const sub of subs) {
            try {
              const pushRes = await fetch(sub.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", TTL: "86400" },
                body: payload,
              });

              if (pushRes.status === 404 || pushRes.status === 410) {
                // Subscription expired: remove
                await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              } else if (pushRes.ok || pushRes.status === 201) {
                sentCount++;
              }
            } catch {
              // ignore transient single endpoint errors
            }
          }

          const pushStatus = sentCount > 0 ? "sent" : "failed";
          await supabase.from("notification_logs").upsert(
            {
              user_id: targetUserId,
              appointment_id: appointmentId,
              type,
              channel: "push",
              status: pushStatus,
              sent_at: pushStatus === "sent" ? new Date().toISOString() : null,
            },
            { onConflict: "appointment_id,type,channel" },
          );

          results.push({ channel: "push", status: pushStatus });
        }
      } catch (channelError) {
        const errorMsg = channelError instanceof Error ? channelError.message : String(channelError);
        results.push({ channel, status: "failed", error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
