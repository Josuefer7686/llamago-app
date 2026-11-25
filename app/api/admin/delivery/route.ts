import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';
import { DELIVERY_CATEGORIES, type ItemOption } from '@/lib/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const money = (v: unknown, max = 5000) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : NaN; };
/** Foto: enlace https o imagen reducida en el navegador (máx. ~250 KB). */
const photo = (v: unknown) => {
  const s = String(v ?? '');
  if (!s) return '';
  if (s.startsWith('https://') && s.length < 600) return s;
  if (/^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length < 340_000) return s;
  return null;
};
const options = (v: unknown): ItemOption[] =>
  (Array.isArray(v) ? v : []).slice(0, 12).map((o: any, i) => ({ id: text(o?.id, 24) || `o${i + 1}`, name: text(o?.name, 40), extra: money(o?.extra, 500) || 0 })).filter((o) => o.name);

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false, error: 'Firebase Admin sin configurar' }, { status: 503 });
  const restaurantId = String(req.nextUrl.searchParams.get('restaurantId') || '');
  if (restaurantId) {
    const snap = await db.collection('menu_items').where('restaurantId', '==', restaurantId).get();
    return NextResponse.json({ ok: true, items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  }
  const [rs, orders] = await Promise.all([db.collection('restaurants').get(), db.collection('delivery_orders').get()]);
  const active = orders.docs.map((d) => d.data()).filter((o) => ['PLACED', 'ACCEPTED', 'PICKED_UP'].includes(o.status));
  return NextResponse.json({
    ok: true,
    restaurants: rs.docs.map((d) => ({ id: d.id, ...d.data() })),
    activeOrders: active.map((o) => ({ id: o.id, restaurantName: o.restaurantName, customerName: o.customerName, status: o.status, total: o.total, createdAtMs: o.createdAtMs, driverName: o.driverName || '' })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false, error: 'Firebase Admin sin configurar' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

  switch (b.action) {
    case 'saveRestaurant': {
      const r = b.restaurant || {};
      const name = text(r.name, 60);
      const lat = Number(r.lat), lng = Number(r.lng);
      const cover = photo(r.coverUrl);
      if (name.length < 2) return bad('Escribe el nombre del negocio.');
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) return bad('Falta la ubicación (latitud y longitud).');
      if (cover === null) return bad('La foto de portada no es válida o pesa demasiado.');
      const kind = r.kind === 'STORE' ? 'STORE' : 'RESTAURANT';
      const category = kind === 'STORE' ? 'Tienda' : (DELIVERY_CATEGORIES as readonly string[]).includes(r.category) && r.category !== 'Todos' ? r.category : 'Almuerzos';
      const minOrder = r.minOrder === '' || r.minOrder == null ? 0 : money(r.minOrder, 500);
      const prep = Math.round(Number(r.prepMinutes));
      if (Number.isNaN(minOrder)) return bad('El pedido mínimo no es válido.');
      const data = {
        name, kind, description: text(r.description, 160), category, coverUrl: cover, address: text(r.address, 120),
        lat, lng, phone: text(r.phone, 20), hours: text(r.hours, 40),
        open: !!r.open, active: r.active !== false,
        prepMinutes: prep >= 5 && prep <= 90 ? prep : 20, minOrder,
        rating: Number(r.rating) >= 1 && Number(r.rating) <= 5 ? Math.round(Number(r.rating) * 10) / 10 : 0,
        demo: !!r.demo,
      };
      const id = text(r.id, 60) || `rest-${Date.now().toString(36)}`;
      await db.collection('restaurants').doc(id).set(data, { merge: true });
      return NextResponse.json({ ok: true, id });
    }
    case 'setOpen': {
      const id = text(b.id, 60);
      if (!id) return bad('Falta el restaurante.');
      await db.collection('restaurants').doc(id).update({ open: !!b.open });
      return NextResponse.json({ ok: true });
    }
    case 'deleteRestaurant': {
      const id = text(b.id, 60);
      if (!id) return bad('Falta el restaurante.');
      const items = await db.collection('menu_items').where('restaurantId', '==', id).get();
      const batch = db.batch();
      items.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(db.collection('restaurants').doc(id));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }
    case 'saveItem': {
      const i = b.item || {};
      const restaurantId = text(i.restaurantId, 60);
      const name = text(i.name, 60);
      const price = money(i.price);
      const ph = photo(i.photo);
      if (!restaurantId || !(await db.collection('restaurants').doc(restaurantId).get()).exists) return bad('El restaurante no existe.');
      if (name.length < 2) return bad('Escribe el nombre del plato.');
      if (Number.isNaN(price) || price <= 0) return bad('El precio no es válido.');
      if (ph === null) return bad('La foto no es válida o pesa demasiado.');
      const data = {
        restaurantId, name, description: text(i.description, 140), price, photo: ph,
        category: text(i.category, 30) || 'Menú', available: i.available !== false,
        sizes: options(i.sizes), extras: options(i.extras), sauces: options(i.sauces),
      };
      const id = text(i.id, 60) || `item-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      await db.collection('menu_items').doc(id).set(data);
      return NextResponse.json({ ok: true, id });
    }
    case 'setAvailable': {
      const id = text(b.id, 60);
      if (!id) return bad('Falta el plato.');
      await db.collection('menu_items').doc(id).update({ available: !!b.available });
      return NextResponse.json({ ok: true });
    }
    case 'deleteItem': {
      const id = text(b.id, 60);
      if (!id) return bad('Falta el plato.');
      await db.collection('menu_items').doc(id).delete();
      return NextResponse.json({ ok: true });
    }
    case 'cancelOrder': {
      const id = text(b.id, 80);
      const ref = db.collection('delivery_orders').doc(id);
      const o = (await ref.get()).data();
      if (!o || !['PLACED', 'ACCEPTED', 'PICKED_UP'].includes(o.status)) return bad('Ese pedido ya terminó.');
      await ref.update({ status: 'CANCELLED', cancelledAtMs: Date.now(), cancelReason: text(b.reason, 100) || 'Cancelado por el administrador' });
      await db.collection('delivery_open').doc(id).delete();
      if (o.promo && o.customerId) await db.collection('delivery_promos').doc(o.customerId).set({ used: FieldValue.increment(-1) }, { merge: true });
      return NextResponse.json({ ok: true });
    }
    default:
      return bad('Acción inválida.');
  }
}
