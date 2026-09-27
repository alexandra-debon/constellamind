import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { useAccount, usePremium, type Plan, type PremiumFeature } from '../account';
import { Breadcrumb, Section, TopNav } from '../components/common';
import { askConfirm, notify } from '../components/confirm';
import { Icon } from '../components/icons';
import { config } from '../config';
import { exportBackup, exportImage, exportPdf } from '../exporter';
import { tick } from '../native';
import { go, useStore } from '../store';
import { syncNow, useSyncStatus } from '../sync';

const AFTER_LOGIN = 'constellamind:after-login';

const legalLinks = (t: ReturnType<typeof useStore>['t']) => (
  <p className="legal-links">
    <a href={`${config.siteUrl}/terms.html`} target="_blank" rel="noreferrer">
      {t.premium.terms}
    </a>
    {' · '}
    <a href={`${config.siteUrl}/privacy.html`} target="_blank" rel="noreferrer">
      {t.premium.privacy}
    </a>
  </p>
);

/* ───────────── PREMIUM (paywall) ───────────── */

export function PremiumPage({ reason }: { reason?: PremiumFeature }) {
  const { t } = useStore();
  const acc = useAccount();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [choice, setChoice] = useState<'monthly' | 'annual'>('annual');
  const [busy, setBusy] = useState(false);
  const [waitingWeb, setWaitingWeb] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    void acc.plans().then(setPlans).catch(() => setPlans([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acc.user?.id]);

  // Store prices come from Apple/Google (localised); on the web they are fixed.
  const price = (period: 'monthly' | 'annual') =>
    plans.find((p) => p.period === period)?.price ?? (period === 'monthly' ? '4,99 €' : '39,99 €');

  const subscribe = async () => {
    if (isNative) {
      const plan = plans.find((p) => p.period === choice);
      if (!plan) return;
      setBusy(true);
      try {
        if (await acc.buy(plan)) {
          void tick();
          await notify(t.premium.thanks);
        }
      } catch {
        await notify(t.premium.error);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!acc.user) {
      try {
        sessionStorage.setItem(AFTER_LOGIN, window.location.hash);
      } catch {
        // storage blocked: the user simply comes back by hand
      }
      go('#/compte');
      return;
    }
    const url = acc.webCheckoutUrl();
    if (url) {
      window.open(url, '_blank', 'noopener');
      setWaitingWeb(true);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const on = await acc.restore();
      await acc.refresh();
      await notify(on ? t.premium.restored : t.premium.nothingToRestore);
    } catch {
      await notify(t.premium.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page premium-page">
      <TopNav active="" />
      <Breadcrumb crumbs={[{ label: 'Premium', current: true }]} />

      <header className="premium-hero">
        <div className="premium-badge">
          <Icon name="star" size={34} />
        </div>
        <h1>{t.premium.title}</h1>
        <p>{reason ? t.premium.reasons[reason] : t.premium.tagline}</p>
      </header>

      <ul className="premium-features">
        {t.premium.features.map(([h, d]) => (
          <li key={h}>
            <span className="check-dot">✓</span>
            <div>
              <b>{h}</b>
              <span>{d}</span>
            </div>
          </li>
        ))}
      </ul>

      {acc.premium ? (
        <div className="card premium-status">
          <p>
            <b>{t.premium.active}</b>
          </p>
          {acc.premiumUntil && (
            <p className="fine">
              {t.premium.until} {new Date(acc.premiumUntil).toLocaleDateString()}
            </p>
          )}
          {acc.manageUrl() && (
            <a className="btn ghost" href={acc.manageUrl()!} target="_blank" rel="noreferrer">
              {t.premium.manage}
            </a>
          )}
        </div>
      ) : !acc.canBuy || !acc.available ? (
        <p className="empty">{t.premium.unavailable}</p>
      ) : (
        <>
          <div className="plans" role="radiogroup">
            {(['annual', 'monthly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={choice === p}
                className={`plan ${choice === p ? 'on' : ''}`}
                onClick={() => setChoice(p)}
              >
                {p === 'annual' && <span className="plan-save">{t.premium.save}</span>}
                <span className="plan-name">{p === 'annual' ? t.premium.annual : t.premium.monthly}</span>
                <span className="plan-price">
                  {price(p)} <small>{p === 'annual' ? t.premium.perYear : t.premium.perMonth}</small>
                </span>
              </button>
            ))}
          </div>

          {!isNative && !acc.user && <p className="fine center">{t.premium.signInFirst}</p>}

          <button type="button" className="btn primary wide" disabled={busy || (isNative && !plans.length)} onClick={subscribe}>
            {!isNative && !acc.user ? t.premium.createAccount : t.premium.subscribe}
          </button>

          {waitingWeb && (
            <div className="card premium-status">
              <p className="fine">{t.premium.webReturn}</p>
              <button type="button" className="btn ghost" onClick={() => void acc.refresh()}>
                {t.premium.check}
              </button>
            </div>
          )}

          <button type="button" className="btn ghost wide" disabled={busy} onClick={restore}>
            {t.premium.restore}
          </button>
          <p className="fine legal">{t.premium.legal}</p>
        </>
      )}
      {legalLinks(t)}
    </div>
  );
}

/* ───────────── COMPTE ───────────── */

export function AccountPage() {
  const { t } = useStore();
  const acc = useAccount();
  const sync = useSyncStatus();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(false);
    try {
      await acc.sendCode(email.trim());
      setStep('code');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    setError(false);
    try {
      await acc.verifyCode(email.trim(), code);
      setCode('');
      setStep('email');
      let back: string | null = null;
      try {
        back = sessionStorage.getItem(AFTER_LOGIN);
        sessionStorage.removeItem(AFTER_LOGIN);
      } catch {
        // ignore
      }
      if (back) go(back);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await askConfirm(t.account.deleteConfirm, t.account.delete, t.cancel))) return;
    try {
      await acc.deleteAccount();
      await notify(t.account.deleted);
    } catch {
      await notify(t.account.error);
    }
  };

  return (
    <div className="page">
      <TopNav active="" />
      <Breadcrumb crumbs={[{ label: t.account.title, current: true }]} />

      {!acc.available ? (
        <p className="empty">{t.account.unavailable}</p>
      ) : !acc.user ? (
        <div className="card auth-card">
          <p className="intro">{t.account.intro}</p>
          {step === 'email' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="field">
                <span>{t.account.email}</span>
                <input id="acc-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button type="submit" className="btn primary wide" disabled={busy || !email.includes('@')}>
                {t.account.sendCode}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <p className="fine">
                {t.account.codeSent} <b>{email}</b>
              </p>
              <label className="field">
                <span>{t.account.code}</span>
                <input
                  id="acc-code"
                  className="code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button type="submit" className="btn primary wide" disabled={busy || code.length < 6}>
                {t.account.verify}
              </button>
              <button type="button" className="btn ghost wide" onClick={() => setStep('email')}>
                {t.account.otherEmail}
              </button>
            </form>
          )}
          {error && <p className="form-error">{t.account.error}</p>}
        </div>
      ) : (
        <>
          <div className="card rows">
            <div className="row">
              <span className="label">{t.account.signedInAs}</span>
              <b>{acc.user.email}</b>
            </div>
            <div className="row">
              <span className="label">{t.account.plan}</span>
              <b>{acc.premium ? t.account.premium : t.account.free}</b>
              <a className="chip small" href="#/premium">
                {acc.premium ? t.premium.manage : t.account.seePremium}
              </a>
            </div>
            <div className="row">
              <span className="label">{t.account.sync}</span>
              <span>
                {!acc.premium
                  ? t.account.syncOff
                  : sync.state === 'syncing'
                    ? t.account.syncing
                    : sync.state === 'error'
                      ? t.account.syncError
                      : sync.at
                        ? `${t.account.syncOn} · ${t.account.lastSync} ${new Date(sync.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : t.account.syncOn}
              </span>
              {acc.premium && (
                <button type="button" className="chip small" onClick={syncNow}>
                  {t.account.syncNow}
                </button>
              )}
            </div>
          </div>
          <div className="link-row">
            <button type="button" className="chip" onClick={() => void acc.signOut()}>
              {t.account.signOut}
            </button>
            <button type="button" className="chip danger" onClick={remove}>
              {t.account.delete}
            </button>
          </div>
        </>
      )}
      {legalLinks(t)}
    </div>
  );
}

/* ───────────── MES CONSTELLATIONS ───────────── */

export function ConstellationsPage() {
  const store = useStore();
  const { t, library, currentDoc, data, ink } = store;
  const { premium, require } = usePremium();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const create = async () => {
    if (library.docs.length >= 1 && !require('constellations')) return;
    const id = await store.createDoc(t.docs.defaultName);
    await store.openDoc(id);
    setEditing(id);
  };

  const remove = async (id: string) => {
    if (!(await askConfirm(t.docs.removeConfirm, t.docs.remove, t.cancel))) return;
    await store.deleteDoc(id);
  };

  const run = async (kind: 'pdf' | 'image' | 'backup') => {
    if (kind !== 'backup' && !require('export')) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') await exportPdf(data, ink, t, currentDoc.name);
      else if (kind === 'image') await exportImage(data, t, currentDoc.name);
      else await exportBackup({ app: 'constellamind', data, ink }, currentDoc.name);
    } catch {
      await notify(t.premium.error);
    } finally {
      setBusy(null);
    }
  };

  const docs = [...library.docs].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="page">
      <TopNav active="" />
      <Breadcrumb crumbs={[{ label: t.docs.title, current: true }]} />

      <ul className="doc-list">
        {docs.map((d) => (
          <li key={d.id} className={`card doc ${d.id === currentDoc.id ? 'current' : ''}`}>
            <div className="doc-main">
              {editing === d.id ? (
                <input
                  id={`doc-name-${d.id}`}
                  className="title-input"
                  autoFocus
                  defaultValue={d.name}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    store.renameDoc(d.id, e.target.value.trim() || t.docs.defaultName);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button type="button" className="doc-name" onClick={() => void store.openDoc(d.id).then(() => go('#/'))}>
                  {d.name}
                </button>
              )}
              <span className="fine">
                {d.id === currentDoc.id ? `${t.docs.current} · ` : ''}
                {t.docs.edited} {new Date(d.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="doc-actions">
              <button type="button" className="chip small" onClick={() => setEditing(d.id)}>
                {t.docs.rename}
              </button>
              {library.docs.length > 1 && (
                <button type="button" className="chip small danger" onClick={() => void remove(d.id)}>
                  {t.docs.remove}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="chip add" onClick={() => void create()}>
        <Icon name="plus" size={18} /> {t.docs.create}
        {!premium && <span className="pro">PRO</span>}
      </button>

      <Section title={`${t.exporting.title} · ${currentDoc.name}`}>
        <div className="export-grid">
          <button type="button" className="card export" disabled={!!busy} onClick={() => void run('pdf')}>
            <Icon name="notes" size={26} />
            <b>
              {t.exporting.pdf} {!premium && <span className="pro">PRO</span>}
            </b>
            <span>{busy === 'pdf' ? t.exporting.working : t.exporting.pdfHint}</span>
          </button>
          <button type="button" className="card export" disabled={!!busy} onClick={() => void run('image')}>
            <Icon name="star" size={26} />
            <b>
              {t.exporting.image} {!premium && <span className="pro">PRO</span>}
            </b>
            <span>{busy === 'image' ? t.exporting.working : t.exporting.imageHint}</span>
          </button>
          <button type="button" className="card export" disabled={!!busy} onClick={() => void run('backup')}>
            <Icon name="share" size={26} />
            <b>{t.exporting.backup}</b>
            <span>{t.exporting.backupHint}</span>
          </button>
        </div>
      </Section>
    </div>
  );
}
