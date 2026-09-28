# Mettre en place les comptes et les abonnements

L'app est prête côté code. Il reste à ouvrir les services et à y coller quelques clés.
Tant que ces clés manquent, l'app fonctionne normalement en version gratuite, et l'écran Premium affiche « Les abonnements arrivent bientôt ».

## Vue d'ensemble

```
iPhone / iPad ── App Store ──┐
Android ─────── Google Play ─┼──► RevenueCat ──(webhook)──► Supabase : table entitlements
Web ─────────── Stripe ──────┘         ▲                         │
                                       └── l'app lit le statut ◄─┘  (+ comptes + synchro)
```

- **Supabase** : comptes (connexion par code reçu par e-mail), constellations synchronisées, statut Premium.
- **RevenueCat** : réunit les achats des trois boutiques et prévient Supabase à chaque achat, renouvellement ou expiration.
- Offre : un seul droit d'accès, **`premium`**, et deux formules : **mensuelle 4,99 €** et **annuelle 39,99 €**.

| | Gratuit | Premium |
|---|---|---|
| Méthode complète, clavier et stylet | ✓ | ✓ |
| Constellations | 1 | illimitées |
| Synchronisation entre appareils | — | ✓ |
| Export PDF / image | — | ✓ |
| Surligneur (manuscrit et texte tapé) | — | ✓ |

Tous les comptes (Apple, Google, Stripe, RevenueCat) sont **au nom de Whisper&Map**.

---

## 1. Supabase (comptes, synchro) — ✅ projet créé

Projet **`constellamind`** (réf. `uxcjevgxzmkpmlkapmwl`, région Paris `eu-west-3`), dans l'organisation Whisper And Map. Déjà en place :
- tables `entitlements` et `constellations`, avec des règles d'accès vérifiées : seul un abonné peut synchroniser, personne ne peut s'attribuer Premium, chacun ne voit que ses données ;
- fonctions `delete-account` et `revenuecat-webhook` déployées ;
- adresse et clé publique du projet dans [`.env`](../.env), utilisées par toutes les compilations.

À régler dans le [tableau de bord Supabase](https://supabase.com/dashboard/project/uxcjevgxzmkpmlkapmwl) (impossible depuis l'app ou GitHub) :

1. **Authentication → Email Templates** : l'app demande un **code à 6 chiffres**. Dans les modèles **Magic Link** *et* **Confirm signup**, remplacez le contenu par :
   ```html
   <h2>Votre code ConstellaMind</h2>
   <p>Saisissez ce code dans l'app pour vous connecter :</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Il est valable 1 heure. Si vous n'avez rien demandé, ignorez ce message.</p>
   ```
   Sujet conseillé : `Votre code ConstellaMind`.
2. **Authentication → Emails → SMTP Settings** : branchez **Brevo** (Brevo → *SMTP & API* → *SMTP*). Hôte `smtp-relay.brevo.com`, port `587`, expéditeur `contact@whisper-and-map.com`. **Indispensable** : sans SMTP personnalisé, Supabase n'envoie des e-mails qu'aux membres de l'équipe du projet, avec un plafond horaire très bas.
3. **Authentication → URL Configuration** : *Site URL* = `https://alexandra-debon.github.io/constellamind`.
4. Plus tard, après RevenueCat (étape 3) : **Edge Functions → Secrets** :
   - `REVENUECAT_WEBHOOK_AUTH` = `Bearer <un long secret au hasard>`
   - `REVENUECAT_SECRET_KEY` = la clé secrète RevenueCat `sk_…`

## 2. Produits dans les boutiques

**App Store Connect** → votre app → *Abonnements* → groupe « ConstellaMind Premium » :
- `constellamind_premium_monthly` : 1 mois, 4,99 €
- `constellamind_premium_yearly` : 1 an, 39,99 €

Pensez à signer l'*Accord pour les apps payantes* et à remplir les informations bancaires et fiscales de Whisper&Map. Inscrivez-vous au *App Store Small Business Program* (commission de 15 % au lieu de 30 %).

**Google Play Console** → *Monétiser → Abonnements* : un abonnement `constellamind_premium` avec deux forfaits de base, `monthly` (4,99 €) et `yearly` (39,99 €). Profil de paiement au nom de Whisper&Map. La commission Google est de 15 % sur les abonnements.

## 3. RevenueCat

1. Créez un projet **ConstellaMind** sur [revenuecat.com](https://www.revenuecat.com).
2. Ajoutez les apps **App Store** (identifiant `com.whisperandmap.constellamind`, clé In-App Purchase d'App Store Connect) et **Play Store** (compte de service Google).
3. Créez l'*Entitlement* **`premium`** et attachez-y les produits des deux boutiques.
4. Créez l'*Offering* **`default`** (courante) avec deux packages : **Monthly** et **Annual**.
5. **Web** : *Web Billing* → connectez **Stripe** (compte Whisper&Map), créez les deux produits web au même prix, rattachez-les à `premium` et à l'offering, puis créez une **Web Purchase Link**. Copiez son adresse (`https://pay.rev.cat/…`).
6. **Integrations → Webhooks** : URL `https://uxcjevgxzmkpmlkapmwl.supabase.co/functions/v1/revenuecat-webhook`, *Authorization header* : exactement la même valeur que `REVENUECAT_WEBHOOK_AUTH` (`Bearer …`).
7. **API keys** : copiez les clés publiques iOS (`appl_…`) et Android (`goog_…`), ainsi que la **clé secrète** (`sk_…`) pour l'étape 1.5.

## 4. Brancher les clés dans l'app

Dans GitHub : *Settings → Secrets and variables → Actions → **Variables*** (ces clés sont publiques par nature) :

Supabase est déjà branché via `.env`. Restent :

| Variable | Valeur |
|---|---|
| `VITE_REVENUECAT_IOS_KEY` | `appl_…` |
| `VITE_REVENUECAT_ANDROID_KEY` | `goog_…` |
| `VITE_WEB_PURCHASE_LINK` | `https://pay.rev.cat/…` |

Le site, l'APK Android et la vérification iOS se recompilent alors avec les abonnements actifs. Pour Xcode ou Android Studio en local, copiez `.env.example` en `.env.local` et remplissez-le.

## 5. Vous offrir Premium (et à vos testeurs)

Après avoir créé votre compte dans l'app, dans Supabase → *SQL Editor* (ou demandez-le-moi) :

```sql
insert into public.entitlements (user_id, premium, source)
select id, true, 'manual' from auth.users where email = 'votre@adresse.fr'
on conflict (user_id) do update set premium = true, source = 'manual', expires_at = null;
```

Pour les tests d'achat : *Sandbox testers* dans App Store Connect, *License testing* dans la Play Console, *mode test* dans Stripe.

## 6. Règles des boutiques déjà respectées

- Prix réels affichés depuis Apple et Google (en devise locale), formule annuelle mise en avant sans masquer la mensuelle.
- Texte de renouvellement automatique, liens vers les **Conditions** (`terms.html`) et la **Confidentialité** (`privacy.html`) sur l'écran d'abonnement.
- Bouton **Restaurer mes achats**.
- **Suppression du compte** dans l'app (Compte → Supprimer mon compte), obligatoire chez Apple.
- Achat possible **sans compte** sur iPhone et Android (le compte n'est demandé que pour la synchro). Les achats se rattachent au compte dès la connexion.
- Sur iOS, pas de lien vers le paiement web (interdit par Apple hors exceptions régionales) : le web a sa propre caisse.

⚠️ `terms.html` est un modèle : faites-le relire par un professionnel du droit (rétractation, médiation de la consommation, mentions légales de Whisper&Map).
