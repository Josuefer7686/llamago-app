'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, Copy, ImagePlus, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { AD_PLANS, DELIVERY_CATEGORIES, STATUS_LABEL, activePlan, bs, isStore, type AdPlan, type MenuItem, type OrderStatus, type Restaurant } from '@/lib/delivery';
import { compressToLimit } from '@/lib/imageUtils';

type ActiveOrder = { id: string; restaurantName: string; customerName: string; status: OrderStatus; total: number; createdAtMs: number; driverName: string };

const input = 'h-11 w-full rounded-xl border border-white/10 bg-surface-2 px-3 text-[15px] text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-text-secondary';

async function api(method: 'GET' | 'POST', body?: unknown, qs = ''): Promise<any> {
  const r = await fetch(`/api/admin/delivery${qs}`, {
    method, cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) throw new Error('UNAUTHORIZED');
  return r.json();
}

function Switch({ on, onChange, label: l }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={l} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-white/20'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function PhotoField({ value, onChange, text }: { value: string; onChange: (v: string) => void; text: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true); setErr('');
    try { onChange(await compressToLimit(f, 1000, 150_000)); } catch { setErr('No se pudo usar esa foto.'); }
    setBusy(false);
  };
  return (
    <div>
      <span className={label}>{text}</span>
      <label className="flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-surface-2 text-text-secondary hover:border-gold-primary/50">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm"><ImagePlus className="h-6 w-6" aria-hidden /> {busy ? 'Procesando…' : 'Subir foto'}</span>
        )}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <div className="mt-1.5 flex items-center justify-between text-xs text-text-secondary">
        <span>{busy ? 'Procesando…' : value ? 'Toca la foto para cambiarla' : 'JPG o PNG, se reduce sola'}</span>
        {value && <button type="button" onClick={() => onChange('')} className="font-semibold text-red-300">Quitar</button>}
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-red-300">{err}</p>}
    </div>
  );
}

const optsToText = (o?: { name: string; extra: number }[]) => (o || []).map((x) => `${x.name}, ${x.extra}`).join('\n');
const textToOpts = (t: string) =>
  t.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12).map((l, i) => {
    const [name, extra] = l.split(',').map((p) => p.trim());
    return { id: `o${i + 1}`, name, extra: Number(extra) || 0 };
  });

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-extrabold">{title}</h2><button onClick={onClose} className="h-10 rounded-xl border border-white/10 px-3 text-sm font-semibold">Cerrar</button></div>
        {children}
      </div>
    </div>
  );
}

function RestaurantForm({ initial, onDone }: { initial: Partial<Restaurant>; onDone: () => void }) {
  const [f, setF] = useState({
    kind: initial.kind === 'STORE' ? 'STORE' : 'RESTAURANT', name: initial.name || '', description: initial.description || '', category: initial.category || 'Almuerzos',
    coverUrl: initial.coverUrl || '', address: initial.address || '', coords: initial.lat ? `${initial.lat}, ${initial.lng}` : '',
    phone: initial.phone || '', hours: initial.hours || '', prepMinutes: String(initial.prepMinutes ?? 20), minOrder: String(initial.minOrder ?? ''),
    rating: String(initial.rating ?? ''), open: initial.open ?? true, active: initial.active ?? true, adHeadline: initial.adHeadline || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const m = f.coords.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) { setErr('Pega las coordenadas como en Google Maps. Ej.: -11.0067, -66.0642'); return; }
    setBusy(true); setErr('');
    const r = await api('POST', {
      action: 'saveRestaurant',
      restaurant: { ...f, id: initial.id, lat: Number(m[1].replace(',', '.')), lng: Number(m[2].replace(',', '.')), demo: initial.demo && !initial.id ? true : false },
    }).catch(() => ({ ok: false, error: 'Sin conexión.' }));
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'No se pudo guardar.'); return; }
    onDone();
  };

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Tipo de negocio</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de negocio">
          {([['RESTAURANT', 'Restaurante (comida preparada)'], ['STORE', 'Tienda o pulpería (productos)']] as const).map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set('kind', k)}
              className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${f.kind === k ? 'border-gold-primary bg-gold-primary/10 text-gold-light' : 'border-white/10 text-white/80'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div><label className={label}>Nombre</label><input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={60} /></div>
      <div><label className={label}>Descripción corta</label><input className={input} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={160} placeholder="Ej.: Pollo broaster y papas crocantes" /></div>
      <div className="grid grid-cols-2 gap-3">
        {f.kind === 'RESTAURANT' ? (
          <div><label className={label}>Categoría</label>
            <select className={input} value={f.category} onChange={(e) => set('category', e.target.value)}>{DELIVERY_CATEGORIES.filter((c) => c !== 'Todos').map((c) => <option key={c}>{c}</option>)}</select></div>
        ) : <div />}
        <div><label className={label}>Tiempo de preparación (min)</label><input className={input} inputMode="numeric" value={f.prepMinutes} onChange={(e) => set('prepMinutes', e.target.value)} /></div>
      </div>
      <div>
        <label className={label}>Frase del anuncio (opcional)</label>
        <input className={input} value={f.adHeadline} onChange={(e) => set('adHeadline', e.target.value)} maxLength={70} placeholder="Ej.: Las mejores hamburguesas de Riberalta" />
        <p className="mt-1.5 text-xs text-text-secondary">Se muestra en el carrusel y en “Mientras esperas” cuando el negocio tiene plan. Si la dejas vacía se usa la descripción.</p>
      </div>
      <PhotoField value={f.coverUrl} onChange={(v) => set('coverUrl', v)} text="Foto de portada" />
      <div><label className={label}>Dirección</label><input className={input} value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={120} placeholder="Calle y barrio" /></div>
      <div>
        <label className={label}>Ubicación en el mapa</label>
        <input className={input} value={f.coords} onChange={(e) => set('coords', e.target.value)} placeholder="-11.0067, -66.0642" />
        <p className="mt-1.5 text-xs text-text-secondary">En Google Maps mantén presionado el local y copia los números que aparecen arriba. Con eso se calcula el envío.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>WhatsApp / teléfono</label><input className={input} inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+59171234567" /></div>
        <div><label className={label}>Horario</label><input className={input} value={f.hours} onChange={(e) => set('hours', e.target.value)} placeholder="11:00 - 22:00" /></div>
        <div><label className={label}>Pedido mínimo (Bs)</label><input className={input} inputMode="decimal" value={f.minOrder} onChange={(e) => set('minOrder', e.target.value)} placeholder="0" /></div>
        <div><label className={label}>Calificación (1 a 5)</label><input className={input} inputMode="decimal" value={f.rating} onChange={(e) => set('rating', e.target.value)} placeholder="4.8" /></div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3"><span className="text-[15px] font-semibold">Abierto ahora</span><Switch on={f.open} onChange={(v) => set('open', v)} label="Abierto ahora" /></div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3"><span className="text-[15px] font-semibold">Visible en la app</span><Switch on={f.active} onChange={(v) => set('active', v)} label="Visible en la app" /></div>
      {err && <p role="alert" className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button onClick={save} disabled={busy} className="h-12 w-full rounded-xl bg-gold-primary font-black text-background disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar restaurante'}</button>
    </div>
  );
}

function ItemForm({ restaurantId, initial, categories, onDone }: { restaurantId: string; initial: Partial<MenuItem>; categories: string[]; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial.name || '', description: initial.description || '', price: String(initial.price ?? ''), photo: initial.photo || '',
    category: initial.category || categories[0] || 'Platos', available: initial.available ?? true,
    sizes: optsToText(initial.sizes), extras: optsToText(initial.extras), sauces: optsToText(initial.sauces),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setErr('');
    const r = await api('POST', {
      action: 'saveItem',
      item: { id: initial.id, restaurantId, name: f.name, description: f.description, price: Number(f.price.replace(',', '.')), photo: f.photo, category: f.category, available: f.available, sizes: textToOpts(f.sizes), extras: textToOpts(f.extras), sauces: textToOpts(f.sauces) },
    }).catch(() => ({ ok: false, error: 'Sin conexión.' }));
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'No se pudo guardar.'); return; }
    onDone();
  };

  return (
    <div className="space-y-4">
      <div><label className={label}>Nombre del plato</label><input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={60} /></div>
      <div><label className={label}>Descripción</label><input className={input} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={140} placeholder="Qué lleva, cómo viene" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Precio (Bs)</label><input className={input} inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} /></div>
        <div><label className={label}>Sección del menú</label><input className={input} list="cats" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Ej.: Combos" /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
      </div>
      <PhotoField value={f.photo} onChange={(v) => set('photo', v)} text="Foto del plato" />
      <div className="rounded-xl bg-surface-2 p-4 text-sm">
        <p className="mb-3 font-semibold">Opciones (una por línea: <span className="text-gold-primary">nombre, costo extra en Bs</span>)</p>
        {([['sizes', 'Tamaños (se elige uno)', 'Personal, 0\nFamiliar, 25'], ['extras', 'Extras (se eligen varios)', 'Queso extra, 5\nHuevo, 3'], ['sauces', 'Salsas (se eligen varias)', 'Ají, 0\nMayonesa, 0']] as const).map(([k, t, ph]) => (
          <div key={k} className="mb-3 last:mb-0"><label className={label}>{t}</label><textarea className="w-full rounded-xl border border-white/10 bg-surface px-3 py-2 text-[15px] text-white placeholder:text-text-secondary focus:border-gold-primary/60 focus:outline-none" rows={2} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} /></div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3"><span className="text-[15px] font-semibold">Disponible</span><Switch on={f.available} onChange={(v) => set('available', v)} label="Disponible" /></div>
      {err && <p role="alert" className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button onClick={save} disabled={busy} className="h-12 w-full rounded-xl bg-gold-primary font-black text-background disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar plato'}</button>
    </div>
  );
}

export function DeliveryManager({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [menuOf, setMenuOf] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [editR, setEditR] = useState<Partial<Restaurant> | null>(null);
  const [editI, setEditI] = useState<Partial<MenuItem> | null>(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'list' | 'results'>('list');
  const [planOf, setPlanOf] = useState<Restaurant | null>(null);

  const guard = useCallback((e: unknown) => { if (e instanceof Error && e.message === 'UNAUTHORIZED') onUnauthorized(); }, [onUnauthorized]);
  const load = useCallback(() => api('GET').then((j) => { if (j.ok) { setRestaurants(j.restaurants); setOrders(j.activeOrders); } }).catch(guard), [guard]);
  const loadItems = useCallback((id: string) => api('GET', undefined, `?restaurantId=${encodeURIComponent(id)}`).then((j) => j.ok && setItems(j.items)).catch(guard), [guard]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y refresco de pedidos activos
  useEffect(() => { load(); const t = window.setInterval(load, 15000); return () => window.clearInterval(t); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- al abrir el menú de un restaurante
  useEffect(() => { setItems(null); if (menuOf) loadItems(menuOf.id); }, [menuOf, loadItems]);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 2500); };
  const act = async (body: unknown, ok: string) => {
    const r = await api('POST', body).catch((e) => { guard(e); return { ok: false, error: 'Sin conexión.' }; });
    flash(r.ok ? ok : r.error || 'No se pudo.');
    return r.ok;
  };

  if (menuOf) {
    const cats = [...new Set((items || []).map((i) => i.category))];
    return (
      <div className="space-y-5">
        <button onClick={() => { setMenuOf(null); load(); }} className="flex h-10 items-center gap-1 text-sm font-semibold text-text-secondary"><ChevronLeft className="h-4 w-4" aria-hidden /> Restaurantes</button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="font-display text-2xl font-extrabold">{menuOf.name}</h1><p className="text-sm text-text-secondary">Menú del restaurante</p></div>
          <button onClick={() => setEditI({})} className="flex h-11 items-center gap-2 rounded-xl bg-gold-primary px-4 text-sm font-black text-background"><Plus className="h-4 w-4" aria-hidden /> Nuevo plato</button>
        </div>
        {items === null && <p className="text-text-secondary">Cargando…</p>}
        {items && !items.length && <p className="rounded-2xl border border-white/10 bg-surface p-6 text-center text-text-secondary">Aún no hay platos. Agrega el primero.</p>}
        <ul className="grid gap-3 md:grid-cols-2">
          {(items || []).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map((i) => (
            <li key={i.id} className="flex gap-3 rounded-2xl border border-white/10 bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.photo ? <img src={i.photo} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-xl bg-surface-2" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{i.name}</p>
                <p className="text-xs text-text-secondary">{i.category} · <span className="text-white">{bs(i.price)}</span></p>
                <div className="mt-2 flex items-center gap-2">
                  <Switch on={i.available} label={`${i.name} disponible`} onChange={async (v) => { if (await act({ action: 'setAvailable', id: i.id, available: v }, v ? 'Disponible' : 'Marcado como agotado')) loadItems(menuOf.id); }} />
                  <span className="text-xs text-text-secondary">{i.available ? 'Disponible' : 'Agotado'}</span>
                  <button onClick={() => setEditI(i)} aria-label="Editar" className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-white/10"><Pencil className="h-4 w-4" aria-hidden /></button>
                  <button onClick={async () => { if (window.confirm(`¿Borrar "${i.name}"?`) && await act({ action: 'deleteItem', id: i.id }, 'Plato borrado')) loadItems(menuOf.id); }} aria-label="Borrar" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-red-300"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {editI && <Modal title={editI.id ? 'Editar plato' : 'Nuevo plato'} onClose={() => setEditI(null)}><ItemForm restaurantId={menuOf.id} initial={editI} categories={cats} onDone={() => { setEditI(null); flash('Plato guardado'); loadItems(menuOf.id); }} /></Modal>}
        {msg && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm shadow-xl">{msg}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-extrabold">Restaurantes, tiendas y menú</h1><p className="mt-1 max-w-xl text-[15px] text-text-secondary">Aquí das de alta los restaurantes y las tiendas o pulperías del Delivery, subes su menú o sus productos y marcas cuándo están abiertos. Lo que cambies se ve al instante en la app.</p></div>
        <button onClick={() => setEditR({})} className="flex h-11 items-center gap-2 rounded-xl bg-gold-primary px-4 text-sm font-black text-background"><Plus className="h-4 w-4" aria-hidden /> Nuevo negocio</button>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Sección">
        {([['list', 'Negocios y menú', null], ['results', 'Publicidad y resultados', BarChart3]] as const).map(([k, t, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${tab === k ? 'border-gold-primary bg-gold-primary/10 text-gold-light' : 'border-white/10 text-white/80'}`}>{Icon && <Icon className="h-4 w-4" aria-hidden />}{t}</button>
        ))}
      </div>

      {tab === 'results' && <Results onUnauthorized={onUnauthorized} />}

      {tab === 'list' && !!orders.length && (
        <section className="rounded-2xl border border-gold-primary/30 bg-gold-primary/5 p-4">
          <h2 className="mb-3 font-display text-base font-extrabold">Pedidos en curso ({orders.length})</h2>
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="font-bold">{o.restaurantName}</span><span className="text-text-secondary">{o.customerName}</span>
                <span className="tabular-nums">{bs(o.total)}</span><span className="text-gold-primary">{STATUS_LABEL[o.status]}{o.driverName ? ` · ${o.driverName}` : ''}</span>
                <button onClick={async () => { if (window.confirm('¿Cancelar este pedido?') && await act({ action: 'cancelOrder', id: o.id }, 'Pedido cancelado')) load(); }} className="ml-auto h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-red-300">Cancelar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'list' && restaurants === null && <p className="text-text-secondary">Cargando…</p>}
      {tab === 'list' && restaurants && !restaurants.length && <p className="rounded-2xl border border-white/10 bg-surface p-8 text-center text-text-secondary">Todavía no hay negocios. Crea el primero con “Nuevo negocio”.</p>}
      {tab === 'list' && <ul className="grid gap-3 lg:grid-cols-2">
        {(restaurants || []).sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
          <li key={r.id} className="flex gap-3 rounded-2xl border border-white/10 bg-surface p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.coverUrl ? <img src={r.coverUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <div className="h-24 w-24 shrink-0 rounded-xl bg-surface-2" />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-bold">{r.name}{isStore(r) && <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-bold text-sky-300">Tienda</span>}{r.demo && <span className="rounded-full bg-gold-primary/15 px-2 py-0.5 text-[11px] font-bold text-gold-primary">Demo</span>}{!r.active && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-text-secondary">Oculto</span>}{activePlan(r) && <span className="rounded-full bg-gold-primary/15 px-2 py-0.5 text-[11px] font-bold text-gold-primary">{AD_PLANS[activePlan(r)!].label} · {daysLeft(r.planUntilMs)} d</span>}</p>
              <p className="truncate text-xs text-text-secondary">{r.category} · {r.address}</p>
              <div className="mt-2 flex items-center gap-2">
                <Switch on={r.open} label={`${r.name} abierto`} onChange={async (v) => { if (await act({ action: 'setOpen', id: r.id, open: v }, v ? 'Abierto' : 'Cerrado')) load(); }} />
                <span className="text-xs text-text-secondary">{r.open ? 'Abierto' : 'Cerrado'}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setMenuOf(r)} className="h-9 rounded-lg bg-white/[0.08] px-3 text-sm font-semibold">Menú</button>
                <button onClick={() => setEditR(r)} className="h-9 rounded-lg border border-white/10 px-3 text-sm font-semibold">Editar</button>
                <button onClick={() => setPlanOf(r)} className="flex h-9 items-center gap-1.5 rounded-lg border border-gold-primary/40 px-3 text-sm font-semibold text-gold-light"><Megaphone className="h-3.5 w-3.5" aria-hidden /> Plan</button>
                <button onClick={() => setPlanOf(r)} className="flex h-9 items-center gap-1.5 rounded-lg border border-gold-primary/40 px-3 text-sm font-semibold text-gold-light"><Megaphone className="h-3.5 w-3.5" aria-hidden /> Plan</button>
                <button onClick={async () => { if (window.confirm(`¿Borrar "${r.name}" y todo su menú? No se puede deshacer.`) && await act({ action: 'deleteRestaurant', id: r.id }, 'Restaurante borrado')) load(); }} aria-label="Borrar restaurante" className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-red-300"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>}

      {editR && <Modal title={editR.id ? 'Editar negocio' : 'Nuevo negocio'} onClose={() => setEditR(null)}><RestaurantForm initial={editR} onDone={() => { setEditR(null); flash('Restaurante guardado'); load(); }} /></Modal>}
      {planOf && <Modal title={`Plan de ${planOf.name}`} onClose={() => setPlanOf(null)}><PlanModal r={planOf} onClose={() => setPlanOf(null)} onDone={(m) => { setPlanOf(null); flash(m); load(); }} /></Modal>}
      {msg && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm shadow-xl">{msg}</div>}
    </div>
  );
}

const daysLeft = (ms?: number) => Math.max(0, Math.ceil(((ms || 0) - Date.now()) / 86400000));
const dateEs = (ms: number) => new Date(ms).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });

function PlanModal({ r, onClose, onDone }: { r: Restaurant; onClose: () => void; onDone: (m: string) => void }) {
  const cur = activePlan(r);
  const [plan, setPlan] = useState<AdPlan>(cur || 'DESTACADO');
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('¿Tienes hambre? 🍔');
  const [body, setBody] = useState(`Pide en ${r.name}${r.adHeadline ? `: ${r.adHeadline}` : ''}`);
  const total = AD_PLANS[plan].weekly * weeks;

  const run = async (payload: unknown, ok: (j: any) => string) => {
    setBusy(true); setErr('');
    const j = await api('POST', payload).catch(() => ({ ok: false, error: 'Sin conexión.' }));
    setBusy(false);
    if (!j.ok) { setErr(j.error || 'No se pudo.'); return; }
    onDone(ok(j));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-surface-2 p-4 text-sm">
        {cur ? <p>Plan actual: <b className="text-gold-primary">{AD_PLANS[cur].label}</b> · vence el {dateEs(r.planUntilMs!)} (faltan {daysLeft(r.planUntilMs)} días)</p> : <p className="text-text-secondary">Este negocio no tiene plan. Aparece normal en la lista, gratis.</p>}
      </div>
      <div>
        <span className={label}>Plan</span>
        <div className="grid gap-2" role="radiogroup" aria-label="Plan">
          {(Object.keys(AD_PLANS) as AdPlan[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={plan === k} onClick={() => setPlan(k)}
              className={`rounded-xl border p-3 text-left ${plan === k ? 'border-gold-primary bg-gold-primary/10' : 'border-white/10'}`}>
              <span className="flex items-baseline justify-between"><b>{AD_PLANS[k].label}</b><span className="font-display font-extrabold text-gold-primary">{bs(AD_PLANS[k].weekly)} / semana</span></span>
              <span className="mt-1 block text-xs text-text-secondary">{AD_PLANS[k].perks}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className={label}>Semanas que pagó</span>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 4, 8].map((w) => <button key={w} type="button" onClick={() => setWeeks(w)} className={`h-11 rounded-xl border font-bold ${weeks === w ? 'border-gold-primary bg-gold-primary/10 text-gold-light' : 'border-white/10'}`}>{w}</button>)}
        </div>
      </div>
      {err && <p role="alert" className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button disabled={busy} onClick={() => { if (window.confirm(`¿Ya te pagó ${bs(total)}? Se activa ${AD_PLANS[plan].label} por ${weeks} semana${weeks > 1 ? 's' : ''} y queda registrado el cobro.`)) void run({ action: 'setPlan', id: r.id, plan, weeks }, () => `Plan ${AD_PLANS[plan].label} activado (${bs(total)})`); }}
        className="h-12 w-full rounded-xl bg-gold-primary font-black text-background disabled:opacity-50">{busy ? 'Guardando…' : `Activar y registrar cobro de ${bs(total)}`}</button>
      {cur && <button disabled={busy} onClick={() => { if (window.confirm('¿Quitar el plan ahora? No se devuelve el cobro registrado.')) void run({ action: 'clearPlan', id: r.id }, () => 'Plan quitado'); }} className="h-11 w-full rounded-xl border border-white/10 text-sm font-semibold text-red-300 disabled:opacity-50">Quitar plan</button>}

      {cur === 'PREMIUM' && (
        <div className="space-y-3 rounded-xl border border-gold-primary/30 bg-gold-primary/5 p-4">
          <p className="flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4 text-gold-primary" aria-hidden /> Aviso al celular (1 por semana)</p>
          <p className="text-xs text-text-secondary">Les llega a los clientes que tienen los avisos activados y no recibieron 3 esta semana. Al tocarlo se abre el menú de este restaurante.</p>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="Título del aviso" />
          <input className={input} value={body} onChange={(e) => setBody(e.target.value)} maxLength={120} aria-label="Texto del aviso" />
          <button disabled={busy} onClick={() => { if (window.confirm('¿Enviar el aviso ahora a los clientes?')) void run({ action: 'sendPromo', id: r.id, title, body }, (j) => `Aviso enviado a ${j.people} personas`); }}
            className="h-11 w-full rounded-xl bg-white/[0.1] font-bold disabled:opacity-50">Enviar aviso ahora</button>
        </div>
      )}
    </div>
  );
}

type Row = { id: string; name: string; plan: AdPlan | null; planUntilMs: number; views: number; clicks: number; later: number; pushes: number; orders: number; adOrders: number; sales: number };

function Results({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<{ income: number; payments: number; rows: Row[] } | null>(null);
  const [copied, setCopied] = useState('');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de resultados al cambiar el período
  useEffect(() => { setData(null); api('GET', undefined, `?stats=1&days=${days}`).then((j) => j.ok && setData(j)).catch((e) => { if (e instanceof Error && e.message === 'UNAUTHORIZED') onUnauthorized(); }); }, [days, onUnauthorized]);

  const rows = (data?.rows || []).filter((r) => r.plan || r.views || r.clicks || r.orders).sort((a, b) => Number(!!b.plan) - Number(!!a.plan) || b.views - a.views);
  const report = (r: Row) => {
    const ctr = r.views ? Math.round((r.clicks / r.views) * 100) : 0;
    return `📊 ${r.name} en LlamaGO — últimos ${days} días\n👀 ${r.views} veces vieron tu anuncio\n👆 ${r.clicks} personas lo tocaron (${ctr}%)\n🛵 ${r.orders} pedidos en total, ${r.adOrders} vinieron directo de tu anuncio\n💰 ${bs(r.sales)} en ventas de comida\n¡Gracias por ser parte de LlamaGO!`;
  };
  const copy = async (r: Row) => { try { await navigator.clipboard.writeText(report(r)); setCopied(r.id); window.setTimeout(() => setCopied(''), 2000); } catch { window.prompt('Copia el informe:', report(r)); } };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Período">
          {[7, 30].map((d) => <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)} className={`h-10 rounded-xl border px-4 text-sm font-bold ${days === d ? 'border-gold-primary bg-gold-primary/10 text-gold-light' : 'border-white/10'}`}>Últimos {d} días</button>)}
        </div>
      </div>
      {!data && <p className="text-text-secondary">Cargando…</p>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gold-primary/30 bg-gold-primary/5 p-4"><p className="text-sm text-text-secondary">Cobrado por planes</p><p className="font-display text-3xl font-extrabold text-gold-primary">{bs(data.income)}</p><p className="text-xs text-text-secondary">{data.payments} cobro{data.payments === 1 ? '' : 's'}</p></div>
            <div className="rounded-2xl border border-white/10 bg-surface p-4"><p className="text-sm text-text-secondary">Vistas de anuncios</p><p className="font-display text-3xl font-extrabold">{data.rows.reduce((t, r) => t + r.views, 0)}</p></div>
            <div className="rounded-2xl border border-white/10 bg-surface p-4"><p className="text-sm text-text-secondary">Pedidos desde anuncios</p><p className="font-display text-3xl font-extrabold">{data.rows.reduce((t, r) => t + r.adOrders, 0)}</p></div>
          </div>
          {!rows.length && <p className="rounded-2xl border border-white/10 bg-surface p-6 text-center text-text-secondary">Todavía no hay datos. Activa un plan a un restaurante y aquí verás sus vistas, toques y pedidos.</p>}
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-extrabold">{r.name}</p>
                  {r.plan ? <span className="rounded-full bg-gold-primary/15 px-2.5 py-0.5 text-xs font-bold text-gold-primary">{AD_PLANS[r.plan].label} · {daysLeft(r.planUntilMs)} días</span> : <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-text-secondary">Sin plan</span>}
                  <button onClick={() => copy(r)} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm font-semibold"><Copy className="h-4 w-4" aria-hidden /> {copied === r.id ? '¡Copiado!' : 'Copiar informe'}</button>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                  {([['Vistas', r.views], ['Toques', r.clicks], ['Guardaron', r.later], ['Pedidos', r.orders], ['De anuncios', r.adOrders], ['Ventas', bs(r.sales)]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-surface-2 py-2"><dd className="font-display text-xl font-extrabold tabular-nums">{v}</dd><dt className="text-[11px] text-text-secondary">{k}</dt></div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
