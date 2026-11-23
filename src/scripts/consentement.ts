/**
 * Consentement aux cookies (règles CNIL) : le choix est gardé 6 mois dans le navigateur,
 * puis redemandé. Aucun outil de mesure n'est chargé sans accord.
 *
 * Pour brancher plus tard une mesure d'audience (Google Analytics, pixel Meta…) :
 *   import { surConsentement } from './consentement';
 *   surConsentement((c) => { if (c.mesure) chargerAnalytics(); });
 */
export type Consentement = { mesure: boolean; date: number; version: 1 };

const CLE = 'etsi-consentement';
const DUREE = 1000 * 60 * 60 * 24 * 182; // 6 mois

export function lireConsentement(): Consentement | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Consentement | null;
    if (!c || c.version !== 1 || Date.now() - c.date > DUREE) return null;
    return c;
  } catch {
    return null;
  }
}

export function enregistrerConsentement(mesure: boolean): Consentement {
  const c: Consentement = { mesure, date: Date.now(), version: 1 };
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* navigation privée : choix valable pour la visite */ }
  window.dispatchEvent(new CustomEvent<Consentement>('etsi:consentement', { detail: c }));
  return c;
}

/** Appelle `cb` avec le choix actuel (s'il existe), puis à chaque nouveau choix. */
export function surConsentement(cb: (c: Consentement) => void): void {
  const c = lireConsentement();
  if (c) cb(c);
  window.addEventListener('etsi:consentement', (e) => cb((e as CustomEvent<Consentement>).detail));
}
