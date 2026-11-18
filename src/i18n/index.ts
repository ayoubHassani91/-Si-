import fr from './fr.json';
import en from './en.json';
import ar from './ar.json';

export const LOCALES = ['fr', 'en', 'ar'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'fr';
export type Dict = typeof fr;
export type PoleKey = 'logiciels' | 'communication' | 'conseil';
export const POLES: PoleKey[] = ['logiciels', 'communication', 'conseil'];

type Plain = Record<string, unknown>;
function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return (over ?? base) as T;
  const out: Plain = { ...(base as Plain) };
  if (over && typeof over === 'object') {
    for (const [k, v] of Object.entries(over as Plain)) out[k] = merge((base as Plain)[k], v);
  }
  return out as T;
}

// EN et AR héritent du FR pour toute clé manquante.
const dicts: Record<Lang, Dict> = {
  fr,
  en: merge(fr, en),
  ar: merge(fr, ar),
};

export const t = (lang: Lang): Dict => dicts[lang];
export const dirOf = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');
export const htmlLang: Record<Lang, string> = { fr: 'fr-FR', en: 'en', ar: 'ar' };

/** Pages du site : mêmes slugs dans toutes les langues. */
export const ROUTES = {
  home: '',
  services: 'services/',
  logiciels: 'services/logiciels-produits/',
  communication: 'services/communication-creation/',
  conseil: 'services/accompagnement-conseil/',
  about: 'a-propos/',
  contact: 'contact/',
  legal: 'mentions-legales/',
  privacy: 'confidentialite/',
} as const;
export type RouteKey = keyof typeof ROUTES;

export function href(lang: Lang, route: RouteKey | string = 'home', hash = ''): string {
  const slug = route in ROUTES ? ROUTES[route as RouteKey] : route;
  const prefix = lang === DEFAULT_LANG ? '/' : `/${lang}/`;
  return `${prefix}${slug}${hash}`;
}

/** Retrouve le slug courant (sans préfixe de langue) pour le sélecteur de langue. */
export function slugOf(pathname: string): string {
  const parts = pathname.replace(/^\/+/, '').split('/');
  if (LOCALES.includes(parts[0] as Lang) && parts[0] !== DEFAULT_LANG) parts.shift();
  return parts.join('/');
}

export function whatsappHref(lang: Lang): string {
  return `https://wa.me/33652277787?text=${encodeURIComponent(t(lang).whatsapp.message)}`;
}
