// markdown.js — Markdown reader module
// Source / Split / Preview views using marked.js for rendering.
// Auto-detects the active tab's Markdown content on open; when the page
// is raw Markdown it switches to Preview (and sidepanel.js opens this tab).
// @author yuanxuan

var MarkdownModule = (function () {
  'use strict';

  var container;
  var viewMode = 'split';

  function render(parent) {
    container = parent;
    container.innerHTML =
      '<div class="md-toolbar">' +
        '<button class="btn small md-view-btn active" data-view="source">Source</button>' +
        '<button class="btn small md-view-btn" data-view="split">Split</button>' +
        '<button class="btn small md-view-btn" data-view="preview">Preview</button>' +
        '<button class="btn small" id="mdLoadPage">Load page</button>' +
        '<span id="mdStatus" class="md-status"></span>' +
        '<div class="spacer"></div>' +
        '<button class="btn small" id="mdCopy">Copy</button>' +
      '</div>' +
      '<div id="mdContainer" class="md-container split">' +
        '<div class="md-source-pane">' +
          '<div class="pane-label">MARKDOWN</div>' +
          '<textarea id="mdSource" class="md-textarea" placeholder="Open a web page and its Markdown loads here — or write your own." spellcheck="false"></textarea>' +
        '</div>' +
        '<div id="mdPreview" class="md-preview-pane">' +
          '<div class="pane-label">PREVIEW</div>' +
          '<div id="mdPreviewContent" class="md-preview-content"></div>' +
        '</div>' +
      '</div>';

    // Restore the toolbar to reflect the current view mode.
    setView(viewMode);
    bindEvents();
    renderPreview();

    // Auto-detect the active tab's Markdown on open (non-destructive).
    loadFromPage(true);
  }

  function bindEvents() {
    container.querySelectorAll('.md-view-btn').forEach(function (b) {
      b.addEventListener('click', function () { setView(this.dataset.view); });
    });

    document.getElementById('mdSource').addEventListener('input', function () {
      renderPreview();
    });

    document.getElementById('mdCopy').addEventListener('click', function () {
      var ta = document.getElementById('mdSource');
      ta.select();
      document.execCommand('copy');
    });

    // Manual reload always overwrites the source with the current page.
    document.getElementById('mdLoadPage').addEventListener('click', function () {
      loadFromPage(false);
    });
  }

  function setView(mode) {
    viewMode = mode;
    var cEl = document.getElementById('mdContainer');
    if (cEl) cEl.className = 'md-container ' + mode;
    if (container) {
      container.querySelectorAll('.md-view-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.view === mode);
      });
    }
  }

  // --- Load Markdown from the active tab ------------------------------

  // Auto-load only overwrites an empty editor, so it never clobbers
  // content the user has typed. Manual "Load page" always overwrites.
  function isSourceReplaceable() {
    return document.getElementById('mdSource').value.trim() === '';
  }

  function setStatus(msg) {
    var el = document.getElementById('mdStatus');
    if (el) el.textContent = msg || '';
  }

  // Skip pages the extension is not allowed to inject into. Local
  // file:// pages ARE allowed — reading them additionally requires the
  // user's "Allow access to file URLs" toggle (handled at inject time).
  function isInjectable(url) {
    if (!url) return false;
    return !/^(chrome|chrome-extension|edge|about|view-source|devtools):/i.test(url);
  }

  // Short, human-readable label for the tab we couldn't read, so the
  // status message says exactly which page was rejected.
  function describeUrl(url) {
    var m = /^([a-z-]+):/i.exec(url);
    var scheme = m ? m[1].toLowerCase() : '';
    if (scheme === 'file') return 'a local file (file://)';
    if (scheme && scheme !== 'http' && scheme !== 'https') {
      return url.split(/[?#]/)[0].slice(0, 40); // e.g. chrome://newtab
    }
    return hostOf(url);
  }

  // Reads the active tab's content. Calls cb(errCode, info):
  //   success → cb(null, { isRaw, text, url })
  //   failure → cb('<code>', { url })  (url absent for some codes)
  function fetchActivePage(cb) {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
      cb('unavailable');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      var url = tab && tab.url ? tab.url : '';

      if (!tab || !url) { cb('notab'); return; }
      if (!isInjectable(url)) { cb('noninjectable', { url: url }); return; }

      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: extractPageContent },
        function (results) {
          if (chrome.runtime.lastError) {
            console.warn('[ToolKit]', chrome.runtime.lastError.message);
            cb('injectfail', { url: url });
            return;
          }
          var data = results && results[0] && results[0].result;
          if (!data || !data.text || !data.text.trim()) {
            cb('empty', { url: url });
            return;
          }
          // Treat a .md/.markdown URL as raw Markdown even if the page
          // wasn't served as text/plain.
          var isRaw = data.isRaw || /\.(md|markdown|mdown|mkd)(\?|#|$)/i.test(url);
          cb(null, { isRaw: isRaw, text: data.text, url: url });
        }
      );
    });
  }

  function statusFor(err, info) {
    switch (err) {
      case 'unavailable':   return 'Page loading unavailable here';
      case 'notab':         return 'No active tab detected — click into a page tab first';
      case 'noninjectable': return 'Can’t read ' + describeUrl(info.url) + ' — open a normal web page';
      case 'injectfail':    return /^file:/i.test(info.url)
        ? 'Enable “Allow access to file URLs” for ToolKit at chrome://extensions'
        : 'Can’t read this page — reload it, then retry';
      case 'empty':         return 'No content found on this page';
      default:              return '';
    }
  }

  function loadFromPage(auto) {
    fetchActivePage(function (err, res) {
      if (err) {
        // Stay quiet on auto-load; only surface reasons on manual click.
        if (!auto) setStatus(statusFor(err, res));
        return;
      }
      if (auto && !isSourceReplaceable()) {
        setStatus('Kept your edits — click "Load page" to replace');
        return;
      }
      document.getElementById('mdSource').value = res.text;
      renderPreview();
      // When the page is real Markdown, show the rendered result directly.
      if (res.isRaw) setView('preview');
      setStatus((res.isRaw ? 'Loaded Markdown from ' : 'Loaded page text from ') + hostOf(res.url));
    });
  }

  // Public: lets sidepanel.js decide whether to auto-open this tab.
  // cb(isMarkdown) — true only when the active page is raw Markdown.
  function probeActivePage(cb) {
    fetchActivePage(function (err, res) {
      cb(!err && !!res && res.isRaw);
    });
  }

  // Runs in the page context (serialized by chrome.scripting). Detects
  // raw Markdown (text/plain or a lone <pre>) and returns its text,
  // otherwise falls back to the visible body text.
  function extractPageContent() {
    var body = document.body;
    var onlyPre = !!body && body.children.length === 1 &&
                  body.firstElementChild &&
                  body.firstElementChild.tagName === 'PRE';
    var isRaw = document.contentType === 'text/plain' || onlyPre;
    var text = onlyPre ? body.firstElementChild.innerText
                       : (body ? body.innerText : '');
    return { isRaw: isRaw, url: location.href, text: text };
  }

  function hostOf(url) {
    try {
      var a = document.createElement('a');
      a.href = url;
      return a.hostname || url;
    } catch (e) { return url; }
  }

  function renderPreview() {
    var src = document.getElementById('mdSource').value;
    var preview = document.getElementById('mdPreviewContent');
    try {
      // Use marked (global from marked.min.js)
      if (typeof marked !== 'undefined' && marked.parse) {
        preview.innerHTML = marked.parse(src);
      } else {
        // Fallback to simple rendering
        preview.innerHTML = '<p>' + escapeHtml(src).replace(/\n/g, '<br>') + '</p>';
      }
    } catch (e) {
      preview.innerHTML = '<p class="error">Rendering error</p>';
    }
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  return { render: render, probeActivePage: probeActivePage };
})();
