import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';
import { AD_PLANS, DELIVERY_CATEGORIES, MAX_PROMOS_PER_WEEK, activePlan, dayKey, type AdPlan, type ItemOption, type Restaurant } from '@/lib/delivery';
import { sendPush } from '@/lib/push';

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
  if (req.nextUrl.searchParams.get('stats')) {
    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 7));
    const since = Date.now() - days * 86400000;
    const [rs, st, ords, pays] = await Promise.all([
      db.collection('restaurants').get(),
      db.collection('restaurant_stats').where('day', '>=', dayKey(since)).get(),
      db.collection('delivery_orders').where('createdAtMs', '>=', since).get(),
      db.collection('plan_payments').where('createdAtMs', '>=', since).get(),
    ]);
    const rows = new Map<string, any>();
    for (const d of rs.docs) {
      const r = { id: d.id, ...d.data() } as Restaurant;
      rows.set(d.id, { id: d.id, name: r.name, plan: activePlan(r), planUntilMs: r.planUntilMs || 0, views: 0, clicks: 0, later: 0, pushes: 0, orders: 0, adOrders: 0, sales: 0, slots: {} as Record<string, { views?: number; clicks?: number }> });
    }
    for (const d of st.docs) {
      const s = d.data(); const row = rows.get(s.restaurantId);
      if (!row) continue;
      row.views += s.views || 0; row.clicks += s.clicks || 0; row.later += s.later || 0; row.pushes += s.pushes || 0;
      for (const [k, v] of Object.entries((s.slots || {}) as Record<string, any>)) {
        row.slots[k] = { views: (row.slots[k]?.views || 0) + (v.views || 0), clicks: (row.slots[k]?.clicks || 0) + (v.clicks || 0) };
      }
    }
    for (const d of ords.docs) {
      const o = d.data(); const row = rows.get(o.restaurantId);
      if (!row || o.status === 'CANCELLED') continue;
      row.orders += 1; row.sales += Number(o.subtotal) || 0; if (o.adRef) row.adOrders += 1;
    }
    const income = pays.docs.reduce((t, d) => t + (Number(d.data().amount) || 0), 0);
    return NextResponse.json({ ok: true, days, income, payments: pays.docs.length, rows: [...rows.values()] });
  }
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
        adHeadline: text(r.adHeadline, 70),
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
    case 'setPlan': {
      const id = text(b.id, 60);
      const plan = String(b.plan) as AdPlan;
      const weeks = Math.round(Number(b.weeks));
      if (!id || !(plan in AD_PLANS)) return bad('Elige el plan.');
      if (!(weeks >= 1 && weeks <= 12)) return bad('Elige cuántas semanas.');
      const ref = db.collection('restaurants').doc(id);
      const r = (await ref.get()).data() as Restaurant | undefined;
      if (!r) return bad('El restaurante no existe.');
      // Si ya tiene ese plan vigente, las semanas se suman al final; si no, empiezan hoy.
      const base = r.plan === plan && (r.planUntilMs || 0) > Date.now() ? r.planUntilMs! : Date.now();
      const until = base + weeks * 7 * 86400000;
      const amount = AD_PLANS[plan].weekly * weeks;
      await ref.update({ plan, planUntilMs: until });
      await db.collection('plan_payments').add({ restaurantId: id, restaurantName: r.name, plan, weeks, amount, createdAtMs: Date.now() });
      return NextResponse.json({ ok: true, until, amount });
    }
    case 'clearPlan': {
      const id = text(b.id, 60);
      if (!id) return bad('Falta el restaurante.');
      await db.collection('restaurants').doc(id).update({ plan: FieldValue.delete(), planUntilMs: FieldValue.delete() });
      return NextResponse.json({ ok: true });
    }
    case 'sendPromo': {
      // Aviso al celular de los clientes: solo para planes Premium, 1 por semana, máx. 3 avisos por persona cada 7 días.
      const id = text(b.id, 60);
      const ref = db.collection('restaurants').doc(id);
      const r = (await ref.get()).data() as (Restaurant & { lastPromoMs?: number }) | undefined;
      if (!r) return bad('El restaurante no existe.');
      if (activePlan(r) !== 'PREMIUM') return bad('Los avisos al celular son solo del plan Premium vigente.');
      if (Date.now() - (r.lastPromoMs || 0) < 6 * 86400000) return bad('Este restaurante ya usó su aviso de la semana.');
      const title = text(b.title, 60) || `¿Tienes hambre? 🍔`;
      const body = text(b.body, 120) || `Pide en ${r.name}${r.adHeadline ? `: ${r.adHeadline}` : ''}`;
      const week = Date.now() - 7 * 86400000;
      const users = await db.collection('users').where('role', '==', 'PASSENGER').limit(500).get();
      const subs = users.docs.length ? await db.getAll(...users.docs.map((u) => db.collection('push_subscriptions').doc(u.id))) : [];
      const targets = subs.filter((s) => s.exists && Object.keys(s.data()?.subs || {}).length && s.data()?.promos !== false
        && ((s.data()?.promoSent as number[] | undefined) || []).filter((t) => t > week).length < MAX_PROMOS_PER_WEEK);
      const sent = await sendPush(targets.map((s) => s.id), { title, body, url: `/?r=${encodeURIComponent(id)}`, tag: `promo-${id}` });
      const batch = db.batch();
      for (const s of targets) batch.set(s.ref, { promoSent: [...((s.data()?.promoSent as number[] | undefined) || []).filter((t) => t > week), Date.now()] }, { merge: true });
      batch.update(ref, { lastPromoMs: Date.now() });
      batch.set(db.collection('restaurant_stats').doc(`${id}_${dayKey()}`), { restaurantId: id, day: dayKey(), pushes: FieldValue.increment(targets.length) }, { merge: true });
      await batch.commit();
      return NextResponse.json({ ok: true, sent, people: targets.length });
    }
    default:
      return bad('Acción inválida.');
  }
}
