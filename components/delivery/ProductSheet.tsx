'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, useDragControls, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { MAX_NOTE, bs, unitPriceFor, type CartLine, type ItemOption, type MenuItem } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { EASE_OUT, GoldButton, Photo, QtyStepper, motion, useLockScroll } from './ui';

interface Props {
  item: MenuItem | null;
  onClose: () => void;
  /** `now`: ir directo a confirmar el pedido; si no, vuelve al menú para elegir otro plato */
  onAdd: (line: CartLine, now: boolean) => void;
}

function OptionGroup({
  title, hint, options, selected, multiple, onToggle,
}: { title: string; hint: string; options: ItemOption[]; selected: string[]; multiple: boolean; onToggle: (id: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="flex w-full items-baseline justify-between">
        <span className="font-display text-base font-extrabold">{title}</span>
        <span className="text-xs font-semibold text-text-secondary">{hint}</span>
      </legend>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => { haptics.selection(); onToggle(o.id); }}
            className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left touch-manipulation transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.985] ${
              on ? 'border-gold-primary bg-gold-primary/10' : 'border-white/10 bg-surface-2'
            }`}
          >
            <span className={`grid h-5 w-5 shrink-0 place-items-center border-2 transition-colors duration-150 ${multiple ? 'rounded-md' : 'rounded-full'} ${on ? 'border-gold-primary bg-gold-primary text-background' : 'border-white/30'}`}>
              {on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />}
            </span>
            <span className="flex-1 text-[15px] font-semibold">{o.name}</span>
            <span className="text-sm font-bold text-text-secondary">{o.extra > 0 ? `+ ${bs(o.extra)}` : 'Incluido'}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

/** Hoja del producto: se arrastra hacia abajo para cerrar y sigue el dedo 1:1. */
export function ProductSheet({ item, onClose, onAdd }: Props) {
  return (
    <AnimatePresence>
      {item && <Sheet key={item.id} item={item} onClose={onClose} onAdd={onAdd} />}
    </AnimatePresence>
  );
}

function Sheet({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (l: CartLine, now: boolean) => void }) {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  useLockScroll();
  const [sizeId, setSizeId] = useState<string | undefined>(item.sizes?.[0]?.id);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [sauceIds, setSauceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState(1);

  const price = useMemo(() => unitPriceFor(item, sizeId, extraIds, sauceIds), [item, sizeId, extraIds, sauceIds]);
  const toggle = (set: (f: (a: string[]) => string[]) => void) => (id: string) =>
    set((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const add = (now: boolean) => {
    haptics.success();
    onAdd({
      key: `${item.id}|${price.sizeId || ''}|${[...price.extraIds].sort().join(',')}|${[...price.sauceIds].sort().join(',')}|${notes.trim()}`,
      itemId: item.id, name: item.name, photo: item.photo, qty, unitPrice: price.unit,
      sizeId: price.sizeId, extraIds: price.extraIds, sauceIds: price.sauceIds, optionsLabel: price.label, notes: notes.trim(),
    }, now);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={item.name}>
      <motion.div
        className="absolute inset-0 bg-black/70"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="relative flex max-h-[92dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-surface"
        initial={reduce ? { opacity: 0 } : { y: '100%' }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: '100%' }}
        transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 }}
        drag={reduce ? false : 'y'}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.7 }}
        dragControls={controls}
        onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
      >
        <div className="relative shrink-0 touch-none" onPointerDown={(e) => controls.start(e)}>
          <Photo src={item.photo} alt="" className="h-56 w-full" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/30" />
          <span className="absolute left-1/2 top-2.5 h-1.5 w-11 -translate-x-1/2 rounded-full bg-white/40" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md touch-manipulation active:scale-95"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">
          <div>
            <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight">{item.name}</h2>
            {item.description && <p className="mt-1.5 text-[15px] leading-snug text-text-secondary">{item.description}</p>}
            <p className="mt-2 font-display text-xl font-extrabold text-gold-primary">{bs(item.price)}</p>
          </div>

          {!!item.sizes?.length && (
            <OptionGroup title="Tamaño" hint="Elige 1" options={item.sizes} selected={sizeId ? [sizeId] : []} multiple={false} onToggle={setSizeId} />
          )}
          {!!item.extras?.length && (
            <OptionGroup title="Extras" hint="Opcional" options={item.extras} selected={extraIds} multiple onToggle={toggle(setExtraIds)} />
          )}
          {!!item.sauces?.length && (
            <OptionGroup title="Salsas" hint="Opcional" options={item.sauces} selected={sauceIds} multiple onToggle={toggle(setSauceIds)} />
          )}

          <label className="block space-y-2">
            <span className="flex items-baseline justify-between">
              <span className="font-display text-base font-extrabold">¿Algo especial? <span className="text-xs font-semibold text-text-secondary">(opcional)</span></span>
              <span className="text-xs font-semibold text-text-secondary">{notes.length}/{MAX_NOTE}</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTE))}
              rows={2}
              placeholder="Ej.: sin cebolla, poco picante"
              className="w-full resize-none rounded-2xl border border-white/10 bg-surface-2 px-4 py-3 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none"
            />
          </label>
        </div>

        <div className="shrink-0 space-y-2 border-t border-white/10 bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center gap-3">
            <QtyStepper qty={qty} onChange={(n) => setQty(Math.max(1, n))} />
            <GoldButton onClick={() => add(true)} disabled={!item.available}>
              {item.available ? <>Pedir <span className="tabular-nums">· {bs(Math.round(price.unit * qty * 100) / 100)}</span></> : 'Agotado'}
            </GoldButton>
          </div>
          {item.available && (
            <button type="button" onClick={() => add(false)} className="min-h-11 w-full text-sm font-bold text-gold-primary touch-manipulation active:opacity-70">
              Agregar y elegir algo más
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export { EASE_OUT };
