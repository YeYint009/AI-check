import { NextRequest, NextResponse } from 'next/server';
import { saveProject, getAllProjects, deleteProject } from '../../lib/projects';
import { SavedProject } from '../../types';

export async function GET() {
  const projects = await getAllProjects();
  // 新しい順に並べる
  projects.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const project: SavedProject = await req.json();
  if (!project.id || !project.projectName) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }
  await saveProject(project);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'idが必要です' }, { status: 400 });
  }
  await deleteProject(id);
  return NextResponse.json({ success: true });
}