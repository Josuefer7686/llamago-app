import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyCaller } from '@/lib/safety';
import { subId } from '@/lib/push';

export const runtime = 'nodejs';

/** Guarda (o borra) el aviso push de este teléfono para el usuario que llama. */
export async function POST(req: NextRequest) {
  const uid = await verifyCaller(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const s = body?.subscription;
  const endpoint = String(s?.endpoint || '');
  const p256dh = String(s?.keys?.p256dh || ''), auth = String(s?.keys?.auth || '');
  if (!endpoint.startsWith('https://') || endpoint.length > 600 || !p256dh || !auth) return NextResponse.json({ ok: false }, { status: 400 });
  const id = subId(endpoint);
  const ref = db.collection('push_subscriptions').doc(uid);
  if (body.action === 'unsubscribe') {
    await ref.set({ subs: { [id]: FieldValue.delete() } }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  // Un mismo teléfono no puede quedar registrado en dos cuentas
  const other = await db.collection('push_subscriptions').where(`subs.${id}.endpoint`, '==', endpoint).limit(5).get();
  await Promise.all(other.docs.filter((d) => d.id !== uid).map((d) => d.ref.update({ [`subs.${id}`]: FieldValue.delete() })));
  await ref.set({ subs: { [id]: { endpoint, keys: { p256dh, auth }, at: Date.now() } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}
