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

// Built-in answers for common questions so the chatbot is useful even with no
// ANTHROPIC_API_KEY configured (as the README promises) or if the API is down.
function localAnswer(message) {
  const m = String(message).toLowerCase();
  if (m.includes('clear') || m.includes('customs') || m.includes('duty') || m.includes('import'))
    return "Importing a car? Use our Customs Clearance page to estimate duty and compare verified clearing agents by rate. Nigerian import charges are roughly 20% duty + 15% NAC levy + 7.5% VAT on the vehicle's CIF value, plus port and agent fees.";
  if (m.includes('buy') || m.includes('purchase'))
    return "To buy a car on 4Kautos:\n1. Browse listings and find your car\n2. Click 'Initiate Purchase'\n3. Schedule an inspection\n4. Payment goes into escrow\n5. Transfer title and receive keys!";
  if (m.includes('escrow'))
    return "Our escrow system protects both buyers and sellers. Your payment is held securely until both parties confirm the transaction is complete — preventing fraud and ensuring a smooth transfer.";
  if (m.includes('list') || m.includes('sell'))
    return "To list your car:\n1. Create a seller account\n2. Open your Profile dashboard\n3. Click 'Add Listing'\n4. Enter make, model, year, mileage, VIN, condition and price\n5. Upload the required photos (front, rear, interior, odometer, engine bay)";
  if (m.includes('document') || m.includes('paper'))
    return "For buying you'll need: valid ID, proof of payment, and (for imports) clearing documents.\nFor selling you'll need: the vehicle title, government-issued ID, and service history if available.";
  return "I can help with buying, selling, escrow, required documents, and importing/customs clearance. What would you like to know?";
}

router.post('/', chatLimiter, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY || req.headers['x-anthropic-key'] || '';
  // No key → serve the offline answer set instead of erroring.
  if (!apiKey) return res.json({ reply: localAnswer(message), source: 'local' });

  // Only forward valid, well-shaped history turns to the API.
  const messages = [
    ...history
      .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
      .slice(-10)
      .map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() },
  ];

  try {
    const apiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
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
      return res.json({ reply: localAnswer(message), source: 'local' }); // graceful degrade
    }

    const data  = await apiRes.json();
    const reply = data.content?.[0]?.text || localAnswer(message);
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.json({ reply: localAnswer(message), source: 'local' });
  }
});

export default router;
