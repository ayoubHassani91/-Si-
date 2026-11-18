import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/** Défilement doux (desktop uniquement, désactivé si l'utilisateur réduit les animations). */
export function initLenis() {
  if (lenis || reduceMotion() || window.matchMedia('(pointer: coarse)').matches) return;
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

export function scrollToTop() {
  lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0);
}

/** Apparitions sobres : seulement sur les éléments marqués [data-reveal]. */
export function initReveals(root: ParentNode = document) {
  const els = root.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduceMotion()) {
    els.forEach((el) => (el.style.opacity = '1'));
    return;
  }
  els.forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        delay: Number(el.dataset.revealDelay ?? 0),
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      },
    );
  });
}

export function killTriggers() {
  ScrollTrigger.getAll().forEach((st) => st.kill());
}

export { gsap, ScrollTrigger };
