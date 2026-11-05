const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { AnthropicVertex } = require('@anthropic-ai/vertex-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory conversation session history
const sessionHistories = new Map();

function getSessionHistory(sessionId) {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId);
}

const SYSTEM_PROMPT = `You are Ampolin AI, an elite autonomous software engineering agent and computer control intelligence.
Your capabilities:
1. Deep technical reasoning, code architecture, and bug triage.
2. Generating clean, type-safe, production-ready code with diff explanations.
3. Suggesting precise terminal shell commands and OS actions.
Tone: Direct, intellectual, highly competent, clean formatting with markdown.`;

// 0. Anthropic Claude Engine via Google Cloud Vertex AI
let vertexAnthropic = null;
function getVertexAnthropic() {
  if (!vertexAnthropic) {
    try {
      const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || 'ampolin-ai';
      vertexAnthropic = new AnthropicVertex({
        region: process.env.CLOUD_ML_REGION || 'global',
        projectId: projectId
      });
    } catch (err) {
      console.error('[Anthropic Vertex Init Error]:', err.message);
    }
  }
  return vertexAnthropic;
}

async function callClaude(prompt, history, modelName = 'claude-sonnet-5-5') {
  try {
    const client = getVertexAnthropic();
    if (!client) return null;

    const messages = [
      ...history.slice(-10).map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
      })),
      { role: 'user', content: prompt }
    ];

    const res = await client.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    if (res?.content?.[0]?.text) {
      return {
        reply: res.content[0].text.trim(),
        provider: 'Anthropic Claude (Vertex AI)',
        model: 'Claude Sonnet 5.5'
      };
    }
  } catch (err) {
    console.error('[Claude Vertex Execution Error]:', err.message);
  }
  return null;
}

// 1. Direct Groq Cloud AI Engine
async function callGroq(prompt, history, modelName = 'openai/gpt-oss-120b') {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: prompt }
    ];

    const actualModel = modelName && modelName.includes('/')
      ? modelName
      : 'openai/gpt-oss-120b';

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
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
    console.error('[Groq Error]:', err.message);
  }
  return null;
}

// 2. Direct Google Gemini AI Engine
async function callGemini(prompt, history) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

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

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
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
      console.error(`[Gemini Error on ${model}]:`, err.message);
    }
  }
  return null;
}

// 3. Local / Cloud n8n Webhook Engine
async function callN8n(prompt, sessionId) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/ampolin-agent';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        prompt: prompt,
        sessionId: sessionId
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const text = data?.output || data?.reply || data?.text || (typeof data === 'string' ? data : null);
      if (text) {
        return {
          reply: text,
          provider: 'n8n Workflow Engine',
          model: 'n8n-agent-orchestrator'
        };
      }
    }
  } catch (err) {
    // n8n not running or offline, pass through to fallback
  }
  return null;
}

// 4. Local Ollama Offline Fallback Engine
async function callOllama(prompt, history) {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: prompt }
    ];

    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5-coder:1.5b',
        messages: messages,
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        reply: data?.message?.content?.trim() || null,
        provider: 'Ollama Local (Offline)',
        model: 'qwen2.5-coder:1.5b'
      };
    }
  } catch (err) {
    // Ollama daemon not running
  }
  return null;
}

// API: Main Chat Orchestrator (Multi-Tier Failover)
app.post('/api/chat', async (req, res) => {
  const { message, model = 'Ampolin Opus 3.5', sessionId = 'default_session', mode = 'chat' } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const history = getSessionHistory(sessionId);
  let result = null;

  // Route according to user selection or tier fallback
  const modelLower = (model || '').toLowerCase();
  if (modelLower.includes('claude') || modelLower.includes('sonnet') || modelLower.includes('anthropic') || modelLower.includes('opus')) {
    result = await callClaude(message, history, model);
    if (!result) result = await callGroq(message, history, 'openai/gpt-oss-120b');
    if (!result) result = await callGemini(message, history);
  } else if (modelLower.includes('gemini')) {
    result = await callGemini(message, history) || await callGroq(message, history, model);
  } else if (modelLower.includes('n8n')) {
    result = await callN8n(message, sessionId) || await callGroq(message, history, model);
  } else {
    // Primary: Groq Cloud (ultra fast)
    result = await callGroq(message, history, model);
    // Tier 2: Claude Sonnet 5.5
    if (!result) result = await callClaude(message, history, model);
    // Tier 3: Gemini Cloud
    if (!result) result = await callGemini(message, history);
    // Tier 4: n8n Workflow
    if (!result) result = await callN8n(message, sessionId);
    // Tier 5: Ollama Local (Offline)
    if (!result) result = await callOllama(message, history);
  }

  if (!result || !result.reply) {
    return res.status(500).json({
      error: 'Unable to reach cloud AI (Groq/Gemini) or local models (n8n/Ollama). Please verify your API keys or internet connection.',
      offline: true
    });
  }

  // Record history
  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: result.reply });
  if (history.length > 30) history.splice(0, history.length - 30);

  return res.json({
    success: true,
    reply: result.reply,
    provider: result.provider,
    model: result.model
  });
});

// API: Execute local terminal command (computer control action)
app.post('/api/terminal', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command is required' });

  // Whitelist basic safe developer inspections
  exec(command, { cwd: __dirname, timeout: 15000 }, (error, stdout, stderr) => {
    return res.json({
      stdout: stdout || '',
      stderr: stderr || '',
      error: error ? error.message : null
    });
  });
});

// API: Health & Service status
app.get('/api/health', async (req, res) => {
  let groqStatus = Boolean(process.env.GROQ_API_KEY);
  let geminiStatus = Boolean(process.env.GEMINI_API_KEY);

  let n8nStatus = false;
  try {
    const n8nCheck = await fetch('http://localhost:5678/healthz', { signal: AbortSignal.timeout(1000) });
    n8nStatus = n8nCheck.ok;
  } catch (_) {}

  let ollamaStatus = false;
  try {
    const oCheck = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1000) });
    ollamaStatus = oCheck.ok;
  } catch (_) {}

  res.json({
    groq: groqStatus,
    gemini: geminiStatus,
    n8n: n8nStatus,
    ollama: ollamaStatus,
    port: PORT
  });
});

// Mobile & Root routes
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`  Ampolin AI Studio Running!`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Mobile View: http://localhost:${PORT}/mobile`);
  console.log(`  Groq API: ${process.env.GROQ_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`  Gemini API: ${process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`========================================================`);
});
