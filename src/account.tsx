import { Capacitor } from '@capacitor/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { config, ENTITLEMENT, hasBackend } from './config';
import { loadText, removeText, saveText } from './persist';

// Accounts (Supabase), premium status and purchases (RevenueCat).
//
// Premium is true when either source says so:
//  - the `entitlements` table, written by the RevenueCat webhook for every store
//    (App Store, Google Play, web/Stripe), so it works on every platform;
//  - on iOS/Android, RevenueCat's own customer info, which is instant after a
//    purchase, before the webhook has run.

const native = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform();

let client: SupabaseClient | null = null;
export async function supabase(): Promise<SupabaseClient | null> {
  if (!hasBackend()) return null;
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Keep the session in app files on iOS/Android (WebView storage can be purged).
      storage: {
        getItem: (k) => loadText(`auth-${k}`),
        setItem: (k, v) => saveText(`auth-${k}`, v),
        removeItem: (k) => removeText(`auth-${k}`),
      },
    },
  });
  return client;
}

async function purchases() {
  if (!native) return null;
  const key = platform === 'ios' ? config.revenuecatIos : config.revenuecatAndroid;
  if (!key) return null;
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  return { Purchases, key };
}

let rcConfigured = false;
async function rc(userId: string | null) {
  const p = await purchases();
  if (!p) return null;
  if (!rcConfigured) {
    await p.Purchases.configure({ apiKey: p.key, appUserID: userId ?? undefined });
    rcConfigured = true;
  }
  return p.Purchases;
}

export interface Plan {
  id: string;
  period: 'monthly' | 'annual';
  price: string;
  /** Native package object to hand back to RevenueCat when buying. */
  pkg?: unknown;
}

interface Account {
  available: boolean;
  user: { id: string; email: string } | null;
  premium: boolean;
  premiumUntil: string | null;
  ready: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  plans: () => Promise<Plan[]>;
  buy: (plan: Plan) => Promise<boolean>;
  restore: () => Promise<boolean>;
  /** Web: RevenueCat hosted checkout for the signed-in user. */
  webCheckoutUrl: () => string | null;
  manageUrl: () => string | null;
  canBuy: boolean;
}

const Ctx = createContext<Account | null>(null);

/** Development only: localStorage 'constellamind:dev-premium' = '1' unlocks Premium locally. */
const devPremium = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem('constellamind:dev-premium') === '1';
  } catch {
    return false;
  }
};

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!hasBackend());
  const [serverPremium, setServerPremium] = useState<{ on: boolean; until: string | null }>({ on: false, until: null });
  const [storePremium, setStorePremium] = useState(false);
  const userId = user?.id ?? null;
  const lastRcUser = useRef<string | null>(null);

  // Session
  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      const sb = await supabase();
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      setUser(data.session?.user ?? null);
      setReady(true);
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => unsub?.();
  }, []);

  const readServer = useCallback(async () => {
    const sb = await supabase();
    if (!sb || !userId) {
      setServerPremium({ on: false, until: null });
      return;
    }
    const { data } = await sb.from('entitlements').select('premium, expires_at').eq('user_id', userId).maybeSingle();
    const until = (data?.expires_at as string | null) ?? null;
    const on = !!data?.premium && (!until || new Date(until).getTime() > Date.now());
    setServerPremium({ on, until });
  }, [userId]);

  const readStore = useCallback(async () => {
    const P = await rc(userId);
    if (!P) return;
    // Link purchases to the account (and back to an anonymous id on sign-out).
    if (lastRcUser.current !== userId) {
      if (userId) await P.logIn({ appUserID: userId }).catch(() => {});
      else if (lastRcUser.current) await P.logOut().catch(() => {});
      lastRcUser.current = userId;
    }
    const { customerInfo } = await P.getCustomerInfo();
    setStorePremium(!!customerInfo.entitlements.active[ENTITLEMENT]);
  }, [userId]);

  const refresh = useCallback(async () => {
    await Promise.all([readServer(), readStore().catch(() => {})]);
  }, [readServer, readStore]);

  useEffect(() => {
    void refresh();
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const value = useMemo<Account>(
    () => ({
      available: hasBackend(),
      user: user ? { id: user.id, email: user.email ?? '' } : null,
      premium: serverPremium.on || storePremium || devPremium(),
      premiumUntil: serverPremium.until,
      ready,
      canBuy: native ? !!(platform === 'ios' ? config.revenuecatIos : config.revenuecatAndroid) : !!config.webPurchaseLink,
      sendCode: async (email) => {
        const sb = await supabase();
        if (!sb) throw new Error('offline');
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw error;
      },
      verifyCode: async (email, code) => {
        const sb = await supabase();
        if (!sb) throw new Error('offline');
        const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
        if (error) throw error;
      },
      signOut: async () => {
        const sb = await supabase();
        await sb?.auth.signOut();
      },
      deleteAccount: async () => {
        const sb = await supabase();
        if (!sb) return;
        const { error } = await sb.functions.invoke('delete-account', { method: 'POST' });
        if (error) throw error;
        await sb.auth.signOut();
      },
      refresh,
      plans: async () => {
        const P = await rc(userId);
        if (!P) return [];
        const offerings = await P.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        return pkgs
          .filter((p) => p.packageType === 'MONTHLY' || p.packageType === 'ANNUAL')
          .map((p) => ({
            id: p.identifier,
            period: p.packageType === 'ANNUAL' ? ('annual' as const) : ('monthly' as const),
            price: p.product.priceString,
            pkg: p,
          }));
      },
      buy: async (plan) => {
        const P = await rc(userId);
        if (!P || !plan.pkg) return false;
        try {
          const res = await P.purchasePackage({ aPackage: plan.pkg as never });
          const on = !!res.customerInfo.entitlements.active[ENTITLEMENT];
          setStorePremium(on);
          void readServer();
          return on;
        } catch (e) {
          if ((e as { userCancelled?: boolean }).userCancelled) return false;
          throw e;
        }
      },
      restore: async () => {
        const P = await rc(userId);
        if (!P) {
          await readServer();
          return false;
        }
        const { customerInfo } = await P.restorePurchases();
        const on = !!customerInfo.entitlements.active[ENTITLEMENT];
        setStorePremium(on);
        return on;
      },
      webCheckoutUrl: () => (config.webPurchaseLink && user ? `${config.webPurchaseLink.replace(/\/$/, '')}/${encodeURIComponent(user.id)}${user.email ? `?email=${encodeURIComponent(user.email)}` : ''}` : null),
      manageUrl: () =>
        platform === 'ios'
          ? 'https://apps.apple.com/account/subscriptions'
          : platform === 'android'
            ? 'https://play.google.com/store/account/subscriptions'
            : null,
    }),
    [user, serverPremium, storePremium, ready, refresh, readServer, userId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): Account {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAccount outside AccountProvider');
  return a;
}

export type PremiumFeature = 'constellations' | 'sync' | 'export' | 'highlight';

/** Premium gate: returns true if allowed, otherwise opens the subscription page. */
export function usePremium() {
  const { premium } = useAccount();
  return {
    premium,
    require: (feature: PremiumFeature) => {
      if (premium) return true;
      window.location.hash = `#/premium/${feature}`;
      return false;
    },
  };
}
