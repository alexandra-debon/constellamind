# Publier ConstellaMind sur l'App Store et Google Play

Le code est prêt pour les deux stores : une seule base (React + Vite), emballée par
[Capacitor](https://capacitorjs.com) dans une vraie app iOS (`ios/`) et une vraie app Android (`android/`).

Identifiant de l'app : **`com.whisperandmap.constellamind`**. Il est définitif une fois l'app publiée. Pour le changer, modifiez-le avant la première publication dans `capacitor.config.ts`, `android/app/build.gradle` et le projet Xcode.

---

## 1. Ce qu'il faut avoir

| | App Store (iPhone, iPad) | Google Play (Android) |
|---|---|---|
| Compte | [Apple Developer Program](https://developer.apple.com/programs/) : 99 $/an | [Google Play Console](https://play.google.com/console) : 25 $ une fois |
| Ordinateur | **Un Mac avec Xcode** (obligatoire pour envoyer l'app à Apple) | N'importe quel ordinateur, ou rien : GitHub Actions compile l'app |
| Délai de validation | 1 à 3 jours en général | Quelques heures à quelques jours. Un **nouveau compte personnel** doit d'abord faire tester l'app par 12 personnes pendant 14 jours (test fermé) |

Pour un compte d'entreprise (Whisper&Map), prévoyez un numéro **D-U-N-S** (gratuit, quelques jours) côté Apple. Côté Google, le compte « organisation » évite la phase de test à 12 personnes.

---

## 2. Tester tout de suite

- **Sur Android** : à chaque push, l'onglet *Actions* du dépôt → workflow **Android** → télécharger l'artefact `constellamind-debug-apk`, puis l'installer sur le téléphone ou la tablette.
- **Sur iPhone / iPad** : il faut un Mac (voir étape 3), ou TestFlight une fois le compte Apple ouvert.
- **Sur le web** : `npm run dev`, ou la version GitHub Pages.

---

## 3. App Store (sur un Mac)

```bash
npm install
npm run ios          # compile le web, synchronise, ouvre Xcode
```

Dans Xcode :
1. Cible **App** → *Signing & Capabilities* → choisissez votre **Team** (compte Apple Developer).
2. *General* → vérifiez **Version** (1.0.0) et **Build** (1, à augmenter à chaque envoi).
3. Menu **Product → Archive**, puis **Distribute App → App Store Connect → Upload**.

Dans [App Store Connect](https://appstoreconnect.apple.com) :
1. **Mes apps → +** → nouvelle app, identifiant `com.whisperandmap.constellamind`.
2. Remplissez la fiche avec les textes de [`docs/FICHE-STORES.md`](FICHE-STORES.md).
3. **Confidentialité** : « Aucune donnée collectée ». URL de la politique : `https://alexandra-debon.github.io/constellamind/privacy.html`.
4. Captures d'écran : iPhone 6,9" **et** iPad 13" (l'app étant pour iPad, elles sont obligatoires).
5. Choisissez le build envoyé depuis Xcode → **Soumettre pour vérification**.

Déjà prêts dans le projet : icône, écran de démarrage clair et sombre, manifeste de confidentialité Apple (`PrivacyInfo.xcprivacy`), déclaration « pas de chiffrement » (aucune question d'export à l'envoi).

---

## 4. Google Play

### a) Créer la clé de signature (une seule fois, à conserver précieusement)

```bash
keytool -genkey -v -keystore constellamind-release.jks -alias constellamind \
  -keyalg RSA -keysize 2048 -validity 10000
```

⚠️ **Sauvegardez ce fichier et ses mots de passe** (gestionnaire de mots de passe). Sans eux, impossible de publier une mise à jour. Ne les mettez jamais dans le dépôt.

### b) Compiler le fichier `.aab`

**Option 1, par GitHub (sans installer Android Studio).** Dans *Settings → Secrets and variables → Actions*, ajoutez :

| Secret | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le fichier `.jks` encodé : `base64 -i constellamind-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `constellamind` |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Chaque push produit alors l'artefact **`constellamind-release-aab`**, signé et prêt pour Play.

**Option 2, en local** avec Android Studio : créez `android/keystore.properties` (ignoré par git) :

```properties
storeFile=/chemin/vers/constellamind-release.jks
storePassword=...
keyAlias=constellamind
keyPassword=...
```

puis `npm run sync && cd android && ./gradlew bundleRelease`.
Le fichier produit : `android/app/build/outputs/bundle/release/app-release.aab`.

### c) Dans la Play Console

1. **Créer une application** → ConstellaMind, gratuite.
2. Fiche du Store : textes de [`docs/FICHE-STORES.md`](FICHE-STORES.md), icône 512 px (`assets/icon-only.png`), image de présentation 1024 × 500, captures téléphone et tablette.
3. **Sécurité des données** : aucune donnée collectée ni partagée. Politique : `https://alexandra-debon.github.io/constellamind/privacy.html`.
4. Classification du contenu (questionnaire) → « Tout public ».
5. **Tests → Test fermé** (obligatoire pour un nouveau compte personnel), puis **Production** → importer le `.aab` → envoyer pour examen.

---

## 5. Publier une mise à jour

1. Augmenter la version dans `package.json`, `android/app/build.gradle` (`versionName`) et Xcode (Version). Le `versionCode` Android suit automatiquement le numéro du build GitHub.
2. `npm run sync`
3. Refaire l'étape Xcode (Archive) et/ou importer le nouveau `.aab` dans Play.

Les données des utilisateurs restent sur leur appareil d'une version à l'autre.

## 6. Régénérer les icônes

Modifiez `assets/icon.svg` (et `icon-foreground.svg` pour Android), exportez-les en PNG 1024 px dans `assets/`, puis lancez `npm run assets`.
