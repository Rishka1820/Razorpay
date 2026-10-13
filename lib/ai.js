// Reads a pasted chat or a photographed bill into a draft order. The merchant always reviews it.
import { todayIST, addDays } from './format';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const aiLive = !!KEY;

const tool = {
  name: 'record_order',
  description: 'Record the order details found in the chat or bill. Use null when something is not stated. Never guess.',
  input_schema: {
    type: 'object',
    properties: {
      customer_name: { type: ['string', 'null'] },
      phone: { type: ['string', 'null'], description: 'Customer phone number, digits only' },
      item: { type: ['string', 'null'], description: 'What is being made, with key details such as size and fabric' },
      total_inr: { type: ['number', 'null'], description: 'Agreed total price in rupees' },
      advance_received_inr: { type: ['number', 'null'], description: 'Advance already paid. For a chat, only if the text says it was already paid, otherwise 0' },
      advance_method: { type: ['string', 'null'], enum: ['cash', 'upi_personal', 'bank', 'unknown', null] },
      advance_percent_agreed: { type: ['number', 'null'], description: 'Advance percentage the customer agreed to pay, if mentioned' },
      delivery_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      notes: { type: ['string', 'null'], description: 'Address or other details worth keeping' },
    },
    required: ['customer_name', 'phone', 'item', 'total_inr', 'advance_received_inr', 'delivery_date'],
  },
};

export async function parseOrder({ text, image }) {
  if (!KEY) return fallback({ text, image });
  const today = todayIST();
  const content = [];
  if (image) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(image);
    if (!m) throw new Error('That image could not be read');
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  content.push({
    type: 'text',
    text: image
      ? 'This is a photo of a handwritten or printed order bill from a small made-to-order business in India. Read the customer, item, total, advance paid and delivery date.'
      : `Here is a chat with a customer or a pasted customer message:\n\n${text}\n\nExtract the order details.`,
  });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: `You read order details for an Indian made-to-order seller (furniture, home décor). Today is ${today} (India). Resolve dates such as "2 Nov" to the next such date. Amounts are in rupees; "38k" means 38000. Do not invent values: use null when unsure. For a chat, a promise to pay later is not an advance received.`,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'record_order' },
      messages: [{ role: 'user', content }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'The AI reader failed');
  const use = json.content?.find((b) => b.type === 'tool_use');
  if (!use) throw new Error('The AI reader returned nothing');
  return { ...use.input, engine: 'claude' };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function fallback({ text, image }) {
  if (image) {
    return {
      customer_name: 'Rakesh Sharma',
      phone: null,
      item: 'Teak study table, 5 ft',
      total_inr: 24000,
      advance_received_inr: 12000,
      advance_method: 'cash',
      advance_percent_agreed: 50,
      delivery_date: addDays(todayIST(), 12),
      notes: null,
      engine: 'demo',
    };
  }
  const t = text || '';
  const nums = [...t.matchAll(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k)?/gi)].map((m) => Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1));
  const total = nums.length ? Math.max(...nums) : null;
  const phone = (t.match(/(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})/) || [])[1]?.replace(/\D/g, '') || null;
  const name = (t.match(/\]\s*([^:\]\d+][^:\]]*?):/) || [])[1]?.trim() || null;
  const itemRaw = (t.match(/(?:order|confirm)[^:\n]{0,30}:\s*([^,₹\n.]{3,60})/i) || [])[1] || (t.match(/\b((?:[\w-]+\s){0,3}(?:sofa|couch|table|bed|wardrobe|cupboard|console|chair|cabinet|shelf|swing|jhula|mirror|lamp|rug|dresser|bookshelf)s?)\b/i) || [])[1] || null;
  const item = itemRaw ? itemRaw.trim().replace(/^(?:your|the|my|a|an)\s+/i, '') : null;
  let date = null;
  const dm = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  if (dm) {
    const today = todayIST();
    let y = Number(today.slice(0, 4));
    const m = MONTHS.indexOf(dm[2].toLowerCase()) + 1;
    let cand = `${y}-${String(m).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
    if (cand < today) cand = `${y + 1}-${cand.slice(5)}`;
    date = cand;
  }
  const pct = Number((t.match(/(\d{1,3})\s*%/) || [])[1]) || null;
  return {
    customer_name: name,
    phone,
    item,
    total_inr: total,
    advance_received_inr: 0,
    advance_method: null,
    advance_percent_agreed: pct,
    delivery_date: date,
    notes: null,
    engine: 'rules',
  };
}
