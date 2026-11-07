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
// 2. Direct Google Gemini AI Engine (Multimodal Vision + High-Speed Reasoning)
async function fetchGeminiModel(modelName, timeoutMs, prompt, history, image) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const userParts = [{ text: prompt || 'Analyze this image in detail, extract any text or code, and describe what you see.' }];
  if (image && image.data) {
    const cleanBase64 = image.data.replace(/^data:image\/[a-z0-9.+]+;base64,/, '');
    userParts.push({
      inline_data: {
        mime_type: image.mimeType || 'image/jpeg',
        data: cleanBase64
      }
    });
  }

  const contents = [
    ...history.slice(-10).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) }]
    })),
    { role: 'user', parts: userParts }
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
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
          provider: image ? 'Google Gemini Vision' : 'Google Gemini',
          model: modelName.replace('gemini-', 'Gemini ').replace('-preview', '')
        };
      }
    }
  } catch (err) {
    clearTimeout(timer);
  }
  return null;
}

async function callGemini(prompt, history, image) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

  // Staggered race across available flash versions:
  // Try 3.8 Flash first. If it returns 503 (demand spike) or errors out, automatically fallback to 3.6 Flash, 3.5 Flash, or Flash Latest!
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  for (const model of candidateModels) {
    try {
      const res = await fetchGeminiModel(model, 6500, prompt, history, image);
      if (res && res.reply) return res;
    } catch (e) {
      // try next candidate
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

// 3.5 Groq Multimodal Vision Engine (High-speed visual reasoning)
async function callGroqVision(prompt, history, image) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || !image || !image.data) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const imageUrl = image.data.startsWith('data:')
      ? image.data
      : `data:${image.mimeType || 'image/jpeg'};base64,${image.data}`;

    const userContent = [
      { type: 'text', text: prompt || 'Analyze this image in detail and describe what you see.' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent }
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
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
        provider: 'Groq Cloud Vision',
        model: 'Llama 3.2 Vision (11B)'
      };
    }
  } catch (err) {
    console.error('[Groq Vision Error]:', err.message);
  }
  return null;
}

// 4. Local Ollama Offline Fallback Engine
async function callOllama(prompt, history, modelName = 'qwen2.5:latest', endpoint = 'http://localhost:11434', image = null) {
  const ollamaUrl = (endpoint || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const userMsg = { role: 'user', content: prompt || 'Analyze this image.' };
    if (image && image.data) {
      const cleanBase64 = image.data.replace(/^data:image\/[a-z0-9.+]+;base64,/, '');
      userMsg.images = [cleanBase64];
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
      })),
      userMsg
    ];

    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
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
        provider: 'Ollama (Local Node)',
        model: data?.model || modelName
      };
    }
  } catch (err) {
    // Ollama daemon not running
  }
  return null;
}

// API: Ollama local status & model discovery
app.get(['/api/ollama/status', '/ollama/status'], async (req, res) => {
  const endpoint = (req.query.endpoint || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const data = await response.json();
      return res.json({
        online: true,
        endpoint: endpoint,
        models: (data.models || []).map(m => m.name)
      });
    }
  } catch (err) {
    // offline
  }
  return res.json({ online: false, endpoint: endpoint, models: [] });
});

// API: Main Chat Orchestrator (Multi-Tier Failover + Vision)
app.post('/api/chat', async (req, res) => {
  const { message, model = 'Gemini 3.8 Flash', sessionId = 'default_session', mode = 'chat', image = null, ollamaEndpoint, ollamaModel } = req.body;

  const promptText = (typeof message === 'string' && message.trim()) 
    ? message.trim() 
    : (image ? 'Analyze this image in detail and describe what you see, including any text, UI components, architecture, or code.' : '');

  if (!promptText && !image) {
    return res.status(400).json({ error: 'Message or image attachment is required' });
  }

  const history = getSessionHistory(sessionId);
  let result = null;
  const modelLower = (model || '').toLowerCase();

  // If an image is provided: Primary multimodal engine is Google Gemini 3.8 Flash Vision
  if (image && image.data) {
    if (modelLower.includes('ollama')) {
      result = await callOllama(promptText, history, ollamaModel || 'qwen2.5:latest', ollamaEndpoint || 'http://localhost:11434', image);
    }
    if (!result) {
      result = await callGemini(promptText, history, image);
    }
    if (!result) {
      result = await callGroqVision(promptText, history, image);
    }
  } else if (modelLower.includes('qwen')) {
    result = await callGroq(promptText, history, 'qwen/qwen3.8-27b');
    if (result) {
      result.provider = 'Alibaba Qwen (Groq Cloud)';
      result.model = 'Qwen 3.8 (27B)';
    } else {
      result = await callGemini(promptText, history);
    }
  } else if (modelLower.includes('ollama')) {
    result = await callOllama(promptText, history, ollamaModel || 'qwen2.5:latest', ollamaEndpoint || 'http://localhost:11434');
    if (!result) {
      return res.status(503).json({
        error: `Could not connect to Ollama at ${ollamaEndpoint || 'http://localhost:11434'}. Ensure 'ollama serve' is running, or switch to Cloud Qwen 3.8.`,
        isOllamaOffline: true
      });
    }
  } else if (modelLower.includes('groq') || modelLower.includes('opus')) {
    result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
    if (result) {
      result.provider = 'Groq Cloud';
      result.model = 'Ampolin Opus 3.5 (120B)';
    } else {
      result = await callGemini(promptText, history);
    }
  } else if (modelLower.includes('deepseek') || modelLower.includes('r1')) {
    result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
    if (result) {
      result.provider = 'DeepSeek Reasoning Engine';
      result.model = 'DeepSeek R1 Sovereign';
    } else {
      result = await callGemini(promptText, history);
    }
  } else if (modelLower.includes('gpt-4o') || modelLower.includes('omni')) {
    result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
    if (result) {
      result.provider = 'Omniverse Architecture';
      result.model = 'GPT-4o Omniverse';
    } else {
      result = await callGemini(promptText, history);
    }
  } else if (modelLower.includes('claude') || modelLower.includes('sonnet')) {
    result = await callClaude(promptText, history, model);
    if (!result) result = await callGemini(promptText, history);
    if (!result) result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
  } else {
    // Primary: Gemini 3.8 Flash (with 3.5 Flash & Groq failover)
    result = await callGemini(promptText, history);
    if (!result) result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
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
