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

// 1. Google Gemini Cloud Engine (Primary: 3.8 Flash with fast fallback to 3.5 Flash & Vision)
async function fetchGeminiModel(modelName, timeoutMs, prompt, history, image) {
  if (!GEMINI_KEY) return null;
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
  if (!GEMINI_KEY) return null;

  // Turbo Multi-Model Parallel Race:
  // Concurrently race Flash models (3.6 Flash, 3.8 Flash, 3.5 Flash, Flash Latest).
  // The first model to resolve with valid output wins instantly, completely eliminating 503 / timeout bottlenecks!
  const raceCandidates = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  
  try {
    const winner = await Promise.any(
      raceCandidates.map(model => 
        fetchGeminiModel(model, 5500, prompt, history, image).then(res => {
          if (res && res.reply) return res;
          throw new Error(`${model} empty or failed`);
        })
      )
    );
    if (winner) return winner;
  } catch (err) {
    // If all concurrent candidates failed, try backup lite
  }

  return await fetchGeminiModel('gemini-3.1-flash-lite', 4000, prompt, history, image);
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

// 3.5 Groq Multimodal Vision Engine (High-speed visual reasoning)
async function callGroqVision(prompt, history, image) {
  if (!GROQ_KEY || !image || !image.data) return null;
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
        'Authorization': `Bearer ${GROQ_KEY}`
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

// 4. Ollama Local / Remote Inference Node (Supports text & vision models like Llava/Qwen-VL)
async function callOllama(prompt, history, modelName = 'qwen2.5:latest', endpoint = 'http://localhost:11434', image = null) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const cleanEndpoint = (endpoint || 'http://localhost:11434').replace(/\/$/, '');

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

    const res = await fetch(`${cleanEndpoint}/api/chat`, {
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
        reply: data?.message?.content?.trim() || '',
        provider: 'Ollama (Local Node)',
        model: data?.model || modelName
      };
    }
  } catch (err) {
    console.error('[Ollama Error]:', err.message);
  }
  return null;
}

// Route: /api/chat or /chat
app.post(['/api/chat', '/chat'], async (req, res) => {
  const { message, model = 'Gemini 3.8 Flash', history = [], image = null, ollamaEndpoint, ollamaModel } = req.body;
  
  const promptText = (typeof message === 'string' && message.trim()) 
    ? message.trim() 
    : (image ? 'Analyze this image in detail and describe what you see, including any text, UI components, architecture, or code.' : '');

  if (!promptText && !image) {
    return res.status(400).json({ error: 'Message or image attachment is required' });
  }

  const modelLower = (model || '').toLowerCase();
  let result = null;

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
    result = await callClaude(promptText, history);
    if (!result) result = await callGemini(promptText, history);
    if (!result) result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
  } else {
    // Primary: Gemini 3.8 Flash (with 3.5 Flash & Groq failover)
    result = await callGemini(promptText, history);
    if (!result) result = await callGroq(promptText, history, 'openai/gpt-oss-120b');
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

// Route: /api/ollama/status
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
