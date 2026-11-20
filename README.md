# Site &si

Site vitrine de l'agence &si (« et si ») : Astro, Tailwind v4, GSAP + ScrollTrigger, Lenis, three.js.
Trois langues : français (`/`), anglais (`/en/`), arabe (`/ar/`, de droite à gauche).

## Démarrer

```bash
npm install
cp .env.example .env      # puis renseigner les valeurs
npm run dev               # http://localhost:4321
npm run build && npm run preview
npx astro check           # vérification TypeScript / Astro
```

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `PUBLIC_WEB3FORMS_KEY` | Facultatif. Clé d'accès Web3Forms (web3forms.com) qui envoie le formulaire de contact par e-mail ; par défaut, celle écrite dans `src/views/Contact.astro`. |
| `SITE_URL` | Domaine du site (liens canoniques, hreflang, sitemap, robots.txt). |
| `BASE_PATH` | Sous-dossier de publication : `/-Si-` sur GitHub Pages, `/` sur un domaine propre. |

## Organisation

- `src/i18n/{fr,en,ar}.json` : tous les textes. EN et AR reprennent le FR pour toute clé absente.
- `src/i18n/index.ts` : routes (mêmes slugs dans les 3 langues), liens WhatsApp, sens d'écriture.
- `src/views/` : une vue par page, partagée par les 3 langues ; `src/pages/` ne contient que des fichiers d'appel.
- `src/components/home/` : les sections de l'accueil.
- `src/components/Intro.astro` : écran de chargement à chaque page, animation du logo rendue dans Blender (`public/intro/`, scène `intro` de `3d/etsi-3d.blend`) ; désactivé si les animations sont réduites.
- `src/components/home/Hero.astro` + `src/scripts/hero3d.ts` : logo &si en 3D (29 blocs découpés dans Blender, `public/3d/logo.glb`) qui s'assemble à l'entrée, se tourne vers le curseur, flotte en continu et se rejoue au clic ; image fixe animée en CSS sur mobile (`public/3d/logo-poster.webp`).
- `src/components/MobileBar.astro` : barre d'actions fixe en bas d'écran sur mobile.
- `src/styles/global.css` : jetons de la charte dans `@theme`.
- `public/3d/` : & 3D (.glb Draco) et son image fixe. `public/draco/` : décodeur Draco. `public/brand/` : logos SVG.

## Mise en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `claude/eager-gates-7m1151`
(ou à la main depuis l'onglet Actions). Adresse : https://ayoubhassani91.github.io/-Si-/

- Formulaire de contact : envoyé par Web3Forms vers la boîte de l'agence. La clé d'accès est publique par nature (elle ne permet que d'envoyer vers cette boîte) ; restreignez-la au domaine du site dans le tableau de bord Web3Forms.
- Domaine propre : variables de dépôt `SITE_URL` (ex. `https://www.exemple.fr`) et `BASE_PATH` = `/`, puis domaine à déclarer dans Settings → Pages.


## Mesures (Lighthouse 13, profil mobile, build local)

Accueil FR 96 / AR 99 en performance ; 100 en accessibilité, bonnes pratiques et SEO sur toutes les pages testées.

## À compléter

- Clé Web3Forms et domaine définitif (`.env`).
- Mentions légales et politique de confidentialité / cookies : pages retirées pour l'instant, à ajouter avant l'ouverture au public.
- Études de cas de l'accueil (marquées `[À compléter]`).
- Newsletter : interface seulement, à brancher sur un outil d'e-mailing.
