const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const { AnthropicVertex } = require('@anthropic-ai/vertex-sdk');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const SYSTEM_PROMPT = `You are Ampolin AI, an elite autonomous software engineering agent and computer control intelligence.
Your capabilities:
1. Deep technical reasoning, code architecture, and bug triage.
2. Generating clean, type-safe, production-ready code with diff explanations.
3. Suggesting precise terminal shell commands and OS actions.
Tone: Direct, intellectual, highly competent, clean formatting with markdown.`;

const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// 1. Google Gemini Cloud Engine (Primary: 3.8 Flash with fast fallback to 3.5 Flash)
async function fetchGeminiModel(modelName, timeoutMs, prompt, history) {
  if (!GEMINI_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const contents = [
    ...history.slice(-10).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        return {
          reply: text,
          provider: 'Google Gemini',
          model: modelName.replace('gemini-', 'Gemini ').replace('-preview', '')
        };
      }
    }
  } catch (err) {
    clearTimeout(timer);
  }
  return null;
}

async function callGemini(prompt, history) {
  if (!GEMINI_KEY) return null;

  // Staggered race: Give Gemini 3.8 Flash 1200ms headstart. If still pending, race with Gemini 3.5 Flash!
  const p38 = fetchGeminiModel('gemini-3.8-flash', 3500, prompt, history);
  const headstart = new Promise(resolve => setTimeout(resolve, 1200));

  const fast38 = await Promise.race([p38, headstart.then(() => null)]);
  if (fast38) return fast38;

  const p35 = fetchGeminiModel('gemini-3.5-flash', 4000, prompt, history);
  const winner = await Promise.race([
    p38.then(r => r || new Promise(() => {})),
    p35.then(r => r || new Promise(() => {})),
    new Promise(r => setTimeout(() => r(null), 4500))
  ]);

  if (winner) return winner;
  return await fetchGeminiModel('gemini-3.5-flash-lite', 3000, prompt, history);
}

// 2. Groq Cloud Engine (Ultra-fast 120B reasoning)
async function callGroq(prompt, history, modelName = 'openai/gpt-oss-120b') {
  if (!GROQ_KEY) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: prompt }
    ];

    const actualModel = modelName && modelName.includes('/') ? modelName : 'openai/gpt-oss-120b';

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: actualModel,
        messages: messages,
        temperature: 0.3,
        max_tokens: 4096
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        reply: data?.choices?.[0]?.message?.content?.trim() || null,
        provider: 'Groq Cloud',
        model: actualModel
      };
    }
  } catch (err) {
    console.error('[Functions Groq Error]:', err.message);
  }
  return null;
}

// 3. Optional Claude Vertex (Single fast call, no hanging loops)
async function callClaude(prompt, history) {
  try {
    const client = new AnthropicVertex({ region: 'us-east5', projectId: 'ampolin-ai' });
    const res = await client.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        ...history.slice(-10).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
        })),
        { role: 'user', content: prompt }
      ]
    });
    if (res?.content?.[0]?.text) {
      return {
        reply: res.content[0].text.trim(),
        provider: 'Anthropic Claude (Vertex AI)',
        model: 'Claude Sonnet 5.5'
      };
    }
  } catch (err) {
    console.error('[Claude Vertex single call failed]:', err.message);
  }
  return null;
}

// Route: /api/chat or /chat
app.post(['/api/chat', '/chat'], async (req, res) => {
  const { message, model = 'Gemini 3.8 Flash', history = [] } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const modelLower = (model || '').toLowerCase();
  let result = null;

  // Primary: Gemini 3.8 Flash (with 3.5 Flash & Groq failover)
  if (modelLower.includes('gemini') || !model) {
    result = await callGemini(message, history);
    if (!result) result = await callGroq(message, history, 'openai/gpt-oss-120b');
  } else if (modelLower.includes('groq') || modelLower.includes('opus')) {
    result = await callGroq(message, history, 'openai/gpt-oss-120b');
    if (!result) result = await callGemini(message, history);
  } else if (modelLower.includes('claude') || modelLower.includes('sonnet')) {
    result = await callClaude(message, history);
    if (!result) result = await callGemini(message, history);
    if (!result) result = await callGroq(message, history, 'openai/gpt-oss-120b');
  } else {
    result = await callGemini(message, history);
    if (!result) result = await callGroq(message, history, model);
  }

  if (!result || !result.reply) {
    return res.status(500).json({ error: 'Failed to synthesize response from cloud models.' });
  }

  return res.json({
    success: true,
    reply: result.reply,
    provider: result.provider,
    model: result.model
  });
});

// Route: /api/health or /health
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'online',
    primaryModel: 'Google Gemini 3.8 Flash',
    gemini: Boolean(GEMINI_KEY),
    groq: Boolean(GROQ_KEY),
    cloud: 'Firebase 2nd Gen Cloud Functions',
    timestamp: new Date().toISOString()
  });
});

exports.api = onRequest({ cors: true, maxInstances: 10, timeoutSeconds: 60, region: 'us-central1' }, app);
