import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyCaller } from '@/lib/safety';
import { AD_SLOTS, activePlan, dayKey, type Restaurant } from '@/lib/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cuenta cuántas veces se vio / tocó el anuncio de un restaurante pagante. Sin esto no habría pruebas para el restaurante. */
export async function POST(req: NextRequest) {
  const uid = await verifyCaller(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const event = b.event === 'view' ? 'views' : b.event === 'click' ? 'clicks' : b.event === 'later' ? 'later' : '';
  const slot = String(b.slot || '');
  const rid = String(b.restaurantId || '').slice(0, 80);
  if (!event || !rid || !(AD_SLOTS as readonly string[]).includes(slot)) return NextResponse.json({ ok: false }, { status: 400 });
  const snap = await db.collection('restaurants').doc(rid).get();
  if (!snap.exists || !activePlan(snap.data() as Restaurant)) return NextResponse.json({ ok: true, skipped: true });
  const day = dayKey();
  await db.collection('restaurant_stats').doc(`${rid}_${day}`).set(
    { restaurantId: rid, day, [event]: FieldValue.increment(1), slots: { [slot]: { [event]: FieldValue.increment(1) } } },
    { merge: true },
  );
  return NextResponse.json({ ok: true });
}
