import { auth } from '@/lib/firebase';
import type { AdSlot } from '@/lib/delivery';

/** Conteo de vistas y toques de anuncios (para que el restaurante tenga pruebas). Todo falla en silencio. */

const CLICK_KEY = 'llamago-ad-click-v1';
const LATER_KEY = 'llamago-later-v1';
const OPEN_KEY = 'llamago-open-restaurant-v1';
const DAY = 24 * 3600 * 1000;

async function post(event: 'view' | 'click' | 'later', restaurantId: string, slot: AdSlot) {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch('/api/delivery/ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, restaurantId, slot }),
      keepalive: true,
    });
  } catch { /* sin conteo */ }
}

/** Una vista por anuncio y lugar cada vez que se abre la app (no se infla al deslizar). */
export function trackView(restaurantId: string, slot: AdSlot) {
  try {
    const k = `llamago-ad-seen:${slot}:${restaurantId}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
  } catch { /* sin sessionStorage: cuenta igual */ }
  void post('view', restaurantId, slot);
}

/** Toque en un anuncio: se cuenta y se recuerda 24 h para saber si el pedido vino de él. */
export function trackClick(restaurantId: string, slot: AdSlot) {
  try { localStorage.setItem(CLICK_KEY, JSON.stringify({ restaurantId, slot, at: Date.now() })); } catch { /* ok */ }
  void post('click', restaurantId, slot);
}

/** Si la persona pidió a este restaurante poco después de tocar su anuncio, devuelve de qué anuncio vino. */
export function adRefFor(restaurantId: string): AdSlot | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(CLICK_KEY) || 'null');
    if (v && v.restaurantId === restaurantId && Date.now() - v.at < DAY) return v.slot as AdSlot;
  } catch { /* ok */ }
  return undefined;
}

export interface LaterItem { id: string; name: string; at: number }

export const readLater = (): LaterItem[] => {
  try { return (JSON.parse(localStorage.getItem(LATER_KEY) || '[]') as LaterItem[]).filter((x) => Date.now() - x.at < 3 * DAY); } catch { return []; }
};
/** "Pedir más tarde": lo deja guardado arriba en Delivery para cuando termine el pedido actual. */
export function saveLater(id: string, name: string) {
  const list = readLater().filter((x) => x.id !== id);
  try { localStorage.setItem(LATER_KEY, JSON.stringify([{ id, name, at: Date.now() }, ...list].slice(0, 3))); } catch { /* ok */ }
  void post('later', id, 'later');
}
export function removeLater(id: string) {
  try { localStorage.setItem(LATER_KEY, JSON.stringify(readLater().filter((x) => x.id !== id))); } catch { /* ok */ }
}

/** Para abrir Delivery directo en un restaurante (desde el inicio o desde un aviso al celular). */
export function setPendingRestaurant(id: string) { try { localStorage.setItem(OPEN_KEY, id); } catch { /* ok */ } }
export function takePendingRestaurant(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('r');
    const v = q || localStorage.getItem(OPEN_KEY);
    localStorage.removeItem(OPEN_KEY);
    if (q) window.history.replaceState(null, '', window.location.pathname);
    return v;
  } catch { return null; }
}
export function hasPendingRestaurant(): boolean {
  try { return !!new URLSearchParams(window.location.search).get('r') || !!localStorage.getItem(OPEN_KEY); } catch { return false; }
}
