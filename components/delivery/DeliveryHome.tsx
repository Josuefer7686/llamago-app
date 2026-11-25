'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { deliveryService } from '@/services/deliveryService';
import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useDeliveryAlerts } from '@/hooks/useDeliveryAlerts';
import { STATUS_LABEL, bs, type DeliveryOrder, type Restaurant } from '@/lib/delivery';
import { haptics } from '@/utils/haptics';
import { BackButton, StatusPill, motion, useStagger } from './ui';
import { RestaurantList } from './RestaurantList';
import { RestaurantMenu } from './RestaurantMenu';
import { CartCheckout } from './CartCheckout';
import { OrderTracking } from './OrderTracking';
import { takePendingRestaurant } from '@/services/adClient';

type View =
  | { name: 'list' }
  | { name: 'restaurant'; id: string }
  | { name: 'checkout' }
  | { name: 'tracking'; id: string }
  | { name: 'orders' };

const when = (ms: number) =>
  new Date(ms).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function OrdersView({ orders, onBack, onOpen }: { orders: DeliveryOrder[]; onBack: () => void; onOpen: (id: string) => void }) {
  const stagger = useStagger();
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BackButton onClick={onBack} />
        <h1 className="font-display text-xl font-extrabold tracking-tight">Mis pedidos</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
        <ul className="mx-auto max-w-[430px] space-y-3 px-4">
          {!orders.length && (
            <li className="rounded-3xl bg-surface p-8 text-center">
              <p className="font-display text-lg font-extrabold">Aún no pediste nada</p>
              <p className="mt-1.5 text-sm text-text-secondary">Tus pedidos aparecerán aquí.</p>
            </li>
          )}
          {orders.map((o, i) => (
            <motion.li key={o.id} {...stagger(i)}>
              <button type="button" onClick={() => { haptics.selection(); onOpen(o.id); }} className="flex w-full items-center gap-3 rounded-3xl border border-white/10 bg-surface p-4 text-left touch-manipulation transition-transform duration-150 ease-out active:scale-[0.985]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display text-base font-extrabold">{o.restaurantName}</p>
                    <StatusPill tone={o.status === 'DELIVERED' ? 'green' : o.status === 'CANCELLED' ? 'red' : 'gold'}>{STATUS_LABEL[o.status]}</StatusPill>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-text-secondary">{o.items.map((x) => `${x.qty}× ${x.name}`).join(', ')}</p>
                  <p className="mt-1 text-xs font-semibold text-text-secondary">{when(o.createdAtMs)} · <span className="tabular-nums text-white">{bs(o.total)}</span></p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Pestaña "Delivery" del pasajero: lista → menú → confirmar pedido → seguimiento. */
export function DeliveryHome() {
  const { active, mine } = useDeliveryAlerts();
  const cartRestaurant = useDeliveryStore((s) => s.restaurantId);
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setView] = useState<View | null>(null);
  // Si ya hay un pedido en curso al entrar, vamos directo a seguirlo.
  const view: View = picked ?? (active ? { name: 'tracking', id: active.id } : { name: 'list' });

  useEffect(() => deliveryService.subscribeRestaurants(setRestaurants, () => setFailed(true)), []);
  // Venir desde un anuncio del inicio o desde un aviso al celular: abre directo ese restaurante.
  useEffect(() => {
    const id = takePendingRestaurant();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una sola vez al entrar
    if (id) setView({ name: 'restaurant', id });
  }, []);

  const byId = (id: string) => restaurants?.find((r) => r.id === id) || null;

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view.name + ('id' in view ? view.id : '')}
          className="absolute inset-0"
          initial={{ opacity: 0, x: view.name === 'list' ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          {view.name === 'list' && (
            <RestaurantList
              restaurants={restaurants} failed={failed} activeOrder={active}
              onOpen={(id) => setView({ name: 'restaurant', id })}
              onTrack={(id) => setView({ name: 'tracking', id })}
              onOrders={() => setView({ name: 'orders' })}
            />
          )}
          {view.name === 'restaurant' && (() => {
            const r = byId(view.id);
            return r ? (
              <RestaurantMenu restaurant={r} onBack={() => setView({ name: 'list' })} onCart={() => setView({ name: 'checkout' })} />
            ) : (
              <div className="grid h-full place-items-center p-8 text-center text-sm text-text-secondary">
                <div>Este restaurante ya no está disponible.<div className="mt-4"><button type="button" onClick={() => setView({ name: 'list' })} className="min-h-11 rounded-2xl bg-white/[0.07] px-5 font-bold">Volver</button></div></div>
              </div>
            );
          })()}
          {view.name === 'checkout' && (
            <CartCheckout
              restaurant={cartRestaurant ? byId(cartRestaurant) : null}
              onBack={() => setView(cartRestaurant ? { name: 'restaurant', id: cartRestaurant } : { name: 'list' })}
              onPlaced={(id) => setView({ name: 'tracking', id })}
            />
          )}
          {view.name === 'tracking' && <OrderTracking orderId={view.id} onBack={() => setView({ name: 'list' })} restaurants={restaurants} onOpenRestaurant={(id) => setView({ name: 'restaurant', id })} />}
          {view.name === 'orders' && <OrdersView orders={mine} onBack={() => setView({ name: 'list' })} onOpen={(id) => setView({ name: 'tracking', id })} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
