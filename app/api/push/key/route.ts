import { NextResponse } from 'next/server';
import { pushPublicKey } from '@/lib/push';

export const runtime = 'nodejs';

export async function GET() {
  const key = pushPublicKey();
  return key ? NextResponse.json({ key }) : NextResponse.json({ error: 'No disponible' }, { status: 503 });
}
