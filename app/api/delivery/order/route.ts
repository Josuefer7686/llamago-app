import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyCaller } from '@/lib/safety';
import {
  acceptOrder, cancelOrder, createOrder, deliverOrder, pickupOrder, promoLeft, releaseOrder, tipOrder, updateDriverLocation,
} from '@/lib/deliveryServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Todas las acciones del pedido pasan por aquí: el servidor valida, calcula precios y cambia el estado. */
export async function POST(req: NextRequest) {
  const uid = await verifyCaller(req);
  if (!uid) return NextResponse.json({ ok: false, error: 'Inicia sesión de nuevo.' }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false, error: 'Servicio no disponible.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || '').slice(0, 80);

  if (body.action === 'promo') return NextResponse.json({ ok: true, left: await promoLeft(db, uid) });

  let res: { ok: boolean; error?: string; id?: string };
  switch (body.action) {
    case 'create': res = await createOrder(db, uid, body); break;
    case 'accept': res = await acceptOrder(db, uid, orderId); break;
    case 'release': res = await releaseOrder(db, uid, orderId); break;
    case 'pickup': res = await pickupOrder(db, uid, orderId); break;
    case 'deliver': res = await deliverOrder(db, uid, orderId); break;
    case 'tip': res = await tipOrder(db, uid, orderId, Number(body.amount)); break;
    case 'cancel': res = await cancelOrder(db, uid, orderId, String(body.reason || '')); break;
    case 'location': res = await updateDriverLocation(db, uid, orderId, Number(body.lat), Number(body.lng)); break;
    default: res = { ok: false, error: 'Acción inválida.' };
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
