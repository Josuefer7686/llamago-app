import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { notifyAdmin } from '@/lib/safety';
import {
  ACTIVE_STATUSES, COMMISSION_BS, MAX_ITEM_QTY, MAX_NOTE, bs, deliveryFeeFor, roadKm, unitPriceFor,
  type DeliveryOrder, type MenuItem, type OpenOrder, type Restaurant,
} from '@/lib/delivery';

type Res = { ok: boolean; error?: string; id?: string };
const fail = (error: string): Res => ({ ok: false, error });
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Pedidos que aún no terminan de una persona (cliente o repartidor). */
async function activeOrdersOf(db: Firestore, field: 'customerId' | 'driverId', uid: string) {
  const snap = await db.collection('delivery_orders').where(field, '==', uid).get();
  return snap.docs.filter((d) => ACTIVE_STATUSES.includes(d.data().status));
}

/** Crea el pedido. Los precios salen SIEMPRE de la base de datos, nunca del teléfono. */
export async function createOrder(db: Firestore, uid: string, body: any): Promise<Res> {
  const user = (await db.collection('users').doc(uid).get()).data();
  if (!user) return fail('Tu cuenta no está lista. Vuelve a iniciar sesión.');
  if (user.role === 'DRIVER') return fail('Los conductores no piden delivery con esta cuenta.');

  if ((await activeOrdersOf(db, 'customerId', uid)).length) return fail('Ya tienes un pedido en curso. Espera a que termine.');

  const rSnap = await db.collection('restaurants').doc(clean(body.restaurantId, 80)).get();
  const rest = rSnap.exists ? ({ id: rSnap.id, ...rSnap.data() } as Restaurant) : null;
  if (!rest || !rest.active) return fail('Ese restaurante ya no está disponible.');
  if (!rest.open) return fail('El restaurante está cerrado ahora.');

  const lines: any[] = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!lines.length) return fail('Tu carrito está vacío.');

  const refs = [...new Set(lines.map((l) => clean(l.itemId, 80)))].map((id) => db.collection('menu_items').doc(id));
  const docs = await db.getAll(...refs);
  const menu = new Map<string, MenuItem>();
  for (const d of docs) if (d.exists) menu.set(d.id, { id: d.id, ...d.data() } as MenuItem);

  const items: DeliveryOrder['items'] = [];
  let subtotal = 0;
  for (const l of lines) {
    const item = menu.get(clean(l.itemId, 80));
    if (!item || item.restaurantId !== rest.id) return fail('Un producto del carrito ya no existe.');
    if (!item.available) return fail(`"${item.name}" se agotó. Quítalo del carrito.`);
    const qty = Math.floor(num(l.qty));
    if (!(qty >= 1 && qty <= MAX_ITEM_QTY)) return fail('Cantidad inválida.');
    if (item.sizes?.length && !item.sizes.some((s) => s.id === l.sizeId)) return fail(`Elige el tamaño de "${item.name}".`);
    const ids = (a: unknown) => (Array.isArray(a) ? a.map((x) => clean(x, 40)).slice(0, 20) : []);
    const price = unitPriceFor(item, l.sizeId ? clean(l.sizeId, 40) : undefined, ids(l.extraIds), ids(l.sauceIds));
    items.push({ itemId: item.id, name: item.name, qty, unitPrice: price.unit, optionsLabel: price.label, notes: clean(l.notes, MAX_NOTE) });
    subtotal += price.unit * qty;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  if (rest.minOrder && subtotal < rest.minOrder) return fail(`El pedido mínimo es ${bs(rest.minOrder)}.`);

  const a = body.address || {};
  const lat = num(a.lat), lng = num(a.lng);
  const text = clean(a.text, 160);
  if (text.length < 3) return fail('Escribe tu dirección de entrega.');
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return fail('No pudimos ubicar tu dirección. Activa tu ubicación.');
  const km = roadKm({ lat: rest.lat, lng: rest.lng }, { lat, lng });
  if (km > 12) return fail('Tu dirección está muy lejos de este restaurante.');
  const fee = deliveryFeeFor(km);
  const payment = body.paymentMethod === 'QR' ? 'QR' : 'CASH';

  const id = `del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const order: DeliveryOrder = {
    id, customerId: uid, customerName: clean(user.name, 80) || 'Cliente',
    customerPhone: clean(user.phone, 30),
    restaurantId: rest.id, restaurantName: rest.name, restaurantAddress: rest.address,
    restaurantPhone: rest.phone || '', restaurantLoc: { lat: rest.lat, lng: rest.lng },
    items, subtotal, deliveryFee: fee, total: Math.round((subtotal + fee) * 100) / 100, distanceKm: km,
    address: { text, reference: clean(a.reference, 120), lat, lng },
    paymentMethod: payment, note: clean(body.note, MAX_NOTE),
    status: 'PLACED', createdAtMs: Date.now(),
  };
  const open: OpenOrder = {
    id, restaurantName: rest.name, restaurantAddress: rest.address, restaurantLoc: order.restaurantLoc,
    addressText: text, destLoc: { lat: round3(lat), lng: round3(lng) },
    itemsCount: items.reduce((t, i) => t + i.qty, 0),
    itemsSummary: items.slice(0, 4).map((i) => `${i.qty}× ${i.name}`).join(', ') + (items.length > 4 ? '…' : ''),
    deliveryFee: fee, total: order.total, paymentMethod: payment, distanceKm: km, createdAtMs: order.createdAtMs,
  };
  const batch = db.batch();
  batch.set(db.collection('delivery_orders').doc(id), order);
  batch.set(db.collection('delivery_open').doc(id), open);
  await batch.commit();

  void notifyAdmin(`🍔 Nuevo pedido de delivery\n${rest.name}\n${order.customerName} · ${bs(order.total)} (${payment === 'QR' ? 'QR' : 'efectivo'})\n${text}`);
  return { ok: true, id };
}

async function driverCheck(db: Firestore, uid: string): Promise<Res | null> {
  const user = (await db.collection('users').doc(uid).get()).data();
  if (!user || user.role !== 'DRIVER') return fail('Solo los conductores pueden hacer esto.');
  const ver = (await db.collection('driver_verifications').doc(uid).get()).data();
  if (ver?.status !== 'APPROVED') return fail('Tu verificación de conductor aún no está aprobada.');
  return null;
}

export async function acceptOrder(db: Firestore, uid: string, orderId: string): Promise<Res> {
  const bad = await driverCheck(db, uid);
  if (bad) return bad;
  if ((await activeOrdersOf(db, 'driverId', uid)).length) return fail('Termina tu pedido actual antes de tomar otro.');
  const user = (await db.collection('users').doc(uid).get()).data() || {};
  const ref = db.collection('delivery_orders').doc(orderId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const o = snap.data();
      if (!o || o.status !== 'PLACED') throw new Error('Otro repartidor ya tomó este pedido.');
      tx.update(ref, {
        status: 'ACCEPTED', driverId: uid, driverName: clean(user.name, 80) || 'Repartidor',
        driverPhone: clean(user.phone, 30), driverVehicle: clean(user.motorcycle || user.vehicleType, 60),
        acceptedAtMs: Date.now(),
      });
      tx.delete(db.collection('delivery_open').doc(orderId));
    });
  } catch (e: any) {
    return fail(e?.message || 'No se pudo tomar el pedido.');
  }
  return { ok: true };
}

/** El repartidor suelta el pedido (antes de recogerlo): vuelve a buscarse otro. */
export async function releaseOrder(db: Firestore, uid: string, orderId: string): Promise<Res> {
  const ref = db.collection('delivery_orders').doc(orderId);
  try {
    await db.runTransaction(async (tx) => {
      const o = (await tx.get(ref)).data() as DeliveryOrder | undefined;
      if (!o || o.driverId !== uid || o.status !== 'ACCEPTED') throw new Error('No puedes soltar este pedido.');
      tx.update(ref, {
        status: 'PLACED', driverId: FieldValue.delete(), driverName: FieldValue.delete(), driverPhone: FieldValue.delete(),
        driverVehicle: FieldValue.delete(), driverLoc: FieldValue.delete(), acceptedAtMs: FieldValue.delete(),
      });
      tx.set(db.collection('delivery_open').doc(orderId), {
        id: orderId, restaurantName: o.restaurantName, restaurantAddress: o.restaurantAddress, restaurantLoc: o.restaurantLoc,
        addressText: o.address.text, destLoc: { lat: round3(o.address.lat), lng: round3(o.address.lng) },
        itemsCount: o.items.reduce((t, i) => t + i.qty, 0),
        itemsSummary: o.items.slice(0, 4).map((i) => `${i.qty}× ${i.name}`).join(', '),
        deliveryFee: o.deliveryFee, total: o.total, paymentMethod: o.paymentMethod, distanceKm: o.distanceKm, createdAtMs: Date.now(),
      } satisfies OpenOrder);
    });
  } catch (e: any) {
    return fail(e?.message || 'No se pudo soltar el pedido.');
  }
  return { ok: true };
}

export async function pickupOrder(db: Firestore, uid: string, orderId: string): Promise<Res> {
  const ref = db.collection('delivery_orders').doc(orderId);
  try {
    await db.runTransaction(async (tx) => {
      const o = (await tx.get(ref)).data();
      if (!o || o.driverId !== uid || o.status !== 'ACCEPTED') throw new Error('Este pedido no está listo para recoger.');
      tx.update(ref, { status: 'PICKED_UP', pickedUpAtMs: Date.now() });
    });
  } catch (e: any) {
    return fail(e?.message || 'No se pudo actualizar.');
  }
  return { ok: true };
}

/** Bolivia no usa horario de verano: UTC-4. */
const boliviaNow = () => new Date(Date.now() - 4 * 3600 * 1000);

export async function deliverOrder(db: Firestore, uid: string, orderId: string): Promise<Res> {
  const ref = db.collection('delivery_orders').doc(orderId);
  const userRef = db.collection('users').doc(uid);
  const boxRef = db.collection('driver_boxes').doc(uid);
  try {
    await db.runTransaction(async (tx) => {
      const o = (await tx.get(ref)).data() as DeliveryOrder | undefined;
      if (!o || o.driverId !== uid || o.status !== 'PICKED_UP') throw new Error('Primero marca que recogiste el pedido.');
      const user = (await tx.get(userRef)).data() || {};
      const box = (await tx.get(boxRef)).data() || {};

      const free = Number(user.freeTripsRemaining || 0);
      const balance = Number(user.walletBalance || 0);
      if (free > 0) tx.update(userRef, { freeTripsRemaining: free - 1 });
      else tx.update(userRef, { walletBalance: Math.max(0, Math.round((balance - COMMISSION_BS) * 100) / 100) });

      const now = boliviaNow();
      const today = now.toISOString().slice(0, 10);
      const time = now.toISOString().slice(11, 16);
      const sameDay = box.todayDate === today;
      const trip = { id: o.id, date: 'Hoy', time, pickup: o.restaurantName, destination: o.address.text, price: o.deliveryFee, passengerName: o.customerName, delivery: true };
      tx.set(boxRef, {
        driverId: uid,
        totalIncome: Number(box.totalIncome || 0) + o.deliveryFee,
        todayIncome: (sameDay ? Number(box.todayIncome || 0) : 0) + o.deliveryFee,
        todayDate: today,
        totalTrips: Number(box.totalTrips || 0) + 1,
        trips: [trip, ...((box.trips as any[]) || [])].slice(0, 50),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.update(ref, { status: 'DELIVERED', deliveredAtMs: Date.now() });
    });
  } catch (e: any) {
    return fail(e?.message || 'No se pudo cerrar el pedido.');
  }
  return { ok: true };
}

export async function cancelOrder(db: Firestore, uid: string, orderId: string, reason: string): Promise<Res> {
  const ref = db.collection('delivery_orders').doc(orderId);
  try {
    await db.runTransaction(async (tx) => {
      const o = (await tx.get(ref)).data() as DeliveryOrder | undefined;
      if (!o || o.customerId !== uid) throw new Error('Pedido no encontrado.');
      if (o.status === 'PICKED_UP') throw new Error('Tu pedido ya va en camino y no se puede cancelar.');
      if (o.status !== 'PLACED' && o.status !== 'ACCEPTED') throw new Error('Este pedido ya terminó.');
      tx.update(ref, { status: 'CANCELLED', cancelledAtMs: Date.now(), cancelReason: clean(reason, 100) || 'Cancelado por el cliente' });
      tx.delete(db.collection('delivery_open').doc(orderId));
    });
  } catch (e: any) {
    return fail(e?.message || 'No se pudo cancelar.');
  }
  return { ok: true };
}

export async function updateDriverLocation(db: Firestore, uid: string, orderId: string, lat: number, lng: number): Promise<Res> {
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return fail('Ubicación inválida.');
  const ref = db.collection('delivery_orders').doc(orderId);
  const o = (await ref.get()).data();
  if (!o || o.driverId !== uid || !['ACCEPTED', 'PICKED_UP'].includes(o.status)) return fail('Sin pedido activo.');
  await ref.update({ driverLoc: { lat, lng, at: Date.now() } });
  return { ok: true };
}
