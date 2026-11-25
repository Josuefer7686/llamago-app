/**
 * Delivery de LlamaGO: tipos y cálculos compartidos entre la app, el servidor y el panel.
 * No lleva secretos ni dependencias de servidor.
 */

export type PlaceKind = 'RESTAURANT' | 'STORE';

/** Planes para que un negocio salga destacado. Se cobran por semana. */
export type AdPlan = 'DESTACADO' | 'PREMIUM';
export const AD_PLANS: Record<AdPlan, { label: string; weekly: number; perks: string }> = {
  DESTACADO: { label: 'Destacado', weekly: 10, perks: 'Etiqueta "Patrocinado", carrusel de recomendados y primero en su categoría' },
  PREMIUM: { label: 'Premium', weekly: 20, perks: 'Todo lo de Destacado + tarjeta "Mientras esperas" + 1 aviso al celular por semana' },
};
/** Dónde se mostró un anuncio (para las estadísticas) */
export const AD_SLOTS = ['carousel', 'list', 'wait', 'home', 'later', 'push'] as const;
export type AdSlot = (typeof AD_SLOTS)[number];
export const MAX_PROMOS_PER_WEEK = 3;

/** Día en Bolivia (UTC-4) como AAAAMMDD, para agrupar las estadísticas. */
export const dayKey = (ms = Date.now()) => new Date(ms - 4 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');

/** Plan vigente de un negocio (null si no tiene o ya venció). */
export const activePlan = (r?: Pick<Restaurant, 'plan' | 'planUntilMs'> | null, now = Date.now()): AdPlan | null =>
  r?.plan && (r.planUntilMs || 0) > now && r.plan in AD_PLANS ? r.plan : null;

export interface Restaurant {
  id: string;
  /** RESTAURANT = comida preparada; STORE = tienda o pulpería (productos del estante). Sin dato = restaurante. */
  kind?: PlaceKind;
  name: string;
  description: string;
  /** Categoría principal para los filtros (ver DELIVERY_CATEGORIES) */
  category: string;
  coverUrl: string;
  logoUrl?: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  hours?: string;
  /** Abierto ahora (lo cambia el administrador) */
  open: boolean;
  /** Visible en la app */
  active: boolean;
  prepMinutes: number;
  minOrder?: number;
  rating?: number;
  demo?: boolean;
  /** Plan de publicidad pagado (por semana). Vale solo mientras `planUntilMs` sea futuro. */
  plan?: AdPlan;
  planUntilMs?: number;
  /** Texto corto del anuncio (si falta, se usa la descripción) */
  adHeadline?: string;
}

export interface ItemOption {
  id: string;
  name: string;
  /** Costo adicional en Bs (0 = incluido) */
  extra: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  photo: string;
  category: string;
  available: boolean;
  /** Tamaño: se elige uno */
  sizes?: ItemOption[];
  /** Extras: se eligen varios */
  extras?: ItemOption[];
  /** Salsas: se eligen varias */
  sauces?: ItemOption[];
}

export interface CartLine {
  key: string;
  itemId: string;
  name: string;
  photo: string;
  qty: number;
  /** Precio de una unidad con tamaño, extras y salsas incluidos */
  unitPrice: number;
  sizeId?: string;
  extraIds: string[];
  sauceIds: string[];
  optionsLabel: string;
  notes: string;
}

export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
export type DeliveryPayment = 'CASH' | 'QR';

export interface OrderItem {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  optionsLabel: string;
  notes: string;
}

export interface DeliveryOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone?: string;
  restaurantLoc: { lat: number; lng: number };
  items: OrderItem[];
  subtotal: number;
  /** Lo que gana el repartidor por el envío (siempre el precio normal) */
  /** De qué anuncio vino el pedido (si lo hizo después de tocar uno) */
  adRef?: AdSlot;
  deliveryFee: number;
  /** Lo que paga el cliente por el envío (en la promoción de bienvenida es menos que deliveryFee) */
  customerFee?: number;
  /** Pedido de la promoción de bienvenida: LlamaGO cubre la diferencia */
  promo?: boolean;
  /** Extra que el cliente ofreció al repartidor (va 100 % para él) */
  tip?: number;
  total: number;
  distanceKm: number;
  address: { text: string; reference: string; lat: number; lng: number };
  paymentMethod: DeliveryPayment;
  note: string;
  status: OrderStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  driverLoc?: { lat: number; lng: number; at: number };
  createdAtMs: number;
  acceptedAtMs?: number;
  pickedUpAtMs?: number;
  deliveredAtMs?: number;
  cancelledAtMs?: number;
  cancelReason?: string;
}

/** Versión pública (sin teléfono ni ubicación exacta) que ven los conductores antes de aceptar. */
export interface OpenOrder {
  id: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLoc: { lat: number; lng: number };
  addressText: string;
  destLoc: { lat: number; lng: number };
  itemsCount: number;
  itemsSummary: string;
  deliveryFee: number;
  total: number;
  promo?: boolean;
  /** Parte del envío que el repartidor recibe como crédito (promo de bienvenida) */
  gift?: number;
  paymentMethod: DeliveryPayment;
  distanceKm: number;
  createdAtMs: number;
}

export const isStore = (r?: Pick<Restaurant, 'kind'> | null) => r?.kind === 'STORE';

export const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PICKED_UP'];
export const isActiveOrder = (o?: Pick<DeliveryOrder, 'status'> | null) => !!o && ACTIVE_STATUSES.includes(o.status);

export const DELIVERY_CATEGORIES = [
  'Todos', 'Pollo', 'Hamburguesas', 'Pizza', 'Salteñas', 'Almuerzos', 'Pescado', 'Bebidas', 'Postres',
] as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Buscando repartidor',
  ACCEPTED: 'Preparando tu pedido',
  PICKED_UP: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

/** Montos que el cliente puede sumar al envío, y el tope total de extra por pedido. */
export const TIP_OPTIONS = [2, 5, 10] as const;
export const MAX_TIP = 20;
export const MAX_ITEM_QTY = 20;
export const MAX_NOTE = 140;
export const COMMISSION_BS = 1;

/** Distancia entre dos puntos en km (Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kilómetros por calle: la línea recta más un 30 % (en Riberalta las calles son una cuadrícula). */
export const roadKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.round(distanceKm(a, b) * 1.3 * 10) / 10;

/** Costo de envío en Bs: base 3 + 1,5 por km, mínimo 7 y máximo 40, siempre entero (más barato que la competencia, que cobra 10-20 Bs). */
export function deliveryFeeFor(km: number): number {
  return Math.min(40, Math.max(7, Math.round(3 + 1.5 * km)));
}

/**
 * Promoción de bienvenida: los primeros pedidos del cliente tienen el envío a MITAD de precio.
 * La otra mitad (máx. Bs 10) NO es plata de LlamaGO: se le da al repartidor como CRÉDITO en su billetera
 * (sirve para pagar comisiones dentro de la app, no se puede retirar en efectivo).
 */
export const PROMO_ORDERS = 5;
export const PROMO_MAX_GIFT = 10;
export const promoGift = (fee: number) => Math.min(PROMO_MAX_GIFT, Math.floor(fee / 2));
export const promoCustomerFee = (fee: number) => fee - promoGift(fee);

export const bs = (n: number) => `Bs ${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Precio de una unidad según lo elegido; ignora ids que no existan en el producto. */
export function unitPriceFor(item: MenuItem, sizeId: string | undefined, extraIds: string[], sauceIds: string[]) {
  const size = item.sizes?.find((s) => s.id === sizeId);
  const extras = (item.extras || []).filter((e) => extraIds.includes(e.id));
  const sauces = (item.sauces || []).filter((s) => sauceIds.includes(s.id));
  const unit = item.price + (size?.extra || 0) + extras.reduce((t, e) => t + e.extra, 0) + sauces.reduce((t, s) => t + s.extra, 0);
  const label = [size?.name, ...extras.map((e) => e.name), ...sauces.map((s) => s.name)].filter(Boolean).join(' · ');
  return { unit: Math.round(unit * 100) / 100, label, sizeId: size?.id, extraIds: extras.map((e) => e.id), sauceIds: sauces.map((s) => s.id) };
}

/** Distancia de la persona al restaurante, para ordenar y mostrar "a 1,2 km". */
export const fmtKm = (km: number) => `${km.toFixed(1).replace('.', ',')} km`;
