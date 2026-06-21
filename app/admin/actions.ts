'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, type NewPost, type Chapter, type Guest } from '@/db/schema';
import { auth, signOut as authSignOut } from '@/lib/auth';
import { postVersions } from '@/db/schema';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/admin/signin');
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}
function optStr(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s ? s : null;
}
function optNum(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function bool(v: FormDataEntryValue | null): boolean {
  return str(v) === 'on' || str(v) === 'true';
}
function jsonArray<T>(v: FormDataEntryValue | null): T[] | null {
  const s = str(v);
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export async function savePost(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = optNum(formData.get('id'));
  const kind: 'episode' | 'article' =
    str(formData.get('kind')) === 'episode' ? 'episode' : 'article';
  const status: 'draft' | 'published' =
    str(formData.get('status')) === 'published' ? 'published' : 'draft';
  const nowIso = new Date().toISOString();

  const tags = str(formData.get('tags'))
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const base = {
    kind,
    title: str(formData.get('title')),
    slug: str(formData.get('slug')),
    body: str(formData.get('body')),
    excerpt: optStr(formData.get('excerpt')),
    coverImage: optStr(formData.get('coverImage')),
    tags,
    status,
    featured: bool(formData.get('featured')),
    seoTitle: optStr(formData.get('seoTitle')),
    seoDescription: optStr(formData.get('seoDescription')),
    updatedAt: nowIso,
  };

  const episodeFields =
    kind === 'episode'
      ? {
          audioUrl: optStr(formData.get('audioUrl')),
          audioDuration: optNum(formData.get('audioDuration')),
          audioByteSize: optNum(formData.get('audioByteSize')),
          audioMimeType: optStr(formData.get('audioMimeType')) ?? 'audio/mpeg',
          episodeNumber: optNum(formData.get('episodeNumber')),
          seasonNumber: optNum(formData.get('seasonNumber')),
          episodeType:
            (['full', 'trailer', 'bonus'].find((t) => t === str(formData.get('episodeType'))) as
              | 'full'
              | 'trailer'
              | 'bonus'
              | undefined) ?? 'full',
          explicit: bool(formData.get('explicit')),
          transcript: optStr(formData.get('transcript')),
          chapters: jsonArray<Chapter>(formData.get('chapters')),
          guests: jsonArray<Guest>(formData.get('guests')),
          episodeArtwork: optStr(formData.get('episodeArtwork')),
        }
      : {};

  if (id) {
    // Snapshot the current row into version history before mutating.
    const current = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
    if (current) {
      await db.insert(postVersions).values({ postId: id, snapshot: current });
      // publishedAt is set once, on first publish, and never moved.
      const publishedAt =
        status === 'published' ? (current.publishedAt ?? nowIso) : current.publishedAt;
      await db
        .update(posts)
        .set({ ...base, ...episodeFields, publishedAt })
        .where(eq(posts.id, id));
    }
  } else {
    const guid =
      kind === 'episode' ? `germomics:${crypto.randomUUID()}` : null;
    const values: NewPost = {
      ...base,
      ...episodeFields,
      guid,
      publishedAt: status === 'published' ? nowIso : null,
      createdAt: nowIso,
    };
    await db.insert(posts).values(values);
  }

  revalidatePath('/', 'layout');
  redirect('/admin');
}

export async function deletePost(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = optNum(formData.get('id'));
  if (id) {
    await db.delete(posts).where(eq(posts.id, id));
    revalidatePath('/', 'layout');
  }
  redirect('/admin');
}

export async function signOutAction(): Promise<void> {
  await authSignOut({ redirectTo: '/admin/signin' });
}
