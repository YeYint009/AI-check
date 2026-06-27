import { NextRequest, NextResponse } from 'next/server';
import { updateProjectItem } from '../../../lib/projects';

export async function POST(req: NextRequest) {
  const { projectId, itemIndex, patch } = await req.json();

  if (!projectId || itemIndex === undefined) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  await updateProjectItem(projectId, itemIndex, patch);
  return NextResponse.json({ success: true });
}