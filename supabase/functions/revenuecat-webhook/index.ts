// RevenueCat → Supabase: keeps public.entitlements in sync for every store
// (App Store, Google Play, Web Billing/Stripe).
//
// Secrets (supabase secrets set …):
//   REVENUECAT_WEBHOOK_AUTH   value configured as the webhook "Authorization header" in RevenueCat
//   REVENUECAT_SECRET_KEY     RevenueCat secret API key (v1), to read the authoritative subscriber state
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy with JWT verification off (RevenueCat is not a Supabase user):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const ENTITLEMENT = 'premium';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

interface RcEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  store?: string;
}

async function subscriberState(appUserId: string) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('REVENUECAT_SECRET_KEY')}` },
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  const body = await res.json();
  const ent = body?.subscriber?.entitlements?.[ENTITLEMENT];
  const expires: string | null = ent?.expires_date ?? null;
  const active = !!ent && (!expires || new Date(expires).getTime() > Date.now());
  const product: string | null = ent?.product_identifier ?? null;
  const store: string | null = product ? (body?.subscriber?.subscriptions?.[product]?.store ?? null) : null;
  return { active, expires, product, store };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== expected) return new Response('unauthorized', { status: 401 });

  const { event } = (await req.json()) as { event: RcEvent };
  if (!event) return new Response('no event', { status: 400 });

  // App user ids that are Supabase users (anonymous RevenueCat ids are skipped).
  const ids = new Set(
    [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].filter(
      (x): x is string => !!x && UUID.test(x),
    ),
  );

  for (const userId of ids) {
    const s = await subscriberState(userId);
    const { error } = await admin.from('entitlements').upsert({
      user_id: userId,
      premium: s.active,
      source: s.store,
      product_id: s.product,
      expires_at: s.expires,
      updated_at: new Date().toISOString(),
    });
    // A user id that no longer exists in auth.users fails the foreign key: ignore it.
    if (error && !String(error.message).includes('foreign key')) return new Response(error.message, { status: 500 });
  }
  return new Response('ok');
});
