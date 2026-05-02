import { supabase } from "./supabase";

type PhonePushResult = {
  enabled: boolean;
  message: string;
};

type HouseholdPushInput = {
  householdId: string;
  title: string;
  body?: string;
  url?: string;
};

const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;

function supportMessage() {
  if (typeof window === "undefined") return "Phone notifications are not available in this environment.";
  if (!("Notification" in window)) return "This browser does not support phone notifications.";
  if (!("serviceWorker" in navigator)) return "This browser does not support service workers for phone notifications.";
  if (!("PushManager" in window)) return "This browser does not support web push notifications.";
  if (!vapidPublicKey) return "Phone push is not configured for this installation. In-app notifications still work.";
  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/service-worker.js");
}

export function getPhonePushSupportMessage() {
  return supportMessage();
}

export async function hasPhonePushSubscription() {
  if (supportMessage()) return false;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return Boolean(subscription);
}

export async function enablePhonePush(userId: string): Promise<PhonePushResult> {
  const unsupported = supportMessage();
  if (unsupported) return { enabled: false, message: unsupported };
  const publicKey = vapidPublicKey ?? "";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { enabled: false, message: "Phone notifications were not enabled. You can keep using in-app notifications." };
  }

  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const payload = subscription.toJSON();
  const p256dh = payload.keys?.p256dh;
  const auth = payload.keys?.auth;

  if (!subscription.endpoint || !p256dh || !auth) {
    return { enabled: false, message: "This browser did not return a complete push subscription." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );

  if (error) throw error;
  return { enabled: true, message: "Phone push notifications are enabled on this device." };
}

export async function disablePhonePush(userId: string): Promise<PhonePushResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { enabled: false, message: "Phone notifications are not active on this device." };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription?.endpoint) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    if (error) throw error;
  }

  return { enabled: false, message: "Phone push notifications are disabled on this device." };
}

export async function sendHouseholdPhonePush(input: HouseholdPushInput) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  try {
    await fetch("/.netlify/functions/send-push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    console.warn("Phone push notification could not be sent", error);
  }
}
