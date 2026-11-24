'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Send, X } from 'lucide-react';
import { deliveryService, type DeliveryMessage } from '@/services/deliveryService';
import { useAppStore } from '@/store/useAppStore';
import { haptics } from '@/utils/haptics';
import { motion, useLockScroll } from './ui';

interface Props {
  orderId: string;
  as: 'CUSTOMER' | 'DRIVER';
  otherName: string;
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
}

const QUICK = {
  CUSTOMER: ['Ya salgo', 'Estoy en la puerta', 'Toca el timbre', 'Gracias'],
  DRIVER: ['Voy en camino', 'Ya llegué', 'Estoy afuera', 'Hay mucho tráfico'],
} as const;

export function DeliveryChat({ orderId, as, otherName, open, disabled, onClose }: Props) {
  const uid = useAppStore((s) => s.user?.id);
  const [msgs, setMsgs] = useState<DeliveryMessage[]>([]);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useLockScroll(open);

  useEffect(() => (open ? deliveryService.subscribeMessages(orderId, setMsgs) : undefined), [orderId, open]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, open]);

  const send = async (t: string) => {
    const v = t.trim();
    if (!v || disabled) return;
    setText(''); setFailed(false);
    haptics.selection();
    if (!(await deliveryService.sendMessage(orderId, as, v))) { setFailed(true); setText(v); }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Chat con ${otherName}`}>
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative flex h-[78dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-surface"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42, mass: 0.9 }}
          >
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-extrabold">{otherName}</h2>
                <p className="text-xs text-text-secondary">{disabled ? 'El pedido terminó: el chat quedó cerrado' : 'Chat del pedido'}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Cerrar chat" className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.07] touch-manipulation active:scale-95"><X className="h-5 w-5" aria-hidden /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 pb-3">
              {!msgs.length && <p className="pt-10 text-center text-sm text-text-secondary">Escribe aquí si necesitas coordinar la entrega.</p>}
              {msgs.map((m) => {
                const mine = m.senderId === uid;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <p className={`max-w-[80%] break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${mine ? 'rounded-br-md bg-gold-primary text-background' : 'rounded-bl-md bg-white/[0.08]'}`}>{m.text}</p>
                  </div>
                );
              })}
              <div ref={end} />
            </div>

            {!disabled && (
              <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {QUICK[as].map((q) => (
                    <button key={q} type="button" onClick={() => send(q)} className="min-h-10 shrink-0 rounded-full bg-white/[0.07] px-3.5 text-sm font-semibold touch-manipulation active:scale-95">{q}</button>
                  ))}
                </div>
                {failed && <p role="alert" className="mb-2 text-xs text-red-300">No se envió. Revisa tu conexión.</p>}
                <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} placeholder="Escribe un mensaje" aria-label="Mensaje" enterKeyHint="send"
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-surface-2 px-4 text-base text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none" />
                  <button type="submit" disabled={!text.trim()} aria-label="Enviar" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-primary text-background touch-manipulation transition-opacity active:scale-95 disabled:opacity-40"><Send className="h-5 w-5" aria-hidden /></button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
