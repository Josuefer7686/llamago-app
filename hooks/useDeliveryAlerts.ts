'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { deliveryService } from '@/services/deliveryService';
import { isActiveOrder, type DeliveryOrder, type OpenOrder } from '@/lib/delivery';
import { audio } from '@/utils/audio';
import { haptics } from '@/utils/haptics';

/**
 * Estado de delivery para la barra inferior (punto en la pestaña) y para avisar al repartidor
 * cuando entra un pedido nuevo. Una sola suscripción por sesión de la app.
 */
export function useDeliveryAlerts(sound = false) {
  const user = useAppStore((s) => s.user);
  const role = useAppStore((s) => s.role);
  const [mine, setMine] = useState<DeliveryOrder[]>([]);
  const [open, setOpen] = useState<OpenOrder[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    const off = role === 'DRIVER'
      ? deliveryService.subscribeDriverOrders(user.id, setMine)
      : deliveryService.subscribeMyOrders(user.id, setMine);
    return off;
  }, [user?.id, role]);

  useEffect(() => {
    if (role !== 'DRIVER' || !sound) return;
    seen.current = null;
    return deliveryService.subscribeOpenOrders(setOpen);
  }, [role, sound]);

  const active = mine.find(isActiveOrder) || null;
  useEffect(() => { busyRef.current = !!active; }, [active]);

  // Suena solo con pedidos nuevos (no con los que ya estaban al abrir) y si el repartidor está libre.
  useEffect(() => {
    if (role !== 'DRIVER' || !sound) return;
    const ids = new Set(open.map((o) => o.id));
    if (seen.current && !busyRef.current) {
      const fresh = open.some((o) => !seen.current!.has(o.id));
      if (fresh) { try { audio.driverIncomingRequest(); haptics.notification(); } catch { /* sin audio hasta el primer toque */ } }
    }
    seen.current = ids;
  }, [open, role, sound]);

  return { active, mine, openCount: role === 'DRIVER' && !active ? open.length : 0 };
}
