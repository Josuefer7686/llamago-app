'use client';

import { useState } from 'react';
import { Banknote, Crosshair, MapPin, QrCode, StickyNote } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cartSubtotal, useDeliveryStore } from '@/store/useDeliveryStore';
import { deliveryApi } from '@/services/deliveryService';
import { bs, deliveryFeeFor, roadKm, MAX_NOTE, type DeliveryPayment, type Restaurant } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { BackButton, GoldButton, Photo, QtyStepper, motion, useStagger } from './ui';

interface Props {
  restaurant: Restaurant | null;
  onBack: () => void;
  onPlaced: (orderId: string) => void;
}

export function CartCheckout({ restaurant: r, onBack, onPlaced }: Props) {
  const here = useAppStore((s) => s.currentLocation);
  const setCurrentLocation = useAppStore((s) => s.setCurrentLocation);
  const gps = useAppStore((s) => s.gpsPermission);
  const { lines, setQty, removeLine, clear } = useDeliveryStore();
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<DeliveryPayment>('CASH');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const stagger = useStagger();

  const subtotal = cartSubtotal(lines);
  const km = r && here ? roadKm({ lat: r.lat, lng: r.lng }, here) : null;
  const fee = km != null ? deliveryFeeFor(km) : null;
  const total = fee != null ? Math.round((subtotal + fee) * 100) / 100 : null;
  const belowMin = !!r?.minOrder && subtotal < r.minOrder;
  const far = km != null && km > 12;
  const realGps = gps === 'granted';

  const locate = () => {
    if (!navigator.geolocation) { setError('Tu teléfono no permite ubicación.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCurrentLocation({ lat: p.coords.latitude, lng: p.coords.longitude, name: 'Mi ubicación', address: '' });
        setLocating(false);
        haptics.success();
      },
      () => { setLocating(false); setError('No pudimos ubicarte. Activa el GPS e intenta otra vez.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  };

  const canOrder = !!r?.open && lines.length > 0 && address.trim().length >= 3 && !belowMin && !far && fee != null;

  const place = async () => {
    if (!r || !here || busy) return;
    setBusy(true); setError('');
    const res = await deliveryApi('create', {
      restaurantId: r.id,
      items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, sizeId: l.sizeId, extraIds: l.extraIds, sauceIds: l.sauceIds, notes: l.notes })),
      address: { text: address.trim(), reference: reference.trim(), lat: here.lat, lng: here.lng },
      paymentMethod: payment,
      note: note.trim(),
    });
    setBusy(false);
    if (!res.ok || !res.id) { haptics.error(); setError(res.error || 'No se pudo enviar el pedido.'); return; }
    haptics.success();
    clear();
    onPlaced(res.id);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Tu pedido</h1>
          {r && <p className="truncate text-xs font-semibold text-text-secondary">{r.name}</p>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <div className="mx-auto max-w-[430px] space-y-5 px-4">
          {!lines.length && (
            <div className="rounded-3xl bg-surface p-8 text-center">
              <p className="font-display text-lg font-extrabold">Tu carrito está vacío</p>
              <p className="mt-1.5 text-sm text-text-secondary">Elige algo rico del menú.</p>
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

          <section className="space-y-3 rounded-3xl border border-white/10 bg-surface p-4">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold"><MapPin className="h-[18px] w-[18px] text-gold-primary" aria-hidden /> Dónde te lo llevamos</h2>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value.slice(0, 160))}
              placeholder="Calle, barrio y número de casa"
              aria-label="Dirección de entrega"
              autoComplete="street-address"
              enterKeyHint="next"
              className="h-12 w-full rounded-2xl border border-white/10 bg-surface-2 px-4 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none"
            />
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value.slice(0, 120))}
              placeholder="Referencia (ej.: portón verde, frente a la tienda)"
              aria-label="Referencia"
              enterKeyHint="done"
              className="h-12 w-full rounded-2xl border border-white/10 bg-surface-2 px-4 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { haptics.selection(); locate(); }}
              disabled={locating}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold touch-manipulation transition-transform duration-150 ease-out active:scale-[0.985] ${realGps ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-gold-primary/40 bg-gold-primary/10 text-gold-primary'}`}
            >
              <Crosshair className={`h-5 w-5 shrink-0 ${locating ? 'animate-spin' : ''}`} aria-hidden />
              {locating ? 'Buscando tu ubicación…' : realGps ? 'Usando tu ubicación actual. Toca para actualizarla.' : 'Usar mi ubicación actual (el repartidor te encuentra más rápido)'}
            </button>
            {!realGps && <p className="text-xs leading-snug text-text-secondary">Si no activas la ubicación, calculamos el envío desde el centro de Riberalta.</p>}
          </section>

          <section className="space-y-3 rounded-3xl border border-white/10 bg-surface p-4">
            <h2 className="font-display text-base font-extrabold">Cómo pagas</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
              <button type="button" role="radio" aria-checked={payment === 'CASH'} onClick={() => { haptics.selection(); setPayment('CASH'); }}
                className={`flex min-h-14 items-center gap-2.5 rounded-2xl border px-4 text-left font-bold touch-manipulation transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${payment === 'CASH' ? 'border-gold-primary bg-gold-primary/10' : 'border-white/10 bg-surface-2'}`}>
                <Banknote className="h-5 w-5 text-gold-primary" aria-hidden /> Efectivo
              </button>
              <button type="button" role="radio" aria-checked={false} disabled aria-label="QR, próximamente"
                className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-white/10 bg-surface-2 px-4 text-left font-bold opacity-50">
                <QrCode className="h-5 w-5" aria-hidden /> QR <span className="text-[11px] font-semibold text-text-secondary">pronto</span>
              </button>
            </div>
            <p className="text-xs leading-snug text-text-secondary">Pagas al repartidor cuando recibes tu pedido. Ten el monto exacto si puedes.</p>
          </section>

          <label className="block space-y-2">
            <span className="flex items-baseline justify-between"><span className="font-display text-base font-extrabold">Nota para el repartidor</span><span className="text-xs font-semibold text-text-secondary">{note.length}/{MAX_NOTE}</span></span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))} rows={2} placeholder="Ej.: toca el timbre dos veces"
              className="w-full resize-none rounded-2xl border border-white/10 bg-surface px-4 py-3 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none" />
          </label>

          <section className="space-y-2 rounded-3xl bg-surface-2 p-4 text-[15px]" aria-label="Resumen">
            <div className="flex justify-between"><span className="text-text-secondary">Productos</span><span className="font-semibold tabular-nums">{bs(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Envío{km != null ? ` · ${km.toFixed(1).replace('.', ',')} km` : ''}</span><span className="font-semibold tabular-nums">{fee != null ? bs(fee) : '…'}</span></div>
            <div className="flex justify-between border-t border-white/10 pt-3 font-display text-xl font-extrabold"><span>Total</span><span className="tabular-nums text-gold-primary">{total != null ? bs(total) : '…'}</span></div>
          </section>

          {belowMin && r?.minOrder && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">El pedido mínimo de este restaurante es {bs(r.minOrder)}.</p>}
          {far && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">Estás muy lejos de este restaurante (más de 12 km).</p>}
          {r && !r.open && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">El restaurante cerró. Vuelve cuando abra.</p>}
          {error && <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-[430px]">
          <GoldButton onClick={place} loading={busy} disabled={!canOrder}>
            Confirmar pedido{total != null ? <span className="tabular-nums"> · {bs(total)}</span> : null}
          </GoldButton>
          {lines.length > 0 && address.trim().length < 3 && <p className="mt-2 text-center text-xs text-text-secondary">Escribe tu dirección para continuar.</p>}
        </div>
      </div>
    </div>
  );
}
