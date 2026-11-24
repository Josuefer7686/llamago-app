import 'server-only';
import crypto from 'node:crypto';
import webpush from 'web-push';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

/**
 * Avisos push (llegan con la app cerrada). Las llaves VAPID se derivan de un secreto del servidor
 * que ya existe, así no hace falta configurar nada nuevo: misma llave siempre, sin guardarla en ningún lado.
 */
let cached: { publicKey: string; privateKey: string } | null = null;
function vapid() {
  if (cached) return cached;
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || process.env.ADMIN_SESSION_SECRET || '';
  if (!secret) return null;
  const priv = crypto.createHmac('sha256', secret).update('llamago-vapid-v1').digest();
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(priv);
  cached = { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: priv.toString('base64url') };
  return cached;
}

export const pushPublicKey = () => vapid()?.publicKey ?? null;

export interface PushPayload { title: string; body: string; url?: string; tag?: string; urgent?: boolean }
export interface StoredSub { endpoint: string; keys: { p256dh: string; auth: string }; at: number }

export const subId = (endpoint: string) => crypto.createHash('sha1').update(endpoint).digest('hex').slice(0, 20);

/** Manda el aviso a todos los teléfonos registrados de cada usuario. Nunca lanza error. */
export async function sendPush(uids: string[], payload: PushPayload): Promise<number> {
  const keys = vapid();
  const db = getAdminDb();
  const targets = [...new Set(uids.filter(Boolean))].slice(0, 80);
  if (!keys || !db || !targets.length) return 0;
  webpush.setVapidDetails('https://llamago.vercel.app', keys.publicKey, keys.privateKey);
  const body = JSON.stringify({ icon: '/icon-192.png', badge: '/icon-192.png', url: '/', ...payload });
  let sent = 0;
  try {
    const docs = await db.getAll(...targets.map((u) => db.collection('push_subscriptions').doc(u)));
    await Promise.allSettled(docs.flatMap((d) => {
      const subs = (d.data()?.subs || {}) as Record<string, StoredSub>;
      return Object.entries(subs).map(async ([id, s]) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: payload.urgent ? 120 : 900, urgency: 'high', timeout: 6000 });
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await d.ref.update({ [`subs.${id}`]: FieldValue.delete() }).catch(() => {});
          }
        }
      });
    }));
  } catch (e) {
    console.warn('Push: no se pudo enviar', e);
  }
  return sent;
}

/** Conductores con avisos activados (opcionalmente solo de ciertos vehículos). */
export async function driverUids(vehicle?: string): Promise<string[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection('users').where('role', '==', 'DRIVER').limit(300).get();
  const ids = snap.docs
    .filter((d) => !vehicle || !d.data().vehicleType || d.data().vehicleType === vehicle)
    .map((d) => d.id);
  if (!ids.length) return [];
  const subs = await db.getAll(...ids.map((u) => db.collection('push_subscriptions').doc(u)));
  return subs.filter((s) => s.exists && Object.keys(s.data()?.subs || {}).length).map((s) => s.id).slice(0, 80);
}
