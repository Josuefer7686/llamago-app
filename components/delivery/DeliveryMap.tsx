'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

type P = { lat: number; lng: number };

const dot = (html: string, size = 40) =>
  new L.DivIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

const pin = (bg: string, svg: string) =>
  dot(`<div style="width:40px;height:40px;border-radius:14px;background:${bg};border:3px solid #05080B;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.55)">${svg}</div>`);

const ICON = {
  rest: pin('#FFC61A', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#05080B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18M5 11v8h14v-8M7 11V7a5 5 0 0110 0v4"/></svg>'),
  home: pin('#fff', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#05080B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>'),
  driver: dot(`<div style="position:relative;width:44px;height:44px;display:grid;place-items:center"><div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(255,198,26,.35);animation:ping 2s cubic-bezier(0,0,.2,1) infinite"></div><div style="width:40px;height:40px;border-radius:50%;background:#FFC61A;border:3px solid #05080B;display:grid;place-items:center;box-shadow:0 0 18px rgba(255,198,26,.8)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#05080B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M10 9L8 6H5"/></svg></div></div>`, 44),
};

function Fit({ points }: { points: P[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (!points.length) return;
    map.invalidateSize();
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 16);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 17, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function DeliveryMap({ restaurant, home, driver }: { restaurant: P; home: P; driver?: P | null }) {
  const pts = [restaurant, home, ...(driver ? [driver] : [])];
  return (
    <MapContainer center={[home.lat, home.lng]} zoom={15} zoomControl={false} attributionControl={false} className="h-full w-full" style={{ background: '#0B1116' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Polyline positions={[[restaurant.lat, restaurant.lng], [home.lat, home.lng]]} pathOptions={{ color: '#FFC61A', weight: 3, opacity: 0.55, dashArray: '6 8' }} />
      <Marker position={[restaurant.lat, restaurant.lng]} icon={ICON.rest} />
      <Marker position={[home.lat, home.lng]} icon={ICON.home} />
      {driver && <Marker position={[driver.lat, driver.lng]} icon={ICON.driver} zIndexOffset={1000} />}
      <Fit points={pts} />
    </MapContainer>
  );
}
