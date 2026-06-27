import { redis } from './redis';
import { SavedProject, WorkItem } from '../types';

const PROJECT_PREFIX = 'project:';
const PROJECT_LIST_KEY = 'project_list';

export async function saveProject(project: SavedProject): Promise<void> {
  const exists = await redis.get(`${PROJECT_PREFIX}${project.id}`);
  await redis.set(`${PROJECT_PREFIX}${project.id}`, JSON.stringify(project));
  if (!exists) {
    await redis.lpush(PROJECT_LIST_KEY, project.id);
  }
}

export async function getAllProjects(): Promise<SavedProject[]> {
  const ids = await redis.lrange(PROJECT_LIST_KEY, 0, -1);
  if (!ids || ids.length === 0) return [];

  const projects: SavedProject[] = [];
  for (const id of ids) {
    const raw = await redis.get<string>(`${PROJECT_PREFIX}${id}`);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      projects.push(parsed as SavedProject);
    }
  }
  return projects;
}

export async function getProject(id: string): Promise<SavedProject | null> {
  const raw = await redis.get<string>(`${PROJECT_PREFIX}${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as SavedProject;
}

export async function deleteProject(id: string): Promise<void> {
  await redis.del(`${PROJECT_PREFIX}${id}`);
  await redis.lrem(PROJECT_LIST_KEY, 0, id);
}

// 行単位の更新（複数人同時編集対応）
export async function updateProjectItem(
  projectId: string,
  itemIndex: number,
  patch: Partial<WorkItem>
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;

  project.items[itemIndex] = { ...project.items[itemIndex], ...patch };
  await redis.set(`${PROJECT_PREFIX}${projectId}`, JSON.stringify(project));
}