'use client';

import { useEffect, useRef, useState } from 'react';
import { Banknote, Bike, MapPin, MessageCircle, Navigation, PackageCheck, Phone, Store, Wallet } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { deliveryApi, deliveryService } from '@/services/deliveryService';
import { useDeliveryAlerts } from '@/hooks/useDeliveryAlerts';
import { STATUS_LABEL, bs, distanceKm, fmtKm, roadKm, type DeliveryOrder, type OpenOrder } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { GoldButton, Skeleton, StatusPill, motion, useStagger } from './ui';
import { DeliveryChat } from './DeliveryChat';
import { DeliveryMapView } from './DeliveryMapView';

const navLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

function OpenCard({ o, i, here, onTake, busy }: { o: OpenOrder; i: number; here: { lat: number; lng: number } | null; onTake: () => void; busy: boolean }) {
  const stagger = useStagger();
  const toRest = here ? roadKm(here, o.restaurantLoc) : null;
  return (
    <motion.li {...stagger(i)} className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary"><Store className="h-3.5 w-3.5" aria-hidden /> Recoges en</p>
            <p className="truncate font-display text-lg font-extrabold">{o.restaurantName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-extrabold tabular-nums text-gold-primary">{bs(o.deliveryFee)}</p>
            <p className="text-[11px] font-semibold text-text-secondary">tu ganancia</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-primary" aria-hidden /><span className="line-clamp-2">{o.addressText}</span></p>
          <p className="line-clamp-1 pl-6 text-xs text-text-secondary">{o.itemsSummary}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-text-secondary">
          <span>{fmtKm(o.distanceKm)} de entrega</span>
          {toRest != null && <span>· {fmtKm(toRest)} hasta el local</span>}
          <span className="flex items-center gap-1"><Banknote className="h-3.5 w-3.5" aria-hidden /> Cobras {bs(o.total)} en efectivo</span>
        </div>
      </div>
      <div className="border-t border-white/10 p-3"><GoldButton onClick={onTake} loading={busy}>Tomar pedido</GoldButton></div>
    </motion.li>
  );
}

function ActiveOrder({ o }: { o: DeliveryOrder }) {
  const here = useAppStore((s) => s.currentLocation);
  const hereRef = useRef(here);
  useEffect(() => { hereRef.current = here; }, [here]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState(false);
  const going = o.status === 'ACCEPTED';

  // Mientras lleva el pedido, el cliente ve en el mapa dónde va (cada 10 s).
  useEffect(() => {
    const send = () => { const h = hereRef.current; if (h) void deliveryApi('location', { orderId: o.id, lat: h.lat, lng: h.lng }); };
    send();
    const t = window.setInterval(send, 10000);
    return () => window.clearInterval(t);
  }, [o.id]);

  const act = async (action: 'pickup' | 'deliver' | 'release') => {
    setBusy(true); setError('');
    const r = await deliveryApi(action, { orderId: o.id });
    setBusy(false);
    if (!r.ok) { haptics.error(); setError(r.error || 'No se pudo actualizar.'); return; }
    haptics.success();
  };

  const target = going ? o.restaurantLoc : { lat: o.address.lat, lng: o.address.lng };
  const toTarget = here ? roadKm(here, target) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[34%] min-h-[180px] shrink-0">
        <DeliveryMapView restaurant={o.restaurantLoc} home={{ lat: o.address.lat, lng: o.address.lng }} driver={here} />
      </div>
      <div className="relative -mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[32px] border-t border-white/10 bg-background px-4 pb-6 pt-5">
        <div className="mx-auto max-w-[430px] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[26px] font-extrabold italic leading-tight">{going ? 'Ve al restaurante' : 'Entrega el pedido'}</h1>
              <p className="mt-1 text-sm text-text-secondary">{toTarget != null ? `A ${fmtKm(toTarget)} de ti` : STATUS_LABEL[o.status]}</p>
            </div>
            <StatusPill tone="gold">Tú ganas {bs(o.deliveryFee)}</StatusPill>
          </div>

          <section className="space-y-3 rounded-3xl border border-white/10 bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${going ? 'bg-gold-primary text-background' : 'bg-white/10'}`}><Store className="h-[18px] w-[18px]" aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="font-bold">{o.restaurantName}</p><p className="text-sm text-text-secondary">{o.restaurantAddress}</p></div>
              {o.restaurantPhone && <a href={`tel:${o.restaurantPhone}`} aria-label="Llamar al restaurante" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] touch-manipulation active:scale-95"><Phone className="h-[18px] w-[18px]" aria-hidden /></a>}
            </div>
            <div className="ml-[18px] h-4 w-px bg-white/15" aria-hidden />
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${!going ? 'bg-gold-primary text-background' : 'bg-white/10'}`}><MapPin className="h-[18px] w-[18px]" aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="font-bold">{o.customerName}</p><p className="text-sm text-text-secondary">{o.address.text}</p>{o.address.reference && <p className="text-xs text-gold-primary">{o.address.reference}</p>}</div>
              <a href={`tel:${o.customerPhone}`} aria-label="Llamar al cliente" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] touch-manipulation active:scale-95"><Phone className="h-[18px] w-[18px]" aria-hidden /></a>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-surface p-4 text-sm">
            <p className="mb-2 font-display text-base font-extrabold">Pedido</p>
            <ul className="space-y-1.5">
              {o.items.map((i, k) => (
                <li key={k}><span className="font-semibold">{i.qty}× {i.name}</span>{i.optionsLabel && <span className="block text-xs text-text-secondary">{i.optionsLabel}</span>}{i.notes && <span className="block text-xs text-gold-primary">“{i.notes}”</span>}</li>
              ))}
            </ul>
            {o.note && <p className="mt-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-text-secondary">Nota del cliente: {o.note}</p>}
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-display text-lg font-extrabold"><span className="flex items-center gap-2"><Wallet className="h-5 w-5 text-gold-primary" aria-hidden /> Cobrar al entregar</span><span className="tabular-nums text-gold-primary">{bs(o.total)}</span></div>
            <p className="mt-1 text-xs text-text-secondary">Pagas el pedido en el local con tu dinero y cobras el total al cliente: tu ganancia es el envío ({bs(o.deliveryFee)}).</p>
          </section>

          {error && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <a href={navLink(target.lat, target.lng)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.08] font-bold touch-manipulation active:scale-[0.98]"><Navigation className="h-[18px] w-[18px]" aria-hidden /> Abrir en Maps</a>
            <button type="button" onClick={() => { haptics.selection(); setChat(true); }} aria-label="Chat con el cliente" className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.08] touch-manipulation active:scale-95"><MessageCircle className="h-5 w-5" aria-hidden /></button>
          </div>

          {going ? (
            <>
              <GoldButton onClick={() => act('pickup')} loading={busy}><PackageCheck className="h-5 w-5" aria-hidden /> Ya recogí el pedido</GoldButton>
              <button type="button" onClick={() => { if (window.confirm('¿Soltar este pedido? Otro repartidor lo tomará.')) void act('release'); }} disabled={busy} className="min-h-11 w-full text-sm font-bold text-red-300 touch-manipulation">Soltar pedido</button>
            </>
          ) : (
            <GoldButton onClick={() => { if (window.confirm(`¿Entregaste el pedido y cobraste ${bs(o.total)}?`)) void act('deliver'); }} loading={busy}><PackageCheck className="h-5 w-5" aria-hidden /> Entregué el pedido</GoldButton>
          )}
        </div>
      </div>
      <DeliveryChat orderId={o.id} as="DRIVER" otherName={o.customerName} open={chat} onClose={() => setChat(false)} />
    </div>
  );
}

/** Pestaña "Pedidos" del conductor: lista de delivery por tomar y el pedido que lleva. */
export function DriverDelivery() {
  const here = useAppStore((s) => s.currentLocation);
  const { active } = useDeliveryAlerts();
  const [open, setOpen] = useState<OpenOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => deliveryService.subscribeOpenOrders(setOpen, () => setFailed(true)), []);

  if (active && (active.status === 'ACCEPTED' || active.status === 'PICKED_UP')) return <ActiveOrder o={active} />;

  const take = async (id: string) => {
    setBusyId(id); setError('');
    const r = await deliveryApi('accept', { orderId: id });
    setBusyId('');
    if (!r.ok) { haptics.error(); setError(r.error || 'No se pudo tomar el pedido.'); return; }
    haptics.success();
  };

  const sorted = [...(open || [])].sort((a, b) => (here ? distanceKm(here, a.restaurantLoc) - distanceKm(here, b.restaurantLoc) : a.createdAtMs - b.createdAtMs));

  return (
    <div className="h-full overflow-y-auto overscroll-contain pb-8">
      <header className="px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-[430px]">
          <h1 className="font-display text-[28px] font-extrabold italic leading-tight tracking-tight">Pedidos de <span className="text-gold-primary">delivery</span></h1>
          <p className="mt-1 text-sm text-text-secondary">Recoge comida y entrégala. Ganas el costo de envío de cada pedido.</p>
        </div>
      </header>
      <div className="mx-auto max-w-[430px] space-y-4 px-4">
        {error && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {open === null && !failed && <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <Skeleton key={i} className="h-48" />)}</div>}
        {failed && <p className="rounded-2xl bg-surface p-5 text-center text-sm text-text-secondary">No pudimos cargar los pedidos. Revisa tu conexión.</p>}
        {open && !sorted.length && (
          <div className="rounded-3xl bg-surface p-8 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-gold-primary/15 text-gold-primary"><Bike className="h-7 w-7" aria-hidden /></span>
            <p className="font-display text-lg font-extrabold">No hay pedidos ahora</p>
            <p className="mt-1.5 text-sm text-text-secondary">Te avisamos con un sonido apenas entre uno nuevo. Mantén la app abierta.</p>
          </div>
        )}
        <ul className="space-y-3">
          {sorted.map((o, i) => <OpenCard key={o.id} o={o} i={i} here={here} busy={busyId === o.id} onTake={() => take(o.id)} />)}
        </ul>
      </div>
    </div>
  );
}
