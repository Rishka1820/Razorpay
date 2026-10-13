import { route } from '@/lib/http';
import { parseOrder } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const { text, image } = await req.json();
  if (!text?.trim() && !image) throw Object.assign(new Error('Paste a chat or add a photo of the bill'), { status: 400 });
  return { fields: await parseOrder({ text, image }) };
});
