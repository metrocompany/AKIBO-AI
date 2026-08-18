require('dotenv').config();
const express = require('express');
const multer = require('multer');
const app = express();

// Configure file upload storage (in-memory parsing)
const upload = multer({ 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max upload limit
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Currently active free endpoints on OpenRouter (including vision-capable models)
const AVAILABLE_MODELS = {
  'openrouter/free': {
    id: 'openrouter/free',
    name: 'AKIBO Core Auto-Router (Free)',
    provider: 'OpenRouter Aggregator',
    contextWindow: '8k - 128k',
    description: 'Automatically routes to the best currently operational free model.'
  },
  'google/gemma-4-31b-it:free': {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google Gemma 4 31B (Free / Vision)',
    provider: 'Google AI',
    contextWindow: '262k',
    description: 'Supports text, code, and image analysis.'
  },
  'meta-llama/llama-3.2-11b-vision-instruct:free': {
    id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    name: 'Llama 3.2 11B Vision (Free)',
    provider: 'Meta AI',
    contextWindow: '128k',
    description: 'Multimodal model optimized for analyzing images and text.'
  },
  'meta-llama/llama-3.3-70b-instruct:free': {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct (Free)',
    provider: 'Meta AI',
    contextWindow: '128k',
    description: 'Capable general purpose reasoning model.'
  }
};

const SYSTEM_STATE = {
  startTime: new Date().toISOString(),
  totalRequestsProcessed: 0,
  failedRequests: 0
};

// Main UI Web Page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AKIBO OS // MULTIMODAL VISION AI CONSOLE</title>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Rajdhani:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-primary: #030712;
          --panel-bg: rgba(11, 19, 43, 0.85);
          --panel-border: rgba(0, 243, 255, 0.25);
          --neon-cyan: #00f3ff;
          --neon-magenta: #ff0055;
          --neon-green: #00ff66;
          --text-main: #f1f5f9;
          --text-muted: #64748b;
          --input-bg: rgba(5, 10, 25, 0.9);
        }

        [data-theme="amber"] {
          --neon-cyan: #ffb700;
          --neon-magenta: #ff5500;
          --panel-border: rgba(255, 183, 0, 0.25);
        }

        [data-theme="emerald"] {
          --neon-cyan: #10b981;
          --neon-magenta: #06b6d4;
          --panel-border: rgba(16, 185, 129, 0.25);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Rajdhani', sans-serif; user-select: none; }
        body { background-color: var(--bg-primary); color: var(--text-main); height: 100vh; display: flex; overflow: hidden; }

        aside {
          width: 320px; background: var(--panel-bg); border-right: 1px solid var(--panel-border);
          backdrop-filter: blur(12px); display: flex; flex-direction: column; padding: 20px; z-index: 10;
        }

        .brand-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--panel-border); }
        .brand-logo { width: 44px; height: 44px; border: 2px solid var(--neon-cyan); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 20px; color: var(--neon-cyan); }
        .brand-title { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 16px; letter-spacing: 2px; }
        .brand-subtitle { font-size: 10px; color: var(--neon-cyan); letter-spacing: 1px; }

        .section-label { font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 1.5px; margin-bottom: 12px; text-transform: uppercase; }
        .control-group { margin-bottom: 20px; }
        select, input, button, textarea { user-select: text; }

        .custom-select {
          width: 100%; background: var(--input-bg); border: 1px solid var(--panel-border); color: var(--neon-cyan);
          padding: 10px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; outline: none; cursor: pointer;
        }

        .model-info-box {
          background: rgba(0, 243, 255, 0.03); border: 1px dashed var(--panel-border); border-radius: 6px;
          padding: 12px; font-size: 11px; color: var(--text-muted); margin-top: 8px; line-height: 1.4;
        }
        .model-info-box span { color: var(--text-main); font-weight: 600; }

        .stats-container { background: rgba(0, 0, 0, 0.4); border: 1px solid var(--panel-border); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px; font-family: 'Fira Code', monospace; font-size: 11px; }
        .stat-row { display: flex; justify-content: space-between; }
        .stat-value { color: var(--neon-cyan); }

        .theme-selector { display: flex; gap: 8px; }
        .theme-btn { flex: 1; height: 24px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
        .theme-btn.cyan { background: #00f3ff; }
        .theme-btn.amber { background: #ffb700; }
        .theme-btn.emerald { background: #10b981; }

        .sys-logs { flex: 1; background: rgba(0,0,0,0.6); border: 1px solid var(--panel-border); border-radius: 6px; padding: 8px; font-family: 'Fira Code', monospace; font-size: 10px; color: var(--neon-green); overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }

        main { flex: 1; display: flex; flex-direction: column; height: 100vh; }
        header { height: 64px; border-bottom: 1px solid var(--panel-border); background: var(--panel-bg); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }

        .status-badge { display: flex; align-items: center; gap: 8px; font-family: 'Orbitron', sans-serif; font-size: 11px; color: var(--neon-green); }
        .indicator-dot { width: 8px; height: 8px; background: var(--neon-green); border-radius: 50%; box-shadow: 0 0 8px var(--neon-green); }

        .clear-btn { background: transparent; border: 1px solid var(--neon-magenta); color: var(--neon-magenta); padding: 6px 12px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .clear-btn:hover { background: var(--neon-magenta); color: #fff; }

        #chat-window { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }

        .chat-message { display: flex; gap: 16px; max-width: 900px; width: 100%; margin: 0 auto; }
        .avatar { width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 12px; flex-shrink: 0; }
        .chat-message.user .avatar { background: rgba(255, 0, 85, 0.15); border: 1px solid var(--neon-magenta); color: var(--neon-magenta); }
        .chat-message.assistant .avatar { background: rgba(0, 243, 255, 0.15); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); }

        .message-content { flex: 1; background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 8px; padding: 16px; line-height: 1.6; font-size: 14px; white-space: pre-wrap; user-select: text; }
        .chat-message.user .message-content { border-color: rgba(255, 0, 85, 0.3); background: rgba(15, 5, 20, 0.6); }
        .message-meta { font-size: 10px; font-family: 'Fira Code', monospace; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between; }

        footer { padding: 20px 24px; background: var(--panel-bg); border-top: 1px solid var(--panel-border); }

        .file-preview {
          max-width: 900px; margin: 0 auto 8px auto; display: none; align-items: center; justify-content: space-between;
          background: rgba(0, 243, 255, 0.1); border: 1px dashed var(--neon-cyan); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-family: 'Fira Code', monospace;
        }

        .input-box {
          max-width: 900px; margin: 0 auto; display: flex; gap: 12px; background: var(--input-bg);
          border: 1px solid var(--panel-border); border-radius: 8px; padding: 8px 12px; align-items: center;
        }
        .input-box textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--text-main); font-size: 14px; resize: none; height: 40px; }

        .file-upload-label {
          background: rgba(255, 255, 255, 0.05); border: 1px solid var(--panel-border); color: var(--text-main);
          padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s;
        }
        .file-upload-label:hover { border-color: var(--neon-cyan); color: var(--neon-cyan); }
        #fileInput { display: none; }

        .send-btn {
          background: rgba(0, 243, 255, 0.1); border: 1px solid var(--neon-cyan); color: var(--neon-cyan);
          padding: 0 20px; height: 40px; border-radius: 6px; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 11px; cursor: pointer; transition: all 0.2s;
        }
        .send-btn:hover { background: var(--neon-cyan); color: #000; }
      </style>
    </head>
    <body>

      <aside>
        <div class="brand-header">
          <div class="brand-logo">A</div>
          <div>
            <div class="brand-title">AKIBO OS</div>
            <div class="brand-subtitle">VISION & FILE GATEWAY</div>
          </div>
        </div>

        <div class="control-group">
          <div class="section-label">Active Inference Engine</div>
          <select id="modelSelect" class="custom-select" onchange="updateModelInfo()">
            <option value="openrouter/free">AKIBO Core Auto (Free)</option>
            <option value="google/gemma-4-31b-it:free">Google Gemma 4 31B (Free / Vision)</option>
            <option value="meta-llama/llama-3.2-11b-vision-instruct:free">Llama 3.2 11B Vision (Free)</option>
            <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
          </select>

          <div class="model-info-box" id="modelInfo">
            Provider: <span id="infoProvider">OpenRouter</span><br>
            Context: <span id="infoContext">Auto</span><br>
            Desc: <span id="infoDesc">Supports image & text tasks.</span>
          </div>
        </div>

        <div class="control-group">
          <div class="section-label">System Diagnostics</div>
          <div class="stats-container">
            <div class="stat-row"><span>Uptime:</span><span class="stat-value" id="statUptime">00:00:00</span></div>
            <div class="stat-row"><span>Requests:</span><span class="stat-value" id="statRequests">0</span></div>
            <div class="stat-row"><span>Status:</span><span class="stat-value" style="color:var(--neon-green)">VISION ENABLED</span></div>
          </div>
        </div>

        <div class="control-group">
          <div class="section-label">Interface Theme</div>
          <div class="theme-selector">
            <button class="theme-btn cyan" onclick="setTheme('default')"></button>
            <button class="theme-btn amber" onclick="setTheme('amber')"></button>
            <button class="theme-btn emerald" onclick="setTheme('emerald')"></button>
          </div>
        </div>

        <div class="section-label">Console Logs</div>
        <div class="sys-logs" id="sysLogs">
          <div>[SYS] Multimodal vision module loaded.</div>
          <div>[SYS] Security filter active.</div>
        </div>
      </aside>

      <main>
        <header>
          <div class="status-badge">
            <div class="indicator-dot"></div> VISION READY
          </div>
          <button class="clear-btn" onclick="clearChat()">Clear Workspace</button>
        </header>

        <div id="chat-window">
          <div class="chat-message assistant">
            <div class="avatar">AI</div>
            <div class="message-content">
              <div class="message-meta">
                <span>SYSTEM AGENT</span>
                <span>ONLINE</span>
              </div>
              AKIBO OS multimodal workspace ready. You can now upload images and text files alongside your queries.
            </div>
          </div>
        </div>

        <footer>
          <div class="file-preview" id="filePreview">
            <span id="fileName">file.txt</span>
            <span style="color:var(--neon-magenta); cursor:pointer;" onclick="removeFile()">[Remove]</span>
          </div>
          <div class="input-box">
            <label class="file-upload-label" for="fileInput">
              📎 <span>Attach Image/File</span>
            </label>
            <input type="file" id="fileInput" accept="image/*,.txt,.js,.json,.md,.html,.css" onchange="handleFileSelected(event)" />
            <textarea id="userInput" placeholder="Ask about an image or document..." onkeydown="handleKeyPress(event)"></textarea>
            <button class="send-btn" onclick="sendMessage()">Transmit</button>
          </div>
        </footer>
      </main>

      <script>
        const modelsData = ${JSON.stringify(AVAILABLE_MODELS)};
        let messageHistory = [];
        let startTime = Date.now();
        let requestCounter = 0;
        let selectedFile = null;

        function updateModelInfo() {
          const selected = document.getElementById('modelSelect').value;
          const info = modelsData[selected] || {};
          document.getElementById('infoProvider').innerText = info.provider || 'N/A';
          document.getElementById('infoContext').innerText = info.contextWindow || 'N/A';
          document.getElementById('infoDesc').innerText = info.description || 'N/A';
          logEvent('Selected model: ' + selected);
        }

        function setTheme(theme) {
          if (theme === 'default') document.body.removeAttribute('data-theme');
          else document.body.setAttribute('data-theme', theme);
        }

        function logEvent(msg) {
          const logs = document.getElementById('sysLogs');
          const entry = document.createElement('div');
          entry.innerText = '[' + new Date().toLocaleTimeString().split(' ')[0] + '] ' + msg;
          logs.appendChild(entry);
          logs.scrollTop = logs.scrollHeight;
        }

        function clearChat() {
          document.getElementById('chat-window').innerHTML = '';
          messageHistory = [];
          logEvent('Chat cleared.');
        }

        function handleKeyPress(e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }

        function handleFileSelected(event) {
          const file = event.target.files[0];
          if (file) {
            selectedFile = file;
            document.getElementById('fileName').innerText = '📁 Attached: ' + file.name + ' (' + Math.round(file.size/1024) + ' KB)';
            document.getElementById('filePreview').style.display = 'flex';
            logEvent('File attached: ' + file.name);
          }
        }

        function removeFile() {
          selectedFile = null;
          document.getElementById('fileInput').value = '';
          document.getElementById('filePreview').style.display = 'none';
          logEvent('File attachment removed.');
        }

        async function sendMessage() {
          const textarea = document.getElementById('userInput');
          const text = textarea.value.trim();
          if (!text && !selectedFile) return;

          const model = document.getElementById('modelSelect').value;
          textarea.value = '';

          const formData = new FormData();
          formData.append('model', model);
          formData.append('prompt', text);
          formData.append('messages', JSON.stringify(messageHistory));
          
          let displayPrompt = text;
          if (selectedFile) {
            formData.append('file', selectedFile);
            displayPrompt += '\\n[Attached File: ' + selectedFile.name + ']';
          }

          removeFile();

          appendMessage('user', 'USER', displayPrompt);
          messageHistory.push({ role: 'user', content: displayPrompt });

          const botMessageId = 'msg-' + Date.now();
          appendMessage('assistant', 'AKIBO (' + model.split('/')[1] + ')', 'Analyzing visual/text data...', botMessageId);

          requestCounter++;
          document.getElementById('statRequests').innerText = requestCounter;

          try {
            const response = await fetch('/api/v1/chat', {
              method: 'POST',
              body: formData
            });

            const rawText = await response.text();
            let data;
            try {
              data = JSON.parse(rawText);
            } catch (e) {
              throw new Error("Server error (Status " + response.status + "): " + rawText.substring(0, 100));
            }

            const botBubble = document.getElementById(botMessageId);

            if (response.ok && data.reply) {
              botBubble.innerText = data.reply;
              messageHistory.push({ role: 'assistant', content: data.reply });
              logEvent('Inference complete.');
            } else {
              botBubble.innerText = 'Error: ' + (data.error || 'Failed to process request.');
              logEvent('API error encountered.');
            }
          } catch (err) {
            document.getElementById(botMessageId).innerText = 'Network Error: ' + err.message;
            logEvent('Transmission failed.');
          }
        }

        function appendMessage(role, sender, text, elementId = null) {
          const chatWindow = document.getElementById('chat-window');
          const messageRow = document.createElement('div');
          messageRow.className = 'chat-message ' + role;

          const avatar = document.createElement('div');
          avatar.className = 'avatar';
          avatar.innerText = role === 'user' ? 'USR' : 'AI';

          const content = document.createElement('div');
          content.className = 'message-content';

          const meta = document.createElement('div');
          meta.className = 'message-meta';
          meta.innerHTML = '<span>' + sender + '</span><span>' + new Date().toLocaleTimeString() + '</span>';

          const textDiv = document.createElement('div');
          if (elementId) textDiv.id = elementId;
          textDiv.innerText = text;

          content.appendChild(meta);
          content.appendChild(textDiv);
          messageRow.appendChild(avatar);
          messageRow.appendChild(content);

          chatWindow.appendChild(messageRow);
          chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
          const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
          const secs = String(elapsed % 60).padStart(2, '0');
          document.getElementById('statUptime').innerText = hrs + ':' + mins + ':' + secs;
        }, 1000);

        updateModelInfo();
      </script>
    </body>
    </html>
  `);
});

// Secure Endpoint supporting Text, Code, and Vision/Images
app.post('/api/v1/chat', upload.single('file'), async (req, res) => {
  SYSTEM_STATE.totalRequestsProcessed++;

  try {
    const { model, prompt } = req.body;
    let finalPrompt = prompt || '';

    // --- SECURITY FILTER ---
    const maliciousKeywords = ['malware', 'ransomware', 'keylogger', 'exploit payload', 'ddos script', 'trojan'];
    const lowerPrompt = finalPrompt.toLowerCase();
    
    if (maliciousKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      SYSTEM_STATE.failedRequests++;
      return res.status(403).json({ 
        error: 'Security Policy Violation: Prompt flagged for prohibited malicious content.' 
      });
    }

    let messages = [];
    if (req.body.messages) {
      try {
        messages = JSON.parse(req.body.messages);
      } catch (e) {
        messages = [];
      }
    }

    let userContent = finalPrompt;

    // Handle File / Image Uploads
    if (req.file) {
      const mimeType = req.file.mimetype;
      if (mimeType.startsWith('image/')) {
        // Convert image to base64 data URL for Vision models
        const base64Image = req.file.buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        
        userContent = [
          { type: "text", text: finalPrompt || "Describe or analyze this image." },
          { type: "image_url", image_url: { url: dataUrl } }
        ];
      } else {
        // Handle normal text/code files
        const fileBuffer = req.file.buffer.toString('utf-8');
        userContent += `\n\n--- ATTACHED FILE CONTEXT (${req.file.originalname}) ---\n${fileBuffer}\n--- END ATTACHED FILE ---`;
      }
    }

    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      messages[messages.length - 1].content = userContent;
    } else {
      messages.push({ role: 'user', content: userContent });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing from environment variables.' });
    }

    const selectedModel = model || 'openrouter/free';

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AKIBO Workspace'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: messages
      })
    });

    const data = await openRouterResponse.json();

    if (data.error) {
      SYSTEM_STATE.failedRequests++;
      return res.status(openRouterResponse.status || 500).json({
        error: data.error.message || 'Error processing request.'
      });
    }

    const replyContent = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : 'No response generated.';

    return res.json({
      reply: replyContent,
      modelUsed: selectedModel
    });

  } catch (error) {
    SYSTEM_STATE.failedRequests++;
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Server exception: ' + error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 AKIBO VISION OS RUNNING: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
