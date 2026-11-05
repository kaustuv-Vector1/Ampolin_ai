const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');

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

// 1. Groq Cloud Engine
async function callGroq(prompt, history, modelName = 'openai/gpt-oss-120b') {
  if (!GROQ_KEY) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

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

// 2. Gemini Cloud Engine
async function callGemini(prompt, history) {
  if (!GEMINI_KEY) return null;
  const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const contents = [
        ...history.slice(-10).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ];

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
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
            model: model
          };
        }
      }
    } catch (err) {
      console.error(`[Functions Gemini Error on ${model}]:`, err.message);
    }
  }
  return null;
}

// Route: /api/chat or /chat
app.post(['/api/chat', '/chat'], async (req, res) => {
  const { message, model = 'Ampolin Opus 3.5', history = [] } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  let result = null;
  if (model.toLowerCase().includes('gemini')) {
    result = await callGemini(message, history) || await callGroq(message, history, model);
  } else {
    result = await callGroq(message, history, model);
    if (!result) result = await callGemini(message, history);
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
    groq: Boolean(GROQ_KEY),
    gemini: Boolean(GEMINI_KEY),
    cloud: 'Firebase 2nd Gen Cloud Functions',
    timestamp: new Date().toISOString()
  });
});

exports.api = onRequest({ cors: true, maxInstances: 10, timeoutSeconds: 60, region: 'us-central1' }, app);
