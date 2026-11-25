import { auth } from '@/lib/firebase';

/** Avisos push del teléfono (llegan con la app cerrada). Todo falla en silencio: nunca debe romper la app. */

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function token() {
  return (await auth.currentUser?.getIdToken()) ?? null;
}

async function register(): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  const reg = await navigator.serviceWorker.ready;
  const { key } = await fetch('/api/push/key').then((r) => r.json());
  if (!key) return false;
  const wanted = b64ToBytes(key);
  let sub = await reg.pushManager.getSubscription();
  const same = sub && sub.options.applicationServerKey && new Uint8Array(sub.options.applicationServerKey).join() === wanted.join();
  if (sub && !same) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return res.ok;
}

export const pushPermission = (): NotificationPermission | 'unsupported' => (supported() ? Notification.permission : 'unsupported');

/** Pide permiso (si falta) y registra este teléfono. Llamar desde un toque del usuario. */
export async function enablePush(): Promise<boolean> {
  try {
    if (!supported()) return false;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return false;
    return await register();
  } catch (e) {
    console.warn('Push: no se pudo activar', e);
    return false;
  }
}

/** Si ya hay permiso, vuelve a registrar el teléfono (por si cambió la llave o se renovó). */
export async function syncPush(): Promise<void> {
  try {
    if (supported() && Notification.permission === 'granted') await register();
  } catch { /* sin push */ }
}

/** Avisa al servidor que pasó algo (nuevo viaje, cambio de estado, mensaje) para que mande el push a la otra persona. */
export function pushEvent(event: 'ride_new' | 'ride_update' | 'ride_chat' | 'delivery_chat', id: string, messageId?: string) {
  (async () => {
    const t = await token();
    if (!t) return;
    await fetch('/api/push/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ event, id, messageId }),
      keepalive: true,
    });
  })().catch(() => {});
}

const PROMO_KEY = 'llamago-promos-v1';
export const getPromoPref = (): boolean => { try { return localStorage.getItem(PROMO_KEY) !== 'off'; } catch { return true; } };
/** Activa o apaga los avisos de ofertas de restaurantes (máx. 3 por semana). */
export async function setPromoPref(on: boolean): Promise<void> {
  try { localStorage.setItem(PROMO_KEY, on ? 'on' : 'off'); } catch { /* ok */ }
  try {
    const t = await token();
    if (!t) return;
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ action: 'prefs', promos: on }),
    });
  } catch { /* se reintenta al volver a tocar */ }
}
