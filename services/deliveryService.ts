'use client';

import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, where, type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { pushEvent } from '@/services/pushClient';
import type { DeliveryOrder, MenuItem, OpenOrder, Restaurant } from '@/lib/delivery';

export interface DeliveryMessage {
  id: string;
  sender: 'CUSTOMER' | 'DRIVER';
  senderId: string;
  text: string;
  createdAtMs: number;
}

type ApiRes = { ok: boolean; error?: string; id?: string; left?: number };

/** Llama al servidor con la sesión actual. Los precios y los estados los decide el servidor. */
export async function deliveryApi(action: string, payload: Record<string, unknown> = {}): Promise<ApiRes> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { ok: false, error: 'Vuelve a iniciar sesión.' };
    const res = await fetch('/api/delivery/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) return { ok: false, error: json.error || 'No se pudo completar. Intenta otra vez.' };
    return json;
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta otra vez.' };
  }
}

const sub = <T,>(q: ReturnType<typeof query> | ReturnType<typeof doc>, map: (snap: any) => T, cb: (v: T) => void, onErr?: () => void): Unsubscribe =>
  onSnapshot(q as any, (s: any) => cb(map(s)), () => onErr?.());

export const deliveryService = {
  subscribeRestaurants(cb: (list: Restaurant[]) => void, onErr?: () => void) {
    return sub(
      query(collection(db, 'restaurants'), where('active', '==', true)),
      (s) => s.docs.map((d: any) => ({ id: d.id, ...d.data() }) as Restaurant),
      cb, onErr,
    );
  },

  subscribeMenu(restaurantId: string, cb: (items: MenuItem[]) => void, onErr?: () => void) {
    return sub(
      query(collection(db, 'menu_items'), where('restaurantId', '==', restaurantId)),
      (s) => s.docs.map((d: any) => ({ id: d.id, ...d.data() }) as MenuItem),
      cb, onErr,
    );
  },

  /** Pedidos de esta persona como cliente (más nuevo primero). */
  subscribeMyOrders(uid: string, cb: (orders: DeliveryOrder[]) => void, onErr?: () => void) {
    return sub(
      query(collection(db, 'delivery_orders'), where('customerId', '==', uid)),
      (s) => s.docs.map((d: any) => d.data() as DeliveryOrder).sort((a: DeliveryOrder, b: DeliveryOrder) => b.createdAtMs - a.createdAtMs),
      cb, onErr,
    );
  },

  /** Pedidos que lleva este repartidor (más nuevo primero). */
  subscribeDriverOrders(uid: string, cb: (orders: DeliveryOrder[]) => void, onErr?: () => void) {
    return sub(
      query(collection(db, 'delivery_orders'), where('driverId', '==', uid)),
      (s) => s.docs.map((d: any) => d.data() as DeliveryOrder).sort((a: DeliveryOrder, b: DeliveryOrder) => b.createdAtMs - a.createdAtMs),
      cb, onErr,
    );
  },

  subscribeOpenOrders(cb: (orders: OpenOrder[]) => void, onErr?: () => void) {
    return sub(
      collection(db, 'delivery_open') as any,
      (s) => s.docs.map((d: any) => d.data() as OpenOrder).sort((a: OpenOrder, b: OpenOrder) => a.createdAtMs - b.createdAtMs),
      cb, onErr,
    );
  },

  subscribeOrder(orderId: string, cb: (o: DeliveryOrder | null) => void, onErr?: () => void) {
    return sub(doc(db, 'delivery_orders', orderId), (s) => (s.exists() ? (s.data() as DeliveryOrder) : null), cb, onErr);
  },

  subscribeMessages(orderId: string, cb: (m: DeliveryMessage[]) => void) {
    return sub(
      collection(db, 'delivery_orders', orderId, 'messages') as any,
      (s) => s.docs.map((d: any) => ({ id: d.id, ...d.data() }) as DeliveryMessage).sort((a: DeliveryMessage, b: DeliveryMessage) => a.createdAtMs - b.createdAtMs),
      cb,
    );
  },

  async sendMessage(orderId: string, sender: 'CUSTOMER' | 'DRIVER', text: string) {
    const uid = auth.currentUser?.uid;
    const clean = text.trim().slice(0, 300);
    if (!uid || !clean) return false;
    try {
      const ref = await addDoc(collection(db, 'delivery_orders', orderId, 'messages'), {
        sender, senderId: uid, text: clean, createdAtMs: Date.now(), createdAt: serverTimestamp(),
      });
      pushEvent('delivery_chat', orderId, ref.id);
      return true;
    } catch {
      return false;
    }
  },
};
