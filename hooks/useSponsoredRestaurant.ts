'use client';

import { useEffect, useState } from 'react';
import { deliveryService } from '@/services/deliveryService';
import { sponsored } from '@/components/delivery/Ads';
import type { Restaurant } from '@/lib/delivery';

/** Un restaurante patrocinado para mostrar en el inicio (cambia cada 30 min si hay varios). */
export function useSponsoredRestaurant(enabled = true): Restaurant | null {
  const [list, setList] = useState<Restaurant[] | null>(null);
  // La hora se fija al llegar la lista (no durante el dibujado), para que el anuncio no cambie solo en cada re-render.
  const [slot, setSlot] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    return deliveryService.subscribeRestaurants((l) => { setSlot(Math.floor(Date.now() / 1800000)); setList(l); }, () => setList([]));
  }, [enabled]);
  const pool = sponsored(list).filter((r) => !!r.coverUrl);
  return pool.length ? pool[slot % pool.length] : null;
}
