import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type PushPayload = {
  householdId?: string;
  title?: string;
  body?: string;
  url?: string;
};

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_WEB_PUSH_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:notifications@moneymates.app";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json(200, { sent: 0, skipped: "Phone push is not configured." });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json(401, { error: "Missing authorization token." });
  }

  let payload: PushPayload;
  try {
    payload = JSON.parse(event.body || "{}") as PushPayload;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  if (!payload.householdId || !payload.title) {
    return json(400, { error: "householdId and title are required." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return json(401, { error: "Invalid authorization token." });
  }

  const { data: callerMembership, error: callerError } = await admin
    .from("household_members")
    .select("household_id")
    .eq("household_id", payload.householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (callerError) return json(500, { error: callerError.message });
  if (!callerMembership) return json(403, { error: "Not a member of this household." });

  const { data: targetMembers, error: membersError } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", payload.householdId)
    .neq("user_id", user.id);

  if (membersError) return json(500, { error: membersError.message });
  const targetUserIds = (targetMembers ?? []).map((member) => member.user_id);
  if (!targetUserIds.length) return json(200, { sent: 0 });

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .in("user_id", targetUserIds);

  if (subscriptionError) return json(500, { error: subscriptionError.message });
  if (!subscriptions?.length) return json(200, { sent: 0 });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body || "",
    url: payload.url || "/",
  });
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          pushBody,
        );
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }),
  );

  return json(200, { sent });
};
