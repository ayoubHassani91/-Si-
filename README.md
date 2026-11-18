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
| `PUBLIC_WEB3FORMS_KEY` | Clé d'accès Web3Forms (web3forms.com), qui envoie le formulaire de contact par e-mail. Sans elle, le formulaire invite à écrire sur WhatsApp. |
| `SITE_URL` | Domaine définitif (liens canoniques, hreflang, sitemap, robots.txt). |

## Organisation

- `src/i18n/{fr,en,ar}.json` : tous les textes. EN et AR reprennent le FR pour toute clé absente.
- `src/i18n/index.ts` : routes (mêmes slugs dans les 3 langues), liens WhatsApp, sens d'écriture.
- `src/views/` : une vue par page, partagée par les 3 langues ; `src/pages/` ne contient que des fichiers d'appel.
- `src/components/home/` : les sections de l'accueil.
- `src/scripts/hero3d.ts` : scène three.js du hero (une seule animation dont le temps est piloté : construction 0–4 s, attente en boucle 4–8 s, pôles 8–11 s au scroll).
- `src/styles/global.css` : jetons de la charte dans `@theme`.
- `public/3d/` : modèles .glb (Draco), vidéos de repli, image fixe. `public/brand/` : logos SVG. `public/draco/` : décodeur Draco local.

## Comportement du hero

| Situation | Rendu |
|---|---|
| Écran ≥ 768 px, WebGL disponible | Scène 3D, chargée une fois la page au repos |
| Écran < 768 px, appareil peu puissant ou pas de WebGL | Vidéo WebM/MP4 (4:5 sur mobile) |
| `prefers-reduced-motion: reduce` | Image fixe, aucune animation |

## Mesures (Lighthouse 13, profil mobile, build local)

Accueil FR 96 / AR 99 en performance ; 100 en accessibilité, bonnes pratiques et SEO sur toutes les pages testées.

## À compléter

- Clé Web3Forms et domaine définitif (`.env`).
- Mentions légales et confidentialité : emplacements `[À COMPLÉTER]`.
- Études de cas de l'accueil (marquées `[À compléter]`).
- Newsletter : interface seulement, à brancher sur un outil d'e-mailing.
