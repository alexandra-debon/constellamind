import { useRef, useState } from 'react';
import { AddressInput, Breadcrumb, hrefOf, Lined, Section, TopNav } from '../components/common';
import { isStar, isValidAddress, NATURES, pairKey, STARS, uid, type Nature } from '../model';
import { normalize, useStore } from '../store';

const today = () => new Date().toISOString().slice(0, 10);

/* ───────────── NÉBULEUSE ───────────── */

export function Nebula() {
  const { data, update, t, fmt } = useStore();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'placed'>('all');
  const [copied, setCopied] = useState<string | null>(null);

  const capture = () => {
    const v = text.trim();
    if (!v) return;
    update((d) => {
      d.nebula.unshift({ id: uid(), text: v, address: '', createdAt: new Date().toISOString() });
    });
    setText('');
  };

  const copyToIdea = (id: string) => {
    update((d) => {
      const shard = d.nebula.find((x) => x.id === id);
      if (!shard || !isValidAddress(shard.address)) return;
      const a = shard.address;
      if (isStar(a)) {
        const s = d.stars[a];
        if (!s.title) s.title = shard.text.split('\n')[0].slice(0, 80);
        s.intuition = s.intuition ? `${s.intuition}\n${shard.text}` : shard.text;
      } else {
        const s = d.sats[a];
        if (!s.title) s.title = shard.text.split('\n')[0].slice(0, 80);
        s.development = s.development ? `${s.development}\n${shard.text}` : shard.text;
      }
      if (!d.stars[a.split('.')[0]].status) d.stars[a.split('.')[0]].status = 'germ';
    });
    setCopied(id);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const shards = data.nebula.filter((s) =>
    filter === 'all' ? true : filter === 'open' ? !isValidAddress(s.address) : isValidAddress(s.address),
  );

  return (
    <div className="page">
      <TopNav active="nebuleuse" />
      <Breadcrumb crumbs={[{ label: t.nav.nebula, current: true }]} />
      <p className="intro calm">{t.nebulaIntro}</p>

      <div className="capture">
        <textarea
          value={text}
          rows={3}
          placeholder={t.nebulaPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              capture();
            }
          }}
        />
        <button type="button" className="chip strong" onClick={capture} disabled={!text.trim()}>
          {t.capture}
        </button>
      </div>

      <div className="toolbar">
        {(['all', 'open', 'placed'] as const).map((f) => (
          <button key={f} type="button" className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? '✦' : f === 'open' ? t.unassigned : t.assigned}
          </button>
        ))}
      </div>

      {data.nebula.length === 0 && <p className="empty">{t.emptyNebula}</p>}
      <ul className="shards">
        {shards.map((s) => {
          const placed = isValidAddress(s.address);
          return (
            <li key={s.id} className={`shard ${placed ? 'placed' : ''}`} data-star={placed ? s.address.split('.')[0] : undefined}>
              <Lined
                value={s.text}
                rows={1}
                onChange={(v) =>
                  update((d) => {
                    d.nebula.find((x) => x.id === s.id)!.text = v;
                  })
                }
              />
              <div className="shard-margin">
                <span className="arrow-to">→</span>
                <AddressInput
                  value={s.address}
                  placeholder={t.addressHint.replace(/^\D*/, '').trim()}
                  onChange={(v) =>
                    update((d) => {
                      d.nebula.find((x) => x.id === s.id)!.address = v;
                    })
                  }
                />
                {placed && (
                  <button type="button" className="chip small" onClick={() => copyToIdea(s.id)}>
                    {copied === s.id ? t.sentToIdea : `${t.sendToIdea} ${fmt(s.address)}`}
                  </button>
                )}
                <button
                  type="button"
                  className="x"
                  aria-label={t.remove}
                  title={t.remove}
                  onClick={() =>
                    update((d) => {
                      d.nebula = d.nebula.filter((x) => x.id !== s.id);
                    })
                  }
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────── REGISTRE DES PASSERELLES ───────────── */

export function Register() {
  const { data, update, t, fmt } = useStore();
  const registered = new Set(data.bridges.map((b) => pairKey(b.from, b.to)));
  const unregistered = data.links.filter(([a, b]) => !registered.has(pairKey(a, b)));

  const add = (from = '', to = '') =>
    update((d) => {
      d.bridges.push({ id: uid(), from, to, nature: '', why: '', date: today() });
    });
  const set = (id: string, patch: Partial<(typeof data.bridges)[number]>) =>
    update((d) => {
      Object.assign(d.bridges.find((b) => b.id === id)!, patch);
    });

  return (
    <div className="page">
      <TopNav active="passerelles" />
      <Breadcrumb crumbs={[{ label: t.bottom.register, current: true }]} />
      <p className="intro">
        {t.registerIntro}{' '}
        {NATURES.map((n) => (
          <span key={n} className="nature-legend">
            <b>{t.natures[n][0]}</b> {t.natures[n][1]}
          </span>
        ))}
      </p>

      <div className="table-wrap">
        <table className="grid bridges-table">
          <thead>
            <tr>
              <th className="c-addr">{t.cols.from}</th>
              <th className="c-arrow" />
              <th className="c-addr">{t.cols.to}</th>
              <th className="c-nature">{t.cols.nature}</th>
              <th>{t.cols.why}</th>
              <th className="c-date">{t.cols.date}</th>
              <th className="c-x" />
            </tr>
          </thead>
          <tbody>
            {data.bridges.map((b) => (
              <tr key={b.id}>
                <td className="c-addr">
                  <AddressInput value={b.from} onChange={(from) => set(b.id, { from })} />
                </td>
                <td className="c-arrow">→</td>
                <td className="c-addr">
                  <AddressInput value={b.to} onChange={(to) => set(b.id, { to })} />
                </td>
                <td className="c-nature">
                  <select
                    className="cell"
                    value={b.nature}
                    onChange={(e) => set(b.id, { nature: e.target.value as Nature | '' })}
                  >
                    <option value="" />
                    {NATURES.map((n) => (
                      <option key={n} value={n}>
                        {t.natures[n][0]} · {t.natures[n][1]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="cell" value={b.why} onChange={(e) => set(b.id, { why: e.target.value })} />
                </td>
                <td className="c-date">
                  <input className="cell" type="date" value={b.date} onChange={(e) => set(b.id, { date: e.target.value })} />
                </td>
                <td className="c-x">
                  <button
                    type="button"
                    className="x"
                    aria-label={t.remove}
                    onClick={() =>
                      update((d) => {
                        d.bridges = d.bridges.filter((x) => x.id !== b.id);
                      })
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="chip add" onClick={() => add()}>
        {t.addBridge}
      </button>

      {unregistered.length > 0 && (
        <Section title={t.linksToRegister}>
          <div className="link-suggestions">
            {unregistered.map(([a, b]) => (
              <button key={pairKey(a, b)} type="button" className="chip" onClick={() => add(a, b)}>
                {fmt(a)} — {fmt(b)} ＋
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ───────────── MATRICE DES ÉTOILES ───────────── */

export function Matrix() {
  const { data, update, t, fmt } = useStore();
  const key = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const cycle = (i: number, j: number) =>
    update((d) => {
      const k = key(i, j);
      d.matrix[k] = ((d.matrix[k] ?? 0) + 1) % 4;
    });

  return (
    <div className="page">
      <TopNav active="matrice" />
      <Breadcrumb crumbs={[{ label: t.bottom.matrix, current: true }]} />
      <p className="intro">{t.matrixIntro}</p>

      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th />
              {STARS.map((j) => (
                <th key={j} data-star={j}>
                  <a href={hrefOf(String(j))}>{fmt(String(j))}</a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STARS.map((i) => (
              <tr key={i}>
                <th data-star={i}>
                  <a href={hrefOf(String(i))}>{fmt(String(i))}</a>
                </th>
                {STARS.map((j) =>
                  i === j ? (
                    <td key={j} className="diag" data-star={i} />
                  ) : (
                    <td key={j} className={`m-cell lvl-${data.matrix[key(i, j)] ?? 0}`}>
                      <button
                        type="button"
                        onClick={() => cycle(i, j)}
                        aria-label={`${fmt(String(i))} × ${fmt(String(j))}`}
                        title={`${data.stars[i].title || fmt(String(i))} × ${data.stars[j].title || fmt(String(j))}`}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title={t.matrixReveals}>
        <Lined
          value={data.matrixInsight}
          rows={4}
          onChange={(v) =>
            update((d) => {
              d.matrixInsight = v;
            })
          }
        />
      </Section>
    </div>
  );
}

/* ───────────── NOTES ───────────── */

export function Notes() {
  const { data, update, t } = useStore();
  return (
    <div className="page">
      <TopNav active="notes" />
      <Breadcrumb crumbs={[{ label: t.notesTitle, current: true }]} />
      <Lined
        value={data.notes}
        rows={18}
        onChange={(v) =>
          update((d) => {
            d.notes = v;
          })
        }
      />
    </div>
  );
}

/* ───────────── LA MÉTHODE ───────────── */

const METHOD_TEXT = {
  fr: {
    bioRole: 'Fondatrice et présidente de Whisper&Map · artiste-auteure-compositrice diffusée à l’international',
    bio: [
      'Artiste depuis 2005, Alexandra Mélody Debon a fondé Whisper&Map, société à mission, qu’elle préside. Autodidacte en design institutionnel et en éthique appliquée, elle s’engage de longue date pour les profils atypiques : en 2022, son entreprise Start Up World French Campus a été reçue à l’Élysée pour son innovation en faveur de l’accès éthique aux grandes écoles et de l’accompagnement de ces profils.',
      'Sa pensée n’a jamais été linéaire : elle avance par connexions, par systèmes, par constellations. Plutôt que de faire entrer ses idées dans des listes, elle a conceptualisé, par l’expérience, une méthode qui épouse ce mouvement et le transforme en action : la méthode NÉSO.',
    ],
    stepsTitle: 'LA MÉTHODE NÉSO EN QUATRE TEMPS',
    steps: [
      ['N', 'NÉBULEUSE', 'Capturer sans trier, en mode apaisé.'],
      ['É', 'ÉTOILE', 'Nommer l’idée-mère et lui donner une adresse.'],
      ['S', 'SATELLITE', 'Déployer les idées qui en naissent.'],
      ['O', 'ORBITE', 'Passer à l’action, sans perdre l’origine.'],
    ],
    principlesTitle: 'TROIS PRINCIPES',
    principles: [
      ['Chaque idée a une adresse.', 'É3.2 dit d’où vient l’idée : la traçabilité remonte toujours jusqu’au cœur.'],
      ['Tout se rejoint.', 'Depuis chaque page, la constellation entière est cliquable : les passerelles relient les idées.'],
      ['On revient toujours au cœur.', 'Le bouton CŒUR ramène au centre en un geste, quand la pensée foisonne.'],
    ],
    howTitle: 'COMMENT UTILISER CE CARNET',
    how: [
      'Écrivez votre pensée-source au centre du cœur.',
      'Videz votre tête dans la nébuleuse, sans chercher à classer.',
      'Quand un éclat mûrit, donnez-lui une étoile (É1 à É12), puis ses satellites.',
      'Entourez dans les passerelles les idées qui se répondent ; tracez les liens sur la carte du ciel.',
      'Transformez chaque idée mûre en action dans son orbite, puis suivez-la dans le tableau d’actions.',
    ],
    guide: [
      ['L’ADRESSE, FIL DE LA TRAÇABILITÉ', 'Chaque idée porte une adresse qui dit d’où elle vient : É3 est la troisième étoile, É3.2 son deuxième satellite. Le fil d’Ariane en haut de chaque page remonte toujours jusqu’au cœur, touche par touche.'],
      ['NÉBULEUSE — LE MODE APAISÉ', 'Déposez ici tout ce qui surgit, sans trier. Quand un éclat mûrit, attribuez-lui une adresse dans la marge et recopiez-le sur l’étoile ou le satellite correspondant.'],
      ['ÉTOILES ET SATELLITES', '12 étoiles (idées-mères) et 6 satellites par étoile, soit 72 idées à développer. Choisissez le statut : germe, exploration, mûre, en action, en sommeil.'],
      ['PASSERELLES — TOUT SE REJOINT', 'En bas de chaque page, la constellation entière est cliquable : sautez vers n’importe quelle étoile ou satellite. Entourez ceux qui sont liés à la page, et notez les liens importants dans le registre.'],
      ['SYSTEM IN STARS — PASSER À L’ACTION', 'Chaque étoile possède son orbite d’action : chaque action garde l’adresse de l’idée qui l’a fait naître. Le tableau d’actions rassemble l’ensemble.'],
      ['REVENIR AU CENTRE', 'Le bouton CŒUR, en haut à gauche de chaque page, ramène à la carte du ciel en un geste.'],
    ],
  },
  en: {
    bioRole: 'Singer-songwriter and performer, broadcast internationally',
    bio: [
      'A singer-songwriter and performer since 2005, Alexandra Mélody Debon is self-taught in institutional design and applied ethics. An entrepreneur committed to atypical profiles, she was received at the Élysée Palace in 2022 for an economic innovation: her company Start Up World French Campus, dedicated to ethical access to France’s grandes écoles and to supporting atypical profiles. That same year, she was named a 2022 LGBTQI+ Role Model, Executives category, an award presented by the French Presidency and the association L’Autre Cercle.',
      'Her thinking has never been linear: it moves through connections, systems and constellations. Rather than forcing her ideas into lists, she conceptualised, through experience, a method that follows this movement and turns it into action: the COTA method.',
    ],
    stepsTitle: 'THE COTA METHOD IN FOUR STEPS',
    steps: [
      ['N', 'NEBULA', 'Capture without sorting, in calm mode.'],
      ['S', 'STAR', 'Name the parent idea and give it an address.'],
      ['S', 'SATELLITE', 'Unfold the ideas it gives birth to.'],
      ['O', 'ORBIT', 'Take action without losing the origin.'],
    ],
    principlesTitle: 'THREE PRINCIPLES',
    principles: [
      ['Every idea has an address.', 'S3.2 tells where an idea comes from: traceability always leads back to the core.'],
      ['Everything connects.', 'From every page, the whole constellation is clickable: bridges link the ideas.'],
      ['You always come back to the core.', 'The CORE button brings you back to the centre in one tap when thoughts overflow.'],
    ],
    howTitle: 'HOW TO USE THIS NOTEBOOK',
    how: [
      'Write your source-thought at the centre of the core.',
      'Empty your head into the nebula, without trying to sort.',
      'When a spark matures, give it a star (S1 to S12), then its satellites.',
      'Circle in the bridges the ideas that echo each other; draw the links on the sky map.',
      'Turn each ripe idea into action in its orbit, then track it on the action board.',
    ],
    guide: [
      ['THE ADDRESS: YOUR THREAD OF TRACEABILITY', 'Every idea carries an address that says where it comes from: S3 is the third star, S3.2 its second satellite. The breadcrumb at the top of each page always leads back to the core, one tap at a time.'],
      ['NEBULA — THE CALM MODE', 'Drop everything that comes up here, without sorting. When a spark matures, give it an address in the margin and copy it onto the matching star or satellite.'],
      ['STARS AND SATELLITES', '12 stars (parent ideas) and 6 satellites per star: 72 ideas to develop. Pick the status: seed, exploring, ripe, in action, dormant.'],
      ['BRIDGES — EVERYTHING CONNECTS', 'At the bottom of each page, the whole constellation is clickable: jump to any star or satellite. Circle those linked to the page, and note the important links in the register.'],
      ['SYSTEM IN STARS — TAKING ACTION', 'Each star has its action orbit: every action keeps the address of the idea that gave birth to it. The action board gathers them all.'],
      ['BACK TO THE CENTRE', 'The CORE button, top left of every page, brings you back to the sky map in one tap.'],
    ],
  },
};

export function Method() {
  const { data, update, replace, t } = useStore();
  const m = METHOD_TEXT[data.settings.lang];
  const file = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `constellamind-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (f: File) => {
    try {
      const next = normalize(JSON.parse(await f.text()));
      if (window.confirm(t.importConfirm)) replace(next);
    } catch {
      window.alert(t.importError);
    }
  };

  return (
    <div className="page method">
      <TopNav active="methode" />
      <Breadcrumb crumbs={[{ label: t.author, current: true }]} />

      <header className="cover">
        <h1>ConstellaMind</h1>
        <p className="cover-sub">
          {data.settings.lang === 'fr' ? 'LA MÉTHODE' : 'THE'} {t.methodName}
          {data.settings.lang === 'en' ? ' METHOD' : ''} · <em>{t.appTagline}</em>
        </p>
        <p className="cover-cota">{t.cota}</p>
        <div className="link-row center">
          <a className="chip strong" href="#/nebuleuse">
            {t.startNebula}
          </a>
          <a className="chip strong" href="#/">
            {t.enterCore}
          </a>
        </div>
      </header>

      <Section title={m.stepsTitle}>
        <div className="steps">
          {m.steps.map(([letter, name, desc]) => (
            <div key={name} className="step">
              <span className="step-letter">{letter}</span>
              <b>{name}</b>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={m.principlesTitle}>
        <ul className="principles">
          {m.principles.map(([h, p]) => (
            <li key={h}>
              <b>{h}</b> {p}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={m.howTitle}>
        <ol className="how">
          {m.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      </Section>

      <Section title={t.guide}>
        <div className="guide">
          {m.guide.map(([h, p]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t.myRules}>
        <Lined
          value={data.rules}
          rows={5}
          onChange={(v) =>
            update((d) => {
              d.rules = v;
            })
          }
        />
      </Section>

      <Section title={data.settings.lang === 'fr' ? "L'AUTRICE" : 'THE AUTHOR'}>
        <div className="author">
          <h3>Alexandra Mélody Debon</h3>
          <p className="role">{m.bioRole}</p>
          {m.bio.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
        </div>
      </Section>

      <Section title={t.settings}>
        <div className="settings">
          <div className="field-row">
            <span className="label">{t.language}</span>
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
          <div className="field-row">
            <span className="label">{t.theme}</span>
            {(['color', 'bw'] as const).map((th) => (
              <button
                key={th}
                type="button"
                className={`chip ${data.settings.theme === th ? 'on' : ''}`}
                onClick={() =>
                  update((d) => {
                    d.settings.theme = th;
                  })
                }
              >
                {th === 'color' ? t.themeColor : t.themeBw}
              </button>
            ))}
          </div>
          <p className="fine">{t.savedLocally}</p>
          <div className="link-row">
            <button type="button" className="chip" onClick={exportData}>
              ⤓ {t.exportData}
            </button>
            <button type="button" className="chip" onClick={() => file.current?.click()}>
              ⤒ {t.importData}
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importData(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="chip danger"
              onClick={() => {
                if (window.confirm(t.resetConfirm)) {
                  const settings = data.settings;
                  const fresh = normalize({ version: 1, settings });
                  replace(fresh);
                }
              }}
            >
              {t.reset}
            </button>
          </div>
        </div>
      </Section>

      <footer className="copyright">
        <p>{t.designedFor}</p>
        <p>{t.copyright}</p>
      </footer>
    </div>
  );
}
