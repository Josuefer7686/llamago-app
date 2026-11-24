'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_ITEM_QTY, type CartLine } from '@/lib/delivery';

interface DeliveryState {
  /** El carrito es de un solo restaurante a la vez */
  restaurantId: string | null;
  restaurantName: string;
  lines: CartLine[];
  addLine: (restaurant: { id: string; name: string }, line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set) => ({
      restaurantId: null,
      restaurantName: '',
      lines: [],
      addLine: (restaurant, line) =>
        set((s) => {
          const base = s.restaurantId === restaurant.id ? s.lines : [];
          const same = base.find((l) => l.key === line.key);
          const lines = same
            ? base.map((l) => (l.key === line.key ? { ...l, qty: Math.min(MAX_ITEM_QTY, l.qty + line.qty) } : l))
            : [...base, line];
          return { restaurantId: restaurant.id, restaurantName: restaurant.name, lines };
        }),
      setQty: (key, qty) =>
        set((s) => {
          const lines = s.lines
            .map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_ITEM_QTY, qty) } : l))
            .filter((l) => l.qty > 0);
          return lines.length ? { lines } : { lines: [], restaurantId: null, restaurantName: '' };
        }),
      removeLine: (key) =>
        set((s) => {
          const lines = s.lines.filter((l) => l.key !== key);
          return lines.length ? { lines } : { lines: [], restaurantId: null, restaurantName: '' };
        }),
      clear: () => set({ lines: [], restaurantId: null, restaurantName: '' }),
    }),
    { name: 'llamago-cart-v1', version: 1 },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((t, l) => t + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => Math.round(lines.reduce((t, l) => t + l.unitPrice * l.qty, 0) * 100) / 100;
