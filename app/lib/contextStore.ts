import { redis } from './redis';

const CONTEXT_KEY = 'global_check_context';
const IMAGE_CONTEXT_KEY = 'global_image_check_context';

export async function getGlobalContext(): Promise<string | null> {
  const raw = await redis.get<string>(CONTEXT_KEY);
  if (!raw) return null;
  return typeof raw === 'string' ? raw : String(raw);
}

export async function saveGlobalContext(context: string): Promise<void> {
  await redis.set(CONTEXT_KEY, context);
}

export async function getGlobalImageContext(): Promise<string | null> {
  const raw = await redis.get<string>(IMAGE_CONTEXT_KEY);
  if (!raw) return null;
  return typeof raw === 'string' ? raw : String(raw);
}

export async function saveGlobalImageContext(context: string): Promise<void> {
  await redis.set(IMAGE_CONTEXT_KEY, context);
}