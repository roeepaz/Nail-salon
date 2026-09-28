import { supabase } from "@/integrations/supabase/client";

export type PushPermissionState = "granted" | "denied" | "prompt" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermissionState(): PushPermissionState {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error("Failed to register service worker:", error);
    return null;
  }
}

export async function subscribeToPush(userId: string): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: "Web push is not supported in this browser." };
  }

  try {
    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        error:
          permission === "denied"
            ? "Notification permission was denied. Please enable notifications in your browser site settings."
            : "Notification permission was dismissed.",
      };
    }

    // 2. Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: "Failed to initialize service worker." };
    }

    // 3. Get VAPID public key
    const vapidPublicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
    if (!vapidPublicKey) {
      console.warn("VITE_VAPID_PUBLIC_KEY is not defined. Using dummy key for dev/fallback.");
    }

    // Subscribe to push manager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription && vapidPublicKey) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as ArrayBuffer,
      });
    }

    if (!subscription) {
      return {
        success: false,
        error: "Could not create push subscription. Please check your VAPID public key configuration.",
      };
    }

    // Extract p256dh and auth keys
    const rawP256dh = subscription.getKey("p256dh");
    const rawAuth = subscription.getKey("auth");
    if (!rawP256dh || !rawAuth) {
      return { success: false, error: "Push subscription keys are missing." };
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawP256dh))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

    // Store in Supabase push_subscriptions table
    const { error: dbError } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (dbError) {
      console.error("Failed to store push subscription in database:", dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true, subscription };
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error subscribing to push",
    };
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);
    }

    return true;
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    return false;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}
