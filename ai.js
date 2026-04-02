// ─── AI CHAT (powered by puter.js) ───────────────────────
// No API key needed — puter.js handles it for free.
// Model: gpt-4.1-nano (OpenAI via puter)

let aiHistory = []; // multi-turn conversation history
let aiTyping  = false;

function toggleAI() {
  const panel = document.getElementById('ai-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    document.getElementById('ai-input').focus();
  }
}

async function sendAI() {
  const input   = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send-btn');
  const text    = input.value.trim();

  if (!text || aiTyping) return;

  input.value = '';
  addBubble('user', text);
  aiHistory.push({ role: 'user', content: text });

  // Show typing indicator
  aiTyping = true;
  sendBtn.disabled = true;
  const typingEl = addTypingIndicator();

  try {
    // Build messages with optional task context
    const messages = buildMessages();

    const response = await puter.ai.chat(messages, {
      model: 'gpt-4.1-nano',
      stream: false
    });

    // Remove typing indicator
    typingEl.remove();

    // Extract text from puter.js response
    let replyText = '';
    if (typeof response === 'string') {
      replyText = response;
    } else if (response?.message?.content) {
      replyText = response.message.content;
    } else if (response?.content) {
      replyText = typeof response.content === 'string'
        ? response.content
        : response.content.map(c => c.text || '').join('');
    } else {
      replyText = String(response);
    }

    aiHistory.push({ role: 'assistant', content: replyText });
    addBubble('assistant', replyText);

  } catch (err) {
    typingEl.remove();
    addBubble('assistant', '⚠️ Something went wrong. Make sure puter.js is loaded and try again.');
    console.error('Puter AI error:', err);
  }

  aiTyping  = false;
  sendBtn.disabled = false;
  document.getElementById('ai-input').focus();
}

function buildMessages() {
  // Give AI context about user's current tasks
  let systemContent = `You are a helpful, concise AI assistant inside a to-do app called Taskr. 
Be friendly and direct. Keep responses short unless detail is needed.`;

  if (allTasks && allTasks.length > 0) {
    const pending   = allTasks.filter(t => !t.is_complete).map(t => `- ${t.task}`).join('\n');
    const completed = allTasks.filter(t => t.is_complete).map(t => `- ${t.task}`).join('\n');
    systemContent += `\n\nUser's current tasks:\nPending:\n${pending || 'none'}\nCompleted:\n${completed || 'none'}`;
  }

  return [
    { role: 'system', content: systemContent },
    ...aiHistory
  ];
}

function addBubble(role, text) {
  const messages = document.getElementById('ai-messages');

  // Remove welcome message on first real message
  const welcome = messages.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  const bubble = document.createElement('div');
  bubble.className = `ai-bubble ${role}`;
  bubble.innerHTML = `
    <span class="bubble-role">${role === 'user' ? 'You' : 'AI'}</span>
    <div class="bubble-text">${escapeAndFormat(text)}</div>
  `;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  const messages = document.getElementById('ai-messages');
  const wrap = document.createElement('div');
  wrap.className = 'ai-bubble assistant';
  wrap.innerHTML = `
    <span class="bubble-role">AI</span>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

function escapeAndFormat(text) {
  // Escape HTML, then convert **bold** and newlines to HTML
  return text
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
