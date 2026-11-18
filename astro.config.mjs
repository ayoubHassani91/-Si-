// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// [À COMPLÉTER] : remplacer par le domaine définitif du site &si.
const SITE_URL = process.env.SITE_URL ?? 'https://www.etsi-agence.example';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en', 'ar'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'fr', locales: { fr: 'fr-FR', en: 'en', ar: 'ar' } },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
