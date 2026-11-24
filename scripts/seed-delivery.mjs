#!/usr/bin/env node
/**
 * Restaurantes de DEMOSTRACIÓN para probar el Delivery (marcados "demo").
 * El administrador los borra o reemplaza desde /admin → Delivery → Restaurantes y menú.
 *
 *   node scripts/seed-delivery.mjs        crea o actualiza los de demostración
 *   node scripts/seed-delivery.mjs --remove   borra solo los de demostración
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const account = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString());
const db = getFirestore(initializeApp({ credential: cert(account), projectId: account.project_id }));

const U = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const o = (name, extra = 0) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20), name, extra });

const RESTAURANTS = [
  {
    id: 'demo-broaster', name: 'Broaster Amazonía', category: 'Pollo', demo: true, active: true, open: true,
    description: 'Pollo broaster crocante, papas y ají de la casa', coverUrl: U('1626645738196-c2a7c87a8f58'),
    address: 'Av. Sucre, cerca de la plaza', lat: -11.0049, lng: -66.0621, phone: '+59170000001', hours: '11:00 - 22:30', prepMinutes: 20, minOrder: 25, rating: 4.7,
    items: [
      { name: 'Pollo broaster', category: 'Combos', price: 38, desc: 'Presa de pollo crocante con papas fritas y ensalada.', photo: '1626645738196-c2a7c87a8f58', sizes: [o('1 presa'), o('2 presas', 22), o('Cuarto de pollo', 45)], extras: [o('Papas extra', 8), o('Gaseosa 500 ml', 7)], sauces: [o('Ají de la casa'), o('Mayonesa'), o('Kétchup')] },
      { name: 'Alitas picantes', category: 'Combos', price: 32, desc: '8 alitas bañadas en salsa picante con papas.', photo: '1527477396000-e27163b481c2', extras: [o('Papas extra', 8)], sauces: [o('Ají'), o('Barbacoa')] },
      { name: 'Tiras de pollo crocantes', category: 'Para picar', price: 26, desc: 'Tiras de pollo apanado con salsa de la casa.', photo: '1562967914-608f82629710', extras: [o('Papas', 8)], sauces: [o('Ají'), o('Mayonesa')] },
      { name: 'Jugo natural', category: 'Bebidas', price: 12, desc: 'Jugo de fruta fresca, bien frío.', photo: '1600271886742-f049cd451bba', sizes: [o('Vaso'), o('Jarra', 18)] },
    ],
  },
  {
    id: 'demo-burger', name: 'Hamburguesas del Beni', category: 'Hamburguesas', demo: true, active: true, open: true,
    description: 'Hamburguesas grandes con carne de res', coverUrl: U('1568901346375-23c9450c58cd'),
    address: 'Calle Nicolás Suárez', lat: -11.0091, lng: -66.0662, phone: '+59170000002', hours: '17:00 - 23:30', prepMinutes: 18, minOrder: 20, rating: 4.8,
    items: [
      { name: 'Hamburguesa clásica', category: 'Hamburguesas', price: 28, desc: 'Carne de res, queso, lechuga, tomate y salsa de la casa.', photo: '1568901346375-23c9450c58cd', sizes: [o('Simple'), o('Doble carne', 14)], extras: [o('Queso extra', 4), o('Tocino', 6), o('Huevo', 3)], sauces: [o('Mayonesa'), o('Ají'), o('Barbacoa')] },
      { name: 'Hamburguesa BBQ', category: 'Hamburguesas', price: 34, desc: 'Carne, cebolla caramelizada, tocino y salsa barbacoa.', photo: '1572802419224-296b0aeee0d9', sizes: [o('Simple'), o('Doble carne', 14)], extras: [o('Queso extra', 4)] },
      { name: 'Hamburguesa especial', category: 'Hamburguesas', price: 38, desc: 'Doble queso, huevo, tocino y todas las salsas.', photo: '1550317138-10000687a72b', extras: [o('Queso extra', 4), o('Tocino', 6)], sauces: [o('Mayonesa'), o('Ají')] },
      { name: 'Jugo de naranja', category: 'Bebidas', price: 10, desc: 'Recién exprimido.', photo: '1600271886742-f049cd451bba' },
    ],
  },
  {
    id: 'demo-pizza', name: 'Pizzería La Castaña', category: 'Pizza', demo: true, active: true, open: false,
    description: 'Pizzas al horno de barro y pastas', coverUrl: U('1513104890138-7c749659a591'),
    address: 'Av. Dr. Martín Cardenas', lat: -11.0102, lng: -66.0588, phone: '+59170000003', hours: '18:00 - 23:00', prepMinutes: 25, minOrder: 40, rating: 4.6,
    items: [
      { name: 'Pizza margarita', category: 'Pizzas', price: 45, desc: 'Salsa de tomate, mozzarella y albahaca.', photo: '1513104890138-7c749659a591', sizes: [o('Personal'), o('Mediana', 20), o('Familiar', 40)], extras: [o('Queso extra', 8), o('Champiñones', 6)] },
      { name: 'Pizza de pollo', category: 'Pizzas', price: 52, desc: 'Pollo, cebolla, mozzarella y orégano.', photo: '1565299624946-b28f40a0ae38', sizes: [o('Personal'), o('Mediana', 20), o('Familiar', 40)], extras: [o('Queso extra', 8)] },
      { name: 'Pasta al pesto', category: 'Pastas', price: 36, desc: 'Fideos con salsa de albahaca y tomate.', photo: '1473093295043-cdd812d0e601', extras: [o('Queso rallado', 4)] },
    ],
  },
  {
    id: 'demo-tienda', name: 'Pulpería Don Beto', kind: 'STORE', category: 'Tienda', demo: true, active: true, open: true,
    description: 'Bebidas, snacks y pan de todos los días', coverUrl: U('1604719312566-8912e9227c6a'),
    address: 'Calle Gonzalo Moreno', lat: -11.0073, lng: -66.0651, phone: '+59170000004', hours: '07:00 - 22:00', prepMinutes: 8, minOrder: 0, rating: 4.9,
    items: [
      { name: 'Coca-Cola 2 L', category: 'Bebidas', price: 14, desc: 'Botella familiar, bien helada.', photo: '1622483767028-3f66f32aef97' },
      { name: 'Coca-Cola 500 ml', category: 'Bebidas', price: 6, desc: 'Botella personal helada.', photo: '1622483767028-3f66f32aef97' },
      { name: 'Agua 600 ml', category: 'Bebidas', price: 4, desc: 'Agua sin gas.', photo: '1548839140-29a749e1cf4d' },
      { name: 'Gaseosa Schweppes 2 L', category: 'Bebidas', price: 13, desc: 'Pomelo, botella familiar.', photo: '1581006852262-e4307cf6283a' },
      { name: 'Papitas fritas', category: 'Snacks', price: 5, desc: 'Bolsa mediana.', photo: '1566478989037-eec170784d0b' },
      { name: 'Galletas de chocolate', category: 'Snacks', price: 3, desc: 'Paquete individual.', photo: '1499636136210-6f4ee915583e' },
      { name: 'Pan (6 unidades)', category: 'Panadería', price: 6, desc: 'Pan fresco del día.', photo: '1509440159596-0249088772ff' },
    ],
  },
];

if (process.argv.includes('--remove')) {
  const rs = await db.collection('restaurants').where('demo', '==', true).get();
  for (const r of rs.docs) {
    const items = await db.collection('menu_items').where('restaurantId', '==', r.id).get();
    const b = db.batch(); items.docs.forEach((d) => b.delete(d.ref)); b.delete(r.ref); await b.commit();
  }
  console.log(`Borrados ${rs.size} restaurantes de demostración.`);
  process.exit(0);
}

for (const { items, ...r } of RESTAURANTS) {
  await db.collection('restaurants').doc(r.id).set(r);
  for (const [i, it] of items.entries()) {
    await db.collection('menu_items').doc(`${r.id}-${i + 1}`).set({
      restaurantId: r.id, name: it.name, description: it.desc, price: it.price, photo: U(it.photo, 700),
      category: it.category, available: true, sizes: it.sizes || [], extras: it.extras || [], sauces: it.sauces || [],
    });
  }
  console.log(`✓ ${r.name} (${items.length} platos)`);
}
process.exit(0);
