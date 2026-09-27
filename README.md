# ConstellaMind

**La méthode NÉSO — la pensée en constellation**
*COTA — Constellation-Oriented Thinking Approach*

Une application conçue pour les esprits foisonnants et la pensée en arborescence.
Elle transpose en app web (iPad, tablette, ordinateur, téléphone) le carnet PDF à liens hypertextes ConstellaMind.

## La méthode en quatre temps

| | | |
|---|---|---|
| **N** | Nébuleuse | Capturer sans trier, en mode apaisé. |
| **É** | Étoile | Nommer l'idée-mère et lui donner une adresse. |
| **S** | Satellite | Déployer les idées qui en naissent. |
| **O** | Orbite | Passer à l'action, sans perdre l'origine. |

Trois principes : **chaque idée a une adresse** (É3.2 = étoile 3, satellite 2), **tout se rejoint** (passerelles cliquables depuis chaque page), **on revient toujours au cœur** (bouton CŒUR).

## Ce que fait l'application

- **Cœur** : la carte du ciel, avec la pensée-source au centre et 12 étoiles de 6 satellites chacune (72 idées). On touche une étoile ou un satellite pour l'ouvrir. On trace des liens en glissant d'une idée à l'autre : directement avec l'Apple Pencil, ou au doigt en mode « Tracer des liens ».
- **Nébuleuse** : capture libre. On attribue une adresse à un éclat, puis on le recopie dans l'étoile ou le satellite correspondant.
- **Étoile** : intitulé, statut (germe, exploration, mûre, en action, en sommeil), intuition de départ, satellites et notes.
- **Satellite** : fratrie, origine de l'idée, développement, idées reliées et actions à mettre en œuvre, avec « Reporter dans l'orbite ».
- **Orbite d'action** (une par étoile) et **tableau d'actions** : chaque action garde son adresse d'origine.
- **Passerelles** : en bas de chaque page, toute la constellation est cliquable. Le mode « Entourer » marque les idées liées à la page.
- **Registre des passerelles** : de, vers, nature (P prolonge · O s'oppose · N nourrit · F fusionne · Q questionne), pourquoi, date.
- **Matrice des étoiles** : 12 × 12, la couleur de la case fonce avec la force du lien.
- **Notes**, **La méthode** (mode d'emploi, « mes règles de constellation »).
- **Français / English** (édition COTA, adresses S3.2) et **Couleur / Noir & blanc** (pour les tablettes e-ink comme reMarkable ou Paper Pro).
- Sauvegarde automatique sur l'appareil, avec export et import d'un fichier `.json`.

## Développer

```bash
npm install
npm run dev      # serveur local
npm run build    # version de production dans dist/
```

React 18 + TypeScript + Vite, sans serveur ni compte : les données restent dans le navigateur (localStorage).

## Mise en ligne

Le workflow `.github/workflows/deploy.yml` publie l'app sur GitHub Pages à chaque push sur `main`.
Il faut l'activer une fois : **Settings → Pages → Source : GitHub Actions**.
Sur iPad, ouvrez ensuite l'adresse dans Safari, puis **Partager → Sur l'écran d'accueil** pour l'utiliser comme une app.

---

© 2026 Alexandra Mélody Debon · Whisper&Map — ConstellaMind et la méthode NÉSO / COTA. Tous droits réservés.
Ce dépôt n'est pas sous licence libre : la méthode, les textes et le code ne peuvent pas être réutilisés sans autorisation.
