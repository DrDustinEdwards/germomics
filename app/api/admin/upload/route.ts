// Authenticated audio upload to R2 (MEDIA -> germomics-audio). Byte size is captured here;
// duration is read client-side and submitted with the post form. Returns the permanent
// media.germomics.com URL used for the RSS enclosure.

import { auth } from '@/lib/auth';
import { putMedia } from '@/lib/r2';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file' }, { status: 400 });
  }

  const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'audio';
  const ext = file.name.match(/\.[^.]+$/)?.[0] ?? '.mp3';
  const key = `audio/${base}${ext}`;
  const result = await putMedia(key, await file.arrayBuffer(), file.type || 'audio/mpeg');

  return Response.json({ url: result.url, size: result.size, key: result.key });
}
