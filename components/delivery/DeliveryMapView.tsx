'use client';

import dynamic from 'next/dynamic';
import { IosMapLoader } from '@/components/shared/IosMapLoader';

/** Mapa del pedido: se carga solo en el navegador (Leaflet usa `window`). */
export const DeliveryMapView = dynamic(() => import('./DeliveryMap'), { ssr: false, loading: () => <IosMapLoader /> });
