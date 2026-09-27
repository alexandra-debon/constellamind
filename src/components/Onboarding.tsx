import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from './icons';

/** First-launch walkthrough: welcome, the four NÉSO steps, writing modes. */
export function Onboarding() {
  const { data, update, t } = useStore();
  const [i, setI] = useState(0);
  if (data.settings.onboarded) return null;

  const fr = data.settings.lang === 'fr';
  const steps = fr
    ? [
        ['N', 'Nébuleuse', 'Capturer sans trier, en mode apaisé.'],
        ['É', 'Étoile', 'Nommer l’idée-mère et lui donner une adresse.'],
        ['S', 'Satellite', 'Déployer les idées qui en naissent.'],
        ['O', 'Orbite', 'Passer à l’action, sans perdre l’origine.'],
      ]
    : [
        ['N', 'Nebula', 'Capture without sorting, in calm mode.'],
        ['S', 'Star', 'Name the parent idea and give it an address.'],
        ['S', 'Satellite', 'Unfold the ideas it gives birth to.'],
        ['O', 'Orbit', 'Take action without losing the origin.'],
      ];
  const done = () =>
    update((d) => {
      d.settings.onboarded = true;
    });

  const slides = [
    <div key="w" className="ob-slide">
      <div className="ob-logo">
        <Icon name="star" size={56} />
      </div>
      <h1>{t.onboarding.welcome}</h1>
      <p>{t.onboarding.welcomeText}</p>
    </div>,
    <div key="m" className="ob-slide">
      <h1>
        {fr ? 'La méthode' : 'The method'} {t.methodName}
      </h1>
      <ol className="ob-steps">
        {steps.map(([l, n, d]) => (
          <li key={n}>
            <span className="ob-letter">{l}</span>
            <div>
              <b>{n}</b>
              <span>{d}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>,
    <div key="p" className="ob-slide">
      <div className="ob-logo">
        <Icon name="pen" size={52} />
      </div>
      <h1>{t.onboarding.writeTitle}</h1>
      <p>{t.onboarding.writeText}</p>
      <div className="ob-lang">
        {(['fr', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={`chip ${data.settings.lang === l ? 'on' : ''}`}
            onClick={() =>
              update((d) => {
                d.settings.lang = l;
              })
            }
          >
            {l === 'fr' ? 'Français' : 'English'}
          </button>
        ))}
      </div>
    </div>,
  ];
  const last = i === slides.length - 1;

  return (
    <div className="onboarding" role="dialog" aria-modal="true">
      <div className="ob-card">
        {slides[i]}
        <div className="ob-dots">
          {slides.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="ob-actions">
          <button type="button" className="btn ghost" onClick={done}>
            {t.onboarding.skip}
          </button>
          <button type="button" className="btn primary" onClick={() => (last ? done() : setI(i + 1))}>
            {last ? t.onboarding.start : t.onboarding.next}
          </button>
        </div>
      </div>
    </div>
  );
}
