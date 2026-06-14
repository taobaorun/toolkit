// cookies.js — Cookie inspector module
// Domain filter, inline expansion, cookie string import, full-featured inspector.
// @author yuanxuan

var CookiesModule = (function () {
  'use strict';

  var container;
  var allCookies = [];
  var currentDomain = '';
  var expandedIdx = -1;
  var filterCookies;

  function render(parent) {
    container = parent;
    container.innerHTML =
      '<div class="cookies-layout">' +
        '<div class="cookies-sidebar">' +
          '<input type="text" id="cookieDomainSearch" class="cookie-domain-search" placeholder="Filter domains..." />' +
          '<div id="cookieDomains" class="cookie-domain-list"></div>' +
        '</div>' +
        '<div class="cookies-main">' +
          '<div class="cookies-toolbar">' +
            '<span id="cookieActiveDomain" class="cookie-active-domain"></span>' +
            '<input type="text" id="cookieSearch" class="cookie-search" placeholder="Search cookies..." />' +
            '<button class="btn small" id="cookieImportBtn">Import</button>' +
            '<button class="btn small" id="cookieExport">Export</button>' +
            '<button class="btn small" id="cookieClearImported">Clear imported</button>' +
          '</div>' +
          '<div id="cookieImportArea" class="cookie-import-area hidden">' +
            '<textarea id="cookiePasteInput" class="cookie-paste-textarea" placeholder="Paste cookie string: key1=val1; key2=val2" rows="3"></textarea>' +
            '<div style="display:flex;gap:6px;margin-top:4px">' +
              '<button class="btn small primary" id="cookiePasteBtn">Parse & Import</button>' +
              '<button class="btn small" id="cookieImportCancel">Cancel</button>' +
            '</div>' +
          '</div>' +
          '<div id="cookieList" class="cookie-list"></div>' +
        '</div>' +
      '</div>';

    loadCookies();
    bindEvents();
  }

  function loadCookies() {
    // Non-extension context (file://) — no cookies available
    if (typeof chrome === 'undefined' || !chrome.cookies) {
      renderDomains();
      renderCookieList();
      return;
    }

    // Check if opened via expand (URL param with domain context)
    var urlParams = new URLSearchParams(window.location.search);
    var savedDomain = urlParams.get('domain');

    // Get cookies ONLY for the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      // When opened in a popup window, there may be no active tab with a URL.
      // Restore domain context from the URL parameter.
      if (savedDomain && (!tabs || !tabs[0] || !tabs[0].url || tabs[0].url.startsWith('chrome-extension://'))) {
        loadByDomain(savedDomain);
        return;
      }

      var activeUrl = (tabs && tabs[0] && tabs[0].url) ? tabs[0].url : '';

      if (!activeUrl || activeUrl.startsWith('chrome://') || activeUrl.startsWith('chrome-extension://')) {
        if (savedDomain) {
          loadByDomain(savedDomain);
        } else {
          renderDomains();
          renderCookieList();
        }
        return;
      }

      var activeDomain = extractDomain(activeUrl);
      if (activeDomain && activeDomain !== savedDomain) {
        // Persist current domain to URL so expand works
        var qs = new URLSearchParams(window.location.search);
        qs.set('domain', activeDomain);
        var newUrl = window.location.pathname + '?' + qs.toString();
        if (window.location.search !== '?' + qs.toString()) {
          window.history.replaceState(null, '', newUrl);
        }
      }

      if (activeDomain) {
        document.getElementById('cookieActiveDomain').textContent = activeDomain;
      }

      chrome.cookies.getAll({ url: activeUrl }, function (cookies) {
        if (chrome.runtime.lastError) {
          console.warn('[ToolKit]', chrome.runtime.lastError.message);
          allCookies = [];
        } else {
          allCookies = cookies || [];
        }

        currentDomain = activeDomain;

        renderDomains();
        renderCookieList();
      });
    });
  }

  function loadByDomain(domain) {
    document.getElementById('cookieActiveDomain').textContent = domain;
    // Try getting cookies for this domain pattern
    chrome.cookies.getAll({ domain: domain }, function (cookies) {
      if (chrome.runtime.lastError || !cookies || cookies.length === 0) {
        // Try without leading dot
        var cleanDomain = domain.replace(/^\./, '');
        chrome.cookies.getAll({ domain: cleanDomain }, function (cookies2) {
          allCookies = (!chrome.runtime.lastError && cookies2) ? cookies2 : [];
          currentDomain = domain;
          renderDomains();
          renderCookieList();
        });
        return;
      }
      allCookies = cookies;
      currentDomain = domain;
      renderDomains();
      renderCookieList();
    });
  }

  function extractDomain(url) {
    try {
      var a = document.createElement('a');
      a.href = url;
      return a.hostname;
    } catch (e) { return ''; }
  }

  // --- Import cookie string ------------------------------------------

  function importCookieString(str) {
    var cookies = [];
    str.split(';').forEach(function (part) {
      var idx = part.indexOf('=');
      if (idx === -1) return;
      var key = part.substring(0, idx).trim();
      var val = part.substring(idx + 1).trim();
      if (!key) return;
      cookies.push({
        domain: '(imported)',
        name: key,
        value: val,
        path: '/',
        expirationDate: null,
        secure: false,
        httpOnly: false,
        sameSite: '',
        size: new Blob([key + '=' + val]).size,
        _source: 'imported'
      });
    });

    if (cookies.length > 0) {
      // Remove previously imported cookies
      allCookies = allCookies.filter(function (c) { return c._source !== 'imported'; });
      allCookies = allCookies.concat(cookies);
      currentDomain = '(imported)';
      renderDomains();
      renderCookieList();
    }
  }

  // --- Domain list ---------------------------------------------------

  function renderDomains(filter) {
    var domains = {};
    allCookies.forEach(function (c) {
      var d = c.domain.replace(/^\./, '');
      if (filter && d.toLowerCase().indexOf(filter.toLowerCase()) === -1) return;
      domains[d] = (domains[d] || 0) + 1;
    });

    var el = document.getElementById('cookieDomains');
    var html = '';
    var first = true;
    var domainKeys = Object.keys(domains).sort();

    if (domainKeys.length === 0) {
      html = '<div class="empty-state" style="padding:12px;font-size:11px">No matching domains</div>';
    }

    domainKeys.forEach(function (d) {
      if (first && !currentDomain) { currentDomain = d; first = false; }
      html += '<div class="cookie-domain-item' + (d === currentDomain ? ' active' : '') + '" data-domain="' + escapeHtmlAttr(d) + '">' +
        escapeHtml(d) + '<span class="cookie-domain-count">' + domains[d] + ' cookies</span></div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('.cookie-domain-item').forEach(function (item) {
      item.addEventListener('click', function () {
        currentDomain = this.dataset.domain;
        expandedIdx = -1;
        el.querySelectorAll('.cookie-domain-item').forEach(function (i) { i.classList.remove('active'); });
        this.classList.add('active');
        renderCookieList();
      });
    });
  }

  // --- Cookie list with inline expansion -----------------------------

  function renderCookieList(query) {
    filterCookies = allCookies.filter(function (c) { return c.domain.replace(/^\./, '') === currentDomain; });
    if (query) {
      query = query.toLowerCase();
      filterCookies = filterCookies.filter(function (c) {
        return c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query);
      });
    }

    var el = document.getElementById('cookieList');
    var html = '';

    if (filterCookies.length === 0) {
      el.innerHTML = '<div class="empty-state">No cookies found</div>';
      return;
    }

    filterCookies.forEach(function (c, idx) {
      var exp = c.expirationDate ? new Date(c.expirationDate * 1000).toISOString().replace('T', ' ').slice(0, 16) : 'Session';
      var size = c.size || new Blob([c.name + '=' + c.value]).size;
      var isExpanded = idx === expandedIdx;

      html += '<div class="cookie-item' + (isExpanded ? ' expanded' : '') + '" data-idx="' + idx + '">' +
        '<div class="cookie-item-header">' +
          '<span class="cookie-item-name">' + escapeHtml(c.name) + '</span>' +
          '<span class="cookie-item-value">' + escapeHtml(truncate(c.value, 40)) + '</span>' +
          '<button class="icon-btn small cookie-copy-btn" data-value="' + escapeHtmlAttr(c.value) + '">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="cookie-item-detail' + (isExpanded ? '' : ' hidden') + '">' +
          '<div class="cookie-detail-row"><span class="detail-key">VALUE</span><code class="cookie-value-full">' + escapeHtml(c.value) + '</code><button class="btn small" data-copy="' + escapeHtmlAttr(c.value) + '" style="margin-left:auto">Copy</button></div>' +
          '<div class="cookie-detail-meta">' +
            '<span><span class="detail-key">DOMAIN</span> ' + escapeHtml(c.domain) + '</span>' +
            '<span><span class="detail-key">PATH</span> ' + escapeHtml(c.path || '/') + '</span>' +
            '<span><span class="detail-key">EXPIRES</span> ' + exp + '</span>' +
            '<span><span class="detail-key">SIZE</span> ' + size + ' B</span>' +
          '</div>' +
          (c.secure || c.httpOnly || c.sameSite ? '<div class="cookie-flags">' +
            (c.secure ? '<span class="cookie-flag">Secure</span>' : '') +
            (c.httpOnly ? '<span class="cookie-flag">HttpOnly</span>' : '') +
            (c.sameSite ? '<span class="cookie-flag">SameSite · ' + c.sameSite + '</span>' : '') +
          '</div>' : '') +
        '</div>' +
      '</div>';
    });

    el.innerHTML = html;

    // Copy buttons (header)
    el.querySelectorAll('.cookie-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        navigator.clipboard.writeText(this.dataset.value).then(function () { showToast('Copied!'); });
      });
    });

    // Copy buttons (detail)
    el.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        navigator.clipboard.writeText(this.dataset.copy).then(function () { showToast('Copied!'); });
      });
    });

    // Click to expand/collapse inline
    el.querySelectorAll('.cookie-item-header').forEach(function (header) {
      header.addEventListener('click', function () {
        var item = this.parentElement;
        var idx = parseInt(item.dataset.idx);
        if (expandedIdx === idx) {
          expandedIdx = -1;
        } else {
          expandedIdx = idx;
        }
        renderCookieList(document.getElementById('cookieSearch').value);
      });
    });
  }

  // --- Events --------------------------------------------------------

  function bindEvents() {
    // Search cookies
    document.getElementById('cookieSearch').addEventListener('input', function () {
      expandedIdx = -1;
      renderCookieList(this.value);
    });

    // Search domains
    document.getElementById('cookieDomainSearch').addEventListener('input', function () {
      renderDomains(this.value);
    });

    // Export
    document.getElementById('cookieExport').addEventListener('click', function () {
      var cookies = allCookies.filter(function (c) { return c.domain.replace(/^\./, '') === currentDomain; });
      var blob = new Blob([JSON.stringify(cookies, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = currentDomain.replace(/\./g, '_') + '_cookies.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Clear imported
    document.getElementById('cookieClearImported').addEventListener('click', function () {
      allCookies = allCookies.filter(function (c) { return c._source !== 'imported'; });
      currentDomain = '';
      expandedIdx = -1;
      renderDomains();
      renderCookieList();
    });

    // Import cookie string — toggle area
    document.getElementById('cookieImportBtn').addEventListener('click', function () {
      var area = document.getElementById('cookieImportArea');
      area.classList.toggle('hidden');
    });

    document.getElementById('cookiePasteBtn').addEventListener('click', function () {
      var str = document.getElementById('cookiePasteInput').value.trim();
      if (str) importCookieString(str);
      document.getElementById('cookieImportArea').classList.add('hidden');
    });

    document.getElementById('cookieImportCancel').addEventListener('click', function () {
      document.getElementById('cookieImportArea').classList.add('hidden');
    });
  }

  function showToast(msg) {
    var toast = document.getElementById('cookieToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cookieToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 1500);
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeHtmlAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function truncate(s, max) { return String(s).length > max ? String(s).slice(0, max) + '...' : String(s); }

  return { render: render };
})();