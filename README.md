# Site &si

Site vitrine de l'agence &si (« et si ») : Astro, Tailwind v4, GSAP + ScrollTrigger, Lenis.
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
| `PUBLIC_WEB3FORMS_KEY` | Clé d'accès Web3Forms (web3forms.com), qui envoie le formulaire de contact par e-mail. Sans elle, le formulaire invite à écrire sur WhatsApp. |
| `SITE_URL` | Domaine du site (liens canoniques, hreflang, sitemap, robots.txt). |
| `BASE_PATH` | Sous-dossier de publication : `/-Si-` sur GitHub Pages, `/` sur un domaine propre. |

## Organisation

- `src/i18n/{fr,en,ar}.json` : tous les textes. EN et AR reprennent le FR pour toute clé absente.
- `src/i18n/index.ts` : routes (mêmes slugs dans les 3 langues), liens WhatsApp, sens d'écriture.
- `src/views/` : une vue par page, partagée par les 3 langues ; `src/pages/` ne contient que des fichiers d'appel.
- `src/components/home/` : les sections de l'accueil.
- `src/components/Intro.astro` : écran d'entrée (logo animé en CSS, une fois par session, désactivé si les animations sont réduites).
- `src/components/home/Hero.astro` : accroche + configurateur de projet ; la sélection est transmise à Contact (`?services=…&poles=…`).
- `src/components/MobileBar.astro` : barre d'actions fixe en bas d'écran sur mobile.
- `src/styles/global.css` : jetons de la charte dans `@theme`.
- `public/3d/` : icônes des pôles (rendus Blender). `public/brand/` : logos SVG.

## Mise en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `claude/eager-gates-7m1151`
(ou à la main depuis l'onglet Actions). Adresse : https://ayoubhassani91.github.io/-Si-/

- Clé Web3Forms : secret de dépôt `PUBLIC_WEB3FORMS_KEY` (Settings → Secrets and variables → Actions).
- Domaine propre : variables de dépôt `SITE_URL` (ex. `https://www.exemple.fr`) et `BASE_PATH` = `/`, puis domaine à déclarer dans Settings → Pages.


## Mesures (Lighthouse 13, profil mobile, build local)

Accueil FR 96 / AR 99 en performance ; 100 en accessibilité, bonnes pratiques et SEO sur toutes les pages testées.

## À compléter

- Clé Web3Forms et domaine définitif (`.env`).
- Mentions légales et confidentialité : emplacements `[À COMPLÉTER]`.
- Études de cas de l'accueil (marquées `[À compléter]`).
- Newsletter : interface seulement, à brancher sur un outil d'e-mailing.
