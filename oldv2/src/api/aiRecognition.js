export const MODELS = [
  { id: 'openai/gpt-4o-mini',           label: 'GPT-4o mini (OpenRouter)' },
  { id: 'openai/gpt-4o',                label: 'GPT-4o (OpenRouter)' },
  { id: 'anthropic/claude-haiku-4-5',   label: 'Claude Haiku 4.5 (OpenRouter)' },
  { id: 'google/gemini-flash-1.5',      label: 'Gemini Flash 1.5 (OpenRouter)' },
  { id: 'gpt-4o-mini',                  label: 'GPT-4o mini (OpenAI direkt)' },
  { id: 'gpt-4o',                       label: 'GPT-4o (OpenAI direkt)' },
];

const PROMPT = `Look at this Pokémon TCG card image. Return ONLY a JSON object — no markdown, no explanation:
{
  "name": "card name as printed",
  "nameEn": "English name of the card",
  "setAbbr": "Cardmarket set abbreviation if visible (e.g. ASC, PAF, SV1)",
  "cardNumber": "card number as printed (e.g. 269, 001)",
  "language": "de|en|ja|fr|es|it|pt|zh-hans|ko",
  "rarity": "rarity string or null",
  "confidence": "high|medium|low"
}`;

export async function recognizeCard(imageBase64, { apiKey, model, baseUrl }) {
  if (!apiKey) throw new Error('Kein API-Key konfiguriert. Bitte unter Verwaltung → KI-Einstellungen hinterlegen.');

  const url = (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(url.includes('openrouter') ? { 'HTTP-Referer': 'https://pokecapital.app' } : {}),
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
        ],
      }],
      max_tokens: 300,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API-Fehler ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('KI hat kein gültiges JSON zurückgegeben.');

  return JSON.parse(match[0]);
}

export function resizeImageToBase64(file, maxPx = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
