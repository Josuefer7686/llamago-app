'use client';

import { useState } from 'react';
import { Banknote, Check, Crosshair, MapPin, Plus, StickyNote } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cartSubtotal, useDeliveryStore } from '@/store/useDeliveryStore';
import { deliveryApi } from '@/services/deliveryService';
import { enablePush } from '@/services/pushClient';
import { useDeliveryPromo } from '@/hooks/useDeliveryPromo';
import { bs, deliveryFeeFor, roadKm, isStore, MAX_NOTE, type Restaurant } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { BackButton, GoldButton, Photo, QtyStepper, motion, useStagger } from './ui';

interface Props {
  restaurant: Restaurant | null;
  onBack: () => void;
  onPlaced: (orderId: string) => void;
}

const LAST_KEY = 'llamago-last-address-v1';
const readLast = (): { text: string; reference: string } => {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) || '') || { text: '', reference: '' }; } catch { return { text: '', reference: '' }; }
};

/** "Confirma tu pedido": todo en una sola pantalla, sin pasos ocultos ni carrito aparte. */
export function CartCheckout({ restaurant: r, onBack, onPlaced }: Props) {
  const here = useAppStore((s) => s.currentLocation);
  const setCurrentLocation = useAppStore((s) => s.setCurrentLocation);
  const gps = useAppStore((s) => s.gpsPermission);
  const { lines, setQty, removeLine, clear } = useDeliveryStore();
  const [address, setAddress] = useState(() => (typeof window === 'undefined' ? '' : readLast().text));
  const [reference, setReference] = useState(() => (typeof window === 'undefined' ? '' : readLast().reference));
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState(false);
  const [error, setError] = useState('');
  const stagger = useStagger();
  const thing = isStore(r) ? 'producto' : 'plato';

  const subtotal = cartSubtotal(lines);
  const km = r && here ? roadKm({ lat: r.lat, lng: r.lng }, here) : null;
  const promo = useDeliveryPromo();
  const normalFee = km != null ? deliveryFeeFor(km) : null;
  const fee = normalFee != null ? promo.customerFee(normalFee) : null;
  const total = fee != null ? Math.round((subtotal + fee) * 100) / 100 : null;
  const belowMin = !!r?.minOrder && subtotal < r.minOrder;
  const far = km != null && km > 12;
  const exact = gps === 'granted' || located;
  const hasAddress = address.trim().length >= 3;
  const canOrder = !!r?.open && lines.length > 0 && (hasAddress || exact) && !belowMin && !far && fee != null;

  const locate = () => {
    if (!navigator.geolocation) { setError('Tu teléfono no permite ubicación.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCurrentLocation({ lat: p.coords.latitude, lng: p.coords.longitude, name: 'Mi ubicación', address: '' });
        setLocating(false);
        setLocated(true);
        haptics.success();
      },
      () => { setLocating(false); setError('No pudimos ubicarte. Activa el GPS e intenta otra vez.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  };

  const place = async () => {
    if (!r || !here || busy) return;
    setBusy(true); setError('');
    void enablePush();
    const res = await deliveryApi('create', {
      restaurantId: r.id,
      items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, sizeId: l.sizeId, extraIds: l.extraIds, sauceIds: l.sauceIds, notes: l.notes })),
      address: { text: address.trim() || 'Ubicación exacta (GPS)', reference: reference.trim(), lat: here.lat, lng: here.lng },
      paymentMethod: 'CASH',
      note: note.trim(),
    });
    setBusy(false);
    if (!res.ok || !res.id) { haptics.error(); setError(res.error || 'No se pudo enviar el pedido.'); return; }
    haptics.success();
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ text: address.trim(), reference: reference.trim() })); } catch { /* sin almacenamiento */ }
    clear();
    void promo.refresh();
    onPlaced(res.id);
  };

  const field = 'h-14 w-full rounded-2xl border border-white/10 bg-surface-2 px-4 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none';

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Confirma tu pedido</h1>
          {r && <p className="truncate text-xs font-semibold text-text-secondary">{r.name}</p>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <div className="mx-auto max-w-[430px] space-y-5 px-4">
          {!lines.length && (
            <div className="rounded-3xl bg-surface p-8 text-center">
              <p className="font-display text-lg font-extrabold">Todavía no elegiste nada</p>
              <p className="mt-1.5 text-sm text-text-secondary">Vuelve y toca <b className="text-gold-primary">Pedir</b> en el {thing} que quieras.</p>
            </div>
          )}

          <ul className="space-y-3">
            {lines.map((l, i) => (
              <motion.li key={l.key} layout {...stagger(i)} className="flex gap-3 rounded-3xl border border-white/10 bg-surface p-3">
                <Photo src={l.photo} className="h-20 w-20 shrink-0 rounded-2xl" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-2 text-[15px] font-bold leading-tight">{l.name}</p>
                  {l.optionsLabel && <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{l.optionsLabel}</p>}
                  {l.notes && <p className="mt-0.5 flex items-start gap-1 text-xs text-gold-primary"><StickyNote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /><span className="line-clamp-2">{l.notes}</span></p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-display text-base font-extrabold tabular-nums">{bs(Math.round(l.unitPrice * l.qty * 100) / 100)}</span>
                    <QtyStepper qty={l.qty} trashAtMin onChange={(n) => (n < 1 ? removeLine(l.key) : setQty(l.key, n))} />
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>

          <button type="button" onClick={() => { haptics.selection(); onBack(); }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gold-primary/40 text-[15px] font-bold text-gold-primary touch-manipulation transition-transform duration-150 ease-out active:scale-[0.98]">
            <Plus className="h-5 w-5" aria-hidden /> Agregar otro {thing}
          </button>

          <section className="space-y-3 rounded-3xl border border-white/10 bg-surface p-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><MapPin className="h-5 w-5 text-gold-primary" aria-hidden /> ¿Dónde te lo llevamos?</h2>
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[15px] font-bold touch-manipulation transition-transform duration-150 ease-out active:scale-[0.985] ${exact ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-gold-primary/50 bg-gold-primary/10 text-gold-primary'}`}
            >
              {exact && !locating ? <Check className="h-5 w-5 shrink-0" strokeWidth={3} aria-hidden /> : <Crosshair className={`h-5 w-5 shrink-0 ${locating ? 'animate-spin' : ''}`} aria-hidden />}
              <span>{locating ? 'Buscando tu ubicación…' : exact ? 'Entregar en mi ubicación exacta' : 'Usar mi ubicación exacta'}</span>
            </button>
            <input value={address} onChange={(e) => setAddress(e.target.value.slice(0, 160))} placeholder={exact ? "Calle o barrio (opcional)" : "O escribe tu calle o barrio"} aria-label="Tu calle o barrio" autoComplete="street-address" enterKeyHint="next" className={field} />
            <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 120))} placeholder="Una referencia (opcional)" aria-label="Referencia, opcional" enterKeyHint="done" className={field} />
          </section>

          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-surface p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-primary/15 text-gold-primary"><Banknote className="h-6 w-6" aria-hidden /></span>
            <p className="text-[15px] leading-snug"><b>Pagas en efectivo</b> cuando llegue tu pedido.</p>
          </div>

          {showNote ? (
            <label className="block space-y-2">
              <span className="flex items-baseline justify-between"><span className="font-display text-base font-extrabold">Mensaje para el repartidor</span><span className="text-xs font-semibold text-text-secondary">{note.length}/{MAX_NOTE}</span></span>
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))} rows={2} autoFocus placeholder="Ej.: toca el timbre dos veces"
                className="w-full resize-none rounded-2xl border border-white/10 bg-surface px-4 py-3 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none" />
            </label>
          ) : (
            <button type="button" onClick={() => { haptics.selection(); setShowNote(true); }} className="min-h-11 w-full text-sm font-bold text-text-secondary underline-offset-4 touch-manipulation hover:underline">
              + Dejar un mensaje al repartidor
            </button>
          )}

          {promo.active && (
            <p className="rounded-2xl bg-gold-primary/10 px-4 py-3 text-sm font-semibold text-gold-primary">
              🎁 Regalo de bienvenida: envío a Bs {promo.PROMO_CUSTOMER_FEE}. Te quedan {promo.left} pedido{promo.left === 1 ? '' : 's'} así.
            </p>
          )}
          <section className="space-y-2 rounded-3xl bg-surface-2 p-4 text-[15px]" aria-label="Resumen">
            <div className="flex justify-between"><span className="text-text-secondary">Tu pedido</span><span className="font-semibold tabular-nums">{bs(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Traerlo a tu casa</span><span className="font-semibold tabular-nums">{fee != null ? <>{normalFee != null && normalFee > fee && <s className="mr-1.5 text-xs font-normal opacity-60">{bs(normalFee)}</s>}{bs(fee)}</> : '…'}</span></div>
            <div className="flex justify-between border-t border-white/10 pt-3 font-display text-xl font-extrabold"><span>Total a pagar</span><span className="tabular-nums text-gold-primary">{total != null ? bs(total) : '…'}</span></div>
          </section>

          {belowMin && r?.minOrder && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">Este restaurante pide mínimo {bs(r.minOrder)}. Agrega otro plato.</p>}
          {far && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">Estás muy lejos de este restaurante (más de 12 km).</p>}
          {r && !r.open && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">El restaurante cerró. Vuelve cuando abra.</p>}
          {error && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-[430px]">
          <GoldButton onClick={place} loading={busy} disabled={!canOrder}>
            Pedir ahora{total != null ? <span className="tabular-nums"> · {bs(total)}</span> : null}
          </GoldButton>
          {lines.length > 0 && !hasAddress && !exact && <p className="mt-2 text-center text-sm text-text-secondary">Toca “Usar mi ubicación exacta” o escribe tu calle.</p>}
        </div>
      </div>
    </div>
  );
}
