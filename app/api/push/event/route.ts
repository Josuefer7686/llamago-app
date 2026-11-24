import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyCaller } from '@/lib/safety';
import { driverUids, sendPush } from '@/lib/push';

export const runtime = 'nodejs';

const TXT: Record<string, (r: any) => { title: string; body: string }> = {
  GOING_TO_PASSENGER: (r) => ({ title: '¡Conductor en camino! 🛵', body: `${r.driverName || 'Tu conductor'} aceptó tu viaje y va a buscarte.` }),
  TRIP_STARTED: () => ({ title: 'Viaje en curso', body: 'Tu viaje comenzó. ¡Buen camino!' }),
  COMPLETED: () => ({ title: 'Llegaste a tu destino ✅', body: 'Gracias por viajar con LlamaGO. ¿Cómo estuvo tu viaje?' }),
};

const snippet = (t: unknown) => String(t || '').replace(/\s+/g, ' ').slice(0, 110);

/**
 * El cliente avisa "pasó algo en mi viaje". El servidor NO confía en lo que diga: lee el viaje/mensaje real,
 * comprueba que quien llama participa y decide a quién avisar y qué decir (una sola vez por cambio).
 */
export async function POST(req: NextRequest) {
  const uid = await verifyCaller(req);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const event = String(body?.event || '');
  const id = String(body?.id || '').slice(0, 120);
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    if (event === 'ride_chat' || event === 'ride_new' || event === 'ride_update') {
      const ref = db.collection('rides').doc(id);
      const ride = (await ref.get()).data();
      if (!ride) return NextResponse.json({ ok: false }, { status: 404 });
      const isPassenger = ride.passengerId === uid, isDriver = ride.driverId === uid;
      if (!isPassenger && !isDriver) return NextResponse.json({ ok: false }, { status: 403 });

      if (event === 'ride_new') {
        if (!isPassenger || ride.status !== 'SEARCHING_DRIVER' || ride.pushNew) return NextResponse.json({ ok: true, skipped: true });
        await ref.update({ pushNew: true });
        const vehicle = ride.serviceType === 'REMOLCADA' ? 'MOTOTAXI' : ride.serviceType;
        const drivers = (await driverUids(vehicle)).filter((d) => d !== uid);
        const dest = ride.destination?.name ? ` → ${snippet(ride.destination.name)}` : '';
        const sent = await sendPush(drivers, { title: '🛵 Nuevo viaje cerca', body: `Bs ${ride.price}${dest}`, tag: `ride-${id}`, urgent: true });
        return NextResponse.json({ ok: true, sent });
      }

      if (event === 'ride_update') {
        const status = String(ride.status);
        if (ride.lastPushStatus === status) return NextResponse.json({ ok: true, skipped: true });
        let target = '', msg: { title: string; body: string } | null = null;
        if (status === 'CANCELLED') {
          if (isPassenger && ride.driverId) { target = ride.driverId; msg = { title: 'Viaje cancelado', body: 'El pasajero canceló el viaje.' }; }
          else if (isDriver) { target = ride.passengerId; msg = { title: 'Viaje cancelado', body: 'El conductor canceló el viaje.' }; }
        } else if (TXT[status] && isDriver) {
          target = ride.passengerId; msg = TXT[status](ride);
        }
        if (!target || !msg) return NextResponse.json({ ok: true, skipped: true });
        await ref.update({ lastPushStatus: status });
        const sent = await sendPush([target], { ...msg, tag: `ride-${id}`, urgent: true });
        return NextResponse.json({ ok: true, sent });
      }

      // ride_chat
      const mid = String(body?.messageId || '').slice(0, 120);
      let m = mid ? (await ref.collection('messages').doc(mid).get()).data() : null;
      if (!m && mid) { await new Promise((r) => setTimeout(r, 900)); m = (await ref.collection('messages').doc(mid).get()).data(); }
      if (!m || (m.sender === 'DRIVER') !== isDriver) return NextResponse.json({ ok: false }, { status: 403 });
      const target = isDriver ? ride.passengerId : ride.driverId;
      const name = isDriver ? (ride.driverName || 'Tu conductor') : (ride.passengerName || 'Tu pasajero');
      const sent = await sendPush([target], { title: name, body: snippet(m.text), tag: `chat-${id}`, urgent: true });
      return NextResponse.json({ ok: true, sent });
    }

    if (event === 'delivery_chat') {
      const ref = db.collection('delivery_orders').doc(id);
      const o = (await ref.get()).data();
      if (!o || (o.customerId !== uid && o.driverId !== uid)) return NextResponse.json({ ok: false }, { status: 403 });
      const mid = String(body?.messageId || '').slice(0, 120);
      const m = mid ? (await ref.collection('messages').doc(mid).get()).data() : null;
      if (!m || m.senderId !== uid) return NextResponse.json({ ok: false }, { status: 403 });
      const toCustomer = o.driverId === uid;
      const sent = await sendPush([toCustomer ? o.customerId : o.driverId], {
        title: toCustomer ? (o.driverName || 'Tu repartidor') : (o.customerName || 'Tu cliente'), body: snippet(m.text), tag: `dchat-${id}`, urgent: true,
      });
      return NextResponse.json({ ok: true, sent });
    }
  } catch (e) {
    console.warn('push/event', e);
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
