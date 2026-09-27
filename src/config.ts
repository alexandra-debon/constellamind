// Service keys, read at build time from environment variables (see .env.example).
// Without them the app still works fully in free, local-only mode.

const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  /** RevenueCat public SDK keys (App Store / Google Play). */
  revenuecatIos: (env.VITE_REVENUECAT_IOS_KEY as string | undefined) ?? '',
  revenuecatAndroid: (env.VITE_REVENUECAT_ANDROID_KEY as string | undefined) ?? '',
  /** RevenueCat Web Purchase Link (Stripe-backed web billing), e.g. https://pay.rev.cat/abc123 */
  webPurchaseLink: (env.VITE_WEB_PURCHASE_LINK as string | undefined) ?? '',
  /** Public site where legal pages live. */
  siteUrl: (env.VITE_SITE_URL as string | undefined) ?? 'https://alexandra-debon.github.io/constellamind',
};

export const ENTITLEMENT = 'premium';

export const hasBackend = () => !!(config.supabaseUrl && config.supabaseAnonKey);
