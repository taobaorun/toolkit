// ai-chat.js — AI Chat module
// Chat UI with quick prompts and page context awareness.
// Note: LLM API integration not included — quick prompts fill the input with preset text.
// @author yuanxuan

var AiChatModule = (function () {
  'use strict';

  var container;
  var messages = [];

  function render(parent) {
    container = parent;

    var pageUrl = '';
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].url) pageUrl = tabs[0].url;
        renderUI(pageUrl);
      });
    } catch (e) {
      pageUrl = 'github.com/torvalds/linux';
      renderUI(pageUrl);
    }
  }

  function renderUI(pageUrl) {
    container.innerHTML =
      '<div class="chat-context" id="chatContext">' +
        'Context: <span id="chatContextUrl">' + escapeHtml(pageUrl) + '</span>' +
      '</div>' +
      '<div class="chat-messages" id="chatMessages">' +
        '<div class="chat-welcome">' +
          '<div class="chat-welcome-icon">&#10023;</div>' +
          '<p>Hi! I can see you\'re on <strong>' + escapeHtml(pageUrl) + '</strong>. Ask me anything about this page, or tap a quick prompt below.</p>' +
        '</div>' +
      '</div>' +
      '<div class="chat-quick-prompts" id="chatQuickPrompts">' +
        '<button class="btn quick-prompt" data-prompt="Summarize this page">Summarize this page</button>' +
        '<button class="btn quick-prompt" data-prompt="Extract key points">Extract key points</button>' +
        '<button class="btn quick-prompt" data-prompt="Explain the open JSON">Explain the open JSON</button>' +
        '<button class="btn quick-prompt" data-prompt="What cookies are set?">What cookies are set?</button>' +
      '</div>' +
      '<div class="chat-input-area">' +
        '<textarea id="chatInput" class="chat-input" placeholder="Ask about this page…" rows="2"></textarea>' +
        '<button class="btn primary" id="chatSend">Send</button>' +
      '</div>';

    bindEvents();
  }

  function bindEvents() {
    // Quick prompts
    container.querySelectorAll('.quick-prompt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var prompt = this.dataset.prompt;
        var input = document.getElementById('chatInput');
        input.value = prompt;
        input.focus();
      });
    });

    // Send message
    document.getElementById('chatSend').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  function sendMessage() {
    var input = document.getElementById('chatInput');
    var text = input.value.trim();
    if (!text) return;

    messages.push({ role: 'user', text: text, time: new Date() });
    input.value = '';
    input.style.height = 'auto';

    // Add user message to UI
    appendMessage('user', text);

    // Generate a simulated response (placeholder for real API integration)
    setTimeout(function () {
      var response = generateResponse(text);
      messages.push({ role: 'assistant', text: response, time: new Date() });
      appendMessage('assistant', response);
    }, 500);
  }

  function appendMessage(role, text) {
    var msgContainer = document.getElementById('chatMessages');
    // Remove welcome message
    var welcome = msgContainer.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    var el = document.createElement('div');
    el.className = 'chat-message ' + role;
    el.innerHTML =
      '<div class="chat-bubble">' +
        '<div class="chat-meta">' + (role === 'user' ? 'You' : 'ToolKit AI') + ' · ' + formatTime(new Date()) + '</div>' +
        '<div class="chat-text">' + formatText(text) + '</div>' +
      '</div>';
    msgContainer.appendChild(el);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function generateResponse(text) {
    var lower = text.toLowerCase();
    if (lower.includes('summarize')) return 'This page contains information and resources. I can see the page structure includes several sections that organize content by category. The main topics covered relate to the page you are currently viewing.';
    if (lower.includes('key point')) return 'Key points from this page:\n\n1. The page has a structured layout with navigation elements\n2. Content is organized into logical sections\n3. There are interactive elements that respond to user actions';
    if (lower.includes('json')) return 'The JSON viewer shows structured data with the following structure:\n\n- Root object contains user, session, and meta fields\n- User object has id, name, email, active status, roles array, and settings\n- Session contains token and expiration information\n- Meta field is currently null';
    if (lower.includes('cookie')) return 'The current site has 8 cookies set:\n\n- user_session: authentication token\n- _gh_sess: session identifier\n- logged_in: login status flag\n- dotcom_user: username\n- color_mode: UI theme preference\n- tz: timezone setting\n- _octo: tracking identifier\n- preferred_color_scheme: dark mode setting';
    return 'I understand you\'re asking about: "' + text + '". As a local AI assistant, I can help you understand the content of this page. Please try one of the quick prompts above for more specific information.';
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function formatTime(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  function formatText(text) { return escapeHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>'); }

  return { render: render };
})();