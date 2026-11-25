'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MessageCircle, Phone, ReceiptText } from 'lucide-react';
import { deliveryService } from '@/services/deliveryService';
import { deliveryApi } from '@/services/deliveryService';
import { MAX_TIP, STATUS_LABEL, TIP_OPTIONS, bs, distanceKm, isActiveOrder, type DeliveryOrder } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { audio } from '@/utils/audio';
import { BackButton, GoldButton, Skeleton, initials, motion } from './ui';
import { DeliveryMapView } from './DeliveryMapView';
import { DeliveryChat } from './DeliveryChat';

const STEPS = [
  { s: 'PLACED', label: 'Enviado' },
  { s: 'ACCEPTED', label: 'Preparando' },
  { s: 'PICKED_UP', label: 'En camino' },
  { s: 'DELIVERED', label: 'Entregado' },
] as const;

const SUB: Record<string, string> = {
  PLACED: 'Avisamos a los repartidores cercanos. Suele tardar pocos minutos.',
  ACCEPTED: 'Tu repartidor va al restaurante a recoger tu pedido.',
  PICKED_UP: 'Tu repartidor ya lo tiene y va hacia tu dirección.',
  DELIVERED: '¡Buen provecho! Gracias por pedir con LlamaGO.',
  CANCELLED: 'Este pedido fue cancelado.',
};

const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export function OrderTracking({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [o, setO] = useState<DeliveryOrder | null | undefined>(undefined);
  const [chat, setChat] = useState(false);
  const [items, setItems] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => deliveryService.subscribeOrder(orderId, setO, () => setO(null)), [orderId]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(t); }, []);

  // Aviso cuando cambia el estado (sonido + vibración suaves)
  const status = o?.status;
  const lastStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!status) return;
    if (lastStatus.current && lastStatus.current !== status) {
      haptics.notification();
      try { if (status === 'DELIVERED') audio.walletApprovedChime(); } catch { /* sin audio */ }
    }
    lastStatus.current = status;
  }, [status]);

  const eta = useMemo(() => {
    if (!o) return null;
    if (o.status === 'ACCEPTED') return Math.max(5, Math.round(o.distanceKm * 4) + 10);
    if (o.status === 'PICKED_UP') {
      const from = o.driverLoc || o.restaurantLoc;
      return Math.max(2, Math.round(distanceKm(from, o.address) * 1.3 * 4));
    }
    return null;
  }, [o]);

  if (o === undefined) {
    return <div className="space-y-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]"><Skeleton className="h-64" /><Skeleton className="h-40" /></div>;
  }
  if (o === null) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="font-display text-lg font-extrabold">No encontramos este pedido</p>
          <div className="mt-4 w-48"><GoldButton onClick={onBack}>Volver</GoldButton></div>
        </div>
      </div>
    );
  }

  const idx = STEPS.findIndex((s) => s.s === o.status);
  const cancelled = o.status === 'CANCELLED';
  const active = isActiveOrder(o);
  const canCancel = o.status === 'PLACED' || o.status === 'ACCEPTED';
  const waitedMin = Math.floor((now - o.createdAtMs) / 60000);

  const addTip = async (amount: number) => {
    if (!o || busy) return;
    haptics.impact(); setBusy(true); setError('');
    const r = await deliveryApi('tip', { orderId: o.id, amount });
    setBusy(false);
    if (!r.ok) { haptics.error(); setError(r.error || 'No se pudo subir el envío.'); return; }
    haptics.success();
  };

  const cancel = async () => {
    setBusy(true); setError('');
    const r = await deliveryApi('cancel', { orderId: o.id, reason: 'Cancelado por el cliente' });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'No se pudo cancelar.'); return; }
    setConfirmCancel(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[42%] min-h-[220px] shrink-0">
        <DeliveryMapView
          restaurant={o.restaurantLoc}
          home={{ lat: o.address.lat, lng: o.address.lng }}
          driver={o.status === 'ACCEPTED' || o.status === 'PICKED_UP' ? o.driverLoc : null}
        />
        <div className="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[500]"><BackButton onClick={onBack} /></div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="relative -mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[32px] border-t border-white/10 bg-background px-4 pb-6 pt-5"
      >
        <div className="mx-auto max-w-[430px] space-y-5">
          <div>
            <h1 className={`font-display text-[26px] font-extrabold italic leading-tight tracking-tight ${cancelled ? 'text-red-300' : ''}`}>{STATUS_LABEL[o.status]}</h1>
            <p className="mt-1 text-sm leading-snug text-text-secondary">{cancelled && o.cancelReason ? o.cancelReason : SUB[o.status]}</p>
            {eta != null && active && <p className="mt-2 inline-flex rounded-full bg-gold-primary/15 px-3 py-1 text-sm font-bold text-gold-primary">Llega en unos {eta} min</p>}
          </div>

          {!cancelled && (
            <ol className="flex items-start" aria-label="Avance del pedido">
              {STEPS.map((s, i) => {
                const done = i <= idx;
                return (
                  <li key={s.s} className="relative flex flex-1 flex-col items-center gap-1.5" aria-current={i === idx ? 'step' : undefined}>
                    {i > 0 && <span className={`absolute right-1/2 top-[13px] h-0.5 w-full transition-colors duration-500 ${i <= idx ? 'bg-gold-primary' : 'bg-white/15'}`} aria-hidden />}
                    <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 transition-[background-color,border-color] duration-300 ${done ? 'border-gold-primary bg-gold-primary text-background' : 'border-white/20 bg-background'}`}>
                      {done && <Check className="h-4 w-4" strokeWidth={3.5} aria-hidden />}
                    </span>
                    <span className={`text-center text-[11px] font-bold leading-tight ${done ? 'text-white' : 'text-text-secondary'}`}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {o.status === 'PLACED' && waitedMin >= 1 && (
            <section className="space-y-3 rounded-3xl border border-gold-primary/40 bg-gold-primary/10 p-4" aria-label="Subir envío">
              <div>
                <h2 className="font-display text-lg font-extrabold leading-tight">¿Nadie acepta todavía?</h2>
                <p className="mt-1 text-sm leading-snug text-white/80">
                  Dale un <b>extra al repartidor</b> y alguien tomará tu pedido más rápido. Todo ese dinero es para él.
                </p>
              </div>
              {(o.tip ?? 0) > 0 && <p className="text-sm font-bold text-gold-primary">Ya ofreciste {bs(o.tip ?? 0)} extra. Avisamos de nuevo a los repartidores.</p>}
              <div className="grid grid-cols-3 gap-2">
                {TIP_OPTIONS.filter((a) => (o.tip ?? 0) + a <= MAX_TIP).map((a) => (
                  <button key={a} type="button" disabled={busy} onClick={() => void addTip(a)}
                    className="min-h-14 rounded-2xl bg-gold-primary font-display text-lg font-extrabold text-background touch-manipulation transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50">
                    +{bs(a)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {o.status === 'PLACED' && waitedMin >= 8 && (
            <p className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm leading-snug text-text-secondary">Estamos tardando más de lo normal en encontrar un repartidor. Puedes seguir esperando o cancelar.</p>
          )}

          {o.driverId && (o.status === 'ACCEPTED' || o.status === 'PICKED_UP' || o.status === 'DELIVERED') && (
            <section className="flex items-center gap-3 rounded-3xl border border-white/10 bg-surface p-3.5" aria-label="Tu repartidor">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-primary font-display font-extrabold text-background">{initials(o.driverName || 'R')}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-extrabold">{o.driverName}</p>
                <p className="truncate text-xs text-text-secondary">{o.driverVehicle || 'Repartidor LlamaGO'}</p>
              </div>
              {active && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { haptics.selection(); setChat(true); }} aria-label="Chat con el repartidor" className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] touch-manipulation active:scale-95"><MessageCircle className="h-5 w-5" aria-hidden /></button>
                  {o.driverPhone && <a href={`tel:${o.driverPhone}`} aria-label="Llamar al repartidor" className="grid h-11 w-11 place-items-center rounded-full bg-gold-primary text-background touch-manipulation active:scale-95"><Phone className="h-5 w-5" aria-hidden /></a>}
                </div>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-surface">
            <button type="button" onClick={() => { haptics.selection(); setItems((v) => !v); }} aria-expanded={items} className="flex min-h-14 w-full items-center gap-3 px-4 text-left touch-manipulation">
              <ReceiptText className="h-5 w-5 text-gold-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{o.restaurantName}</span><span className="block text-xs text-text-secondary">{o.items.reduce((t, i) => t + i.qty, 0)} productos · {bs(o.total)}</span></span>
              <ChevronDown className={`h-5 w-5 text-text-secondary transition-transform duration-200 ${items ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {items && (
              <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm">
                {o.items.map((i, k) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="min-w-0"><span className="font-semibold">{i.qty}× {i.name}</span>{i.optionsLabel && <span className="block text-xs text-text-secondary">{i.optionsLabel}</span>}{i.notes && <span className="block text-xs text-gold-primary">“{i.notes}”</span>}</span>
                    <span className="shrink-0 tabular-nums text-text-secondary">{bs(Math.round(i.unitPrice * i.qty * 100) / 100)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/10 pt-2 text-text-secondary"><span>Envío{o.promo ? " (regalo de bienvenida 🎁)" : ""}</span><span className="tabular-nums">{o.promo && (o.customerFee ?? o.deliveryFee) < o.deliveryFee ? <><s className="mr-1.5 text-xs opacity-60">{bs(o.deliveryFee)}</s>{bs(o.customerFee ?? o.deliveryFee)}</> : bs(o.customerFee ?? o.deliveryFee)}</span></div>
                {(o.tip ?? 0) > 0 && <div className="flex justify-between text-text-secondary"><span>Incluye extra para el repartidor</span><span className="tabular-nums">{bs(o.tip ?? 0)}</span></div>}
                <div className="flex justify-between font-display text-base font-extrabold"><span>Total en efectivo</span><span className="tabular-nums text-gold-primary">{bs(o.total)}</span></div>
                <p className="pt-1 text-xs text-text-secondary">Entrega en: {o.address.text}{o.address.reference ? ` (${o.address.reference})` : ''}</p>
              </div>
            )}
          </section>

          {error && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

          {o.restaurantPhone && active && (
            <a href={waLink(o.restaurantPhone, `Hola, soy ${o.customerName}, tengo un pedido en LlamaGO.`)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl bg-white/[0.07] text-sm font-bold touch-manipulation active:scale-[0.98]">Escribir al restaurante</a>
          )}
          {canCancel && (
            <button type="button" onClick={() => setConfirmCancel(true)} className="min-h-12 w-full rounded-2xl text-sm font-bold text-red-300 touch-manipulation active:scale-[0.98]">Cancelar pedido</button>
          )}
          {!active && <GoldButton onClick={onBack}>Volver al delivery</GoldButton>}
        </div>
      </motion.div>

      <DeliveryChat orderId={o.id} as="CUSTOMER" otherName={o.driverName || 'Repartidor'} open={chat} disabled={!active} onClose={() => setChat(false)} />

      {confirmCancel && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-6" role="alertdialog" aria-modal="true" aria-label="Cancelar pedido">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface p-5">
            <h2 className="font-display text-xl font-extrabold">¿Cancelar tu pedido?</h2>
            <p className="mt-2 text-sm leading-snug text-text-secondary">{o.status === 'ACCEPTED' ? 'Tu repartidor ya va al restaurante. Cancela solo si de verdad no lo necesitas.' : 'Todavía no hay repartidor asignado.'}</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={cancel} disabled={busy} className="min-h-12 rounded-2xl bg-red-500 font-display font-extrabold text-white touch-manipulation active:scale-[0.97] disabled:opacity-50">{busy ? 'Cancelando…' : 'Sí, cancelar'}</button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="min-h-12 rounded-2xl bg-white/[0.07] font-bold touch-manipulation active:scale-[0.97]">No, seguir con mi pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
