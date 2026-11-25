'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { deliveryApi } from '@/services/deliveryService';
import { promoCustomerFee } from '@/lib/delivery';

interface PromoState {
  left: number | null;
  at: number;
  refresh: (force?: boolean) => Promise<void>;
}

const usePromoStore = create<PromoState>((set, get) => ({
  left: null,
  at: 0,
  refresh: async (force) => {
    if (!force && Date.now() - get().at < 20_000) return;
    set({ at: Date.now() });
    const r = await deliveryApi('promo');
    if (r.ok && typeof r.left === 'number') set({ left: r.left });
  },
}));

/** Pedidos de bienvenida que le quedan al cliente (envío a Bs 1). null = aún no se sabe. */
export function useDeliveryPromo() {
  const left = usePromoStore((s) => s.left);
  const refresh = usePromoStore((s) => s.refresh);
  useEffect(() => { void refresh(); }, [refresh]);
  return {
    left,
    active: (left ?? 0) > 0,
    refresh: () => refresh(true),
    /** Lo que pagaría el cliente por un envío normal de `fee` Bs */
    customerFee: (fee: number) => ((left ?? 0) > 0 ? promoCustomerFee(fee) : fee),
  };
}
