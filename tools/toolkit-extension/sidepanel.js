// sidepanel.js — ToolKit main controller
// Tab switching, theme management, and content routing.
// @author yuanxuan

(function () {
  'use strict';

  const content = document.getElementById('content');
  const tabs = document.querySelectorAll('#tabBar .tab');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  let currentTab = 'json';

  // --- Theme --------------------------------------------------------

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('toolkit-theme', theme);

    if (theme === 'dark') {
      themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    } else {
      themeIcon.innerHTML = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    }
  }

  const savedTheme = localStorage.getItem('toolkit-theme') || 'light';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // --- Tab switching ------------------------------------------------

  function switchTab(tabName) {
    currentTab = tabName;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

    switch (tabName) {
      case 'json':      JsonEditor.render(content);      break;
      case 'cookies':   CookiesModule.render(content);    break;
      case 'markdown':  MarkdownModule.render(content);   break;
      case 'ai':        AiChatModule.render(content);     break;
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // --- Expand — pass active tab context via URL param ------------

  document.getElementById('expandBtn').addEventListener('click', () => {
    var w = screen.availWidth;
    var h = screen.availHeight;
    // Read current active domain from cookie module's displayed domain
    var domainEl = document.getElementById('cookieActiveDomain');
    var domain = domainEl ? domainEl.textContent : '';
    // Also try extracting from the current URL context
    var params = new URLSearchParams();
    if (domain) params.set('domain', domain);
    var url = window.location.href;
    var qs = params.toString();
    if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
    window.open(url, 'toolkit-expanded',
      'width=' + w + ',height=' + h + ',top=0,left=0,resizable=yes,scrollbars=yes');
  });

  // --- Init ---------------------------------------------------------

  switchTab('json');
})();