import express    from 'express';
import rateLimit  from 'express-rate-limit';

const router = express.Router();
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const chatLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

const SYSTEM_PROMPT = `You are AutoBot, the helpful AI assistant for 4Kautos — a premium preowned car marketplace.

You help users with:
- Searching and filtering car listings (make, model, year, price, mileage)
- Understanding the buying process (browsing → inquiry → inspection → payment in escrow → title transfer)
- Explaining transaction statuses: initiated, pending_inspection, payment_in_escrow, completed, cancelled, disputed
- Advising on what to look for when buying a used car (VIN check, service history, inspection tips)
- Helping sellers list their vehicles (required info: title, make, model, year, mileage, VIN, condition, price, photos)
- Answering general automotive questions

Always be concise, friendly, and professional. If asked about specific listings or account info, remind the user to check their dashboard or browse the listings page.

Do NOT provide financial advice, legal opinions, or make guarantees about vehicle quality.`;

router.post('/', chatLimiter, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

  const messages = [
    ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const apiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || req.headers['x-anthropic-key'] || '',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system:     SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const data  = await apiRes.json();
    const reply = data.content?.[0]?.text || "Sorry, I couldn't generate a response right now.";
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat service error' });
  }
});

export default router;
