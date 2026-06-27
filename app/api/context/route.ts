import { NextRequest, NextResponse } from 'next/server';
import { getGlobalContext, saveGlobalContext } from '../../lib/contextStore';

export async function GET() {
  const context = await getGlobalContext();
  return NextResponse.json({ context });
}

export async function POST(req: NextRequest) {
  const { context } = await req.json();
  if (typeof context !== 'string') {
    return NextResponse.json({ error: 'contextが必要です' }, { status: 400 });
  }
  await saveGlobalContext(context);
  return NextResponse.json({ success: true });
}