// markdown.js — Markdown reader module
// Source / Split / Preview views using marked.js for rendering.
// @author yuanxuan

var MarkdownModule = (function () {
  'use strict';

  var container;
  var viewMode = 'split';
  var sampleMd = '# ToolKit Extension\n\nA **lightweight** collection of developer utilities, right in your browser side panel.\n\n## Features\n\n- `JSON` viewer with a collapsible tree\n- Side-by-side **diff** & compare\n- Cookie inspector for the current site\n- Markdown reader with live preview\n\n## Quick start\n\n1. Pin the extension to your toolbar\n2. Open any page, then click the icon\n3. Pick a tool from the top tab bar\n\n> Tip: press `Cmd / Ctrl + Shift + K` to open the panel from anywhere.\n\n### Supported inputs\n\n| Tool | Source |\n| --- | --- |\n| JSON | text / clipboard |\n| Cookies | current tab |\n\nRead the [documentation](https://example.com) for the full reference.\n\n```js\nconst tk = new ToolKit();\ntk.open("json");\n```';

  function render(parent) {
    container = parent;
    container.innerHTML =
      '<div class="md-toolbar">' +
        '<button class="btn small md-view-btn active" data-view="source">Source</button>' +
        '<button class="btn small md-view-btn" data-view="split">Split</button>' +
        '<button class="btn small md-view-btn" data-view="preview">Preview</button>' +
        '<div class="spacer"></div>' +
        '<button class="btn small" id="mdCopy">Copy</button>' +
      '</div>' +
      '<div id="mdContainer" class="md-container split">' +
        '<div class="md-source-pane">' +
          '<div class="pane-label">MARKDOWN</div>' +
          '<textarea id="mdSource" class="md-textarea" placeholder="Write Markdown here..." spellcheck="false">' +
            textareaSafe(sampleMd) +
          '</textarea>' +
        '</div>' +
        '<div id="mdPreview" class="md-preview-pane">' +
          '<div class="pane-label">PREVIEW</div>' +
          '<div id="mdPreviewContent" class="md-preview-content"></div>' +
        '</div>' +
      '</div>';

    bindEvents();
    renderPreview();
  }

  function bindEvents() {
    var btns = container.querySelectorAll('.md-view-btn');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        viewMode = this.dataset.view;
        btns.forEach(function (bb) { bb.classList.remove('active'); });
        this.classList.add('active');
        var cEl = document.getElementById('mdContainer');
        cEl.className = 'md-container ' + viewMode;
      });
    });

    document.getElementById('mdSource').addEventListener('input', function () {
      renderPreview();
    });

    document.getElementById('mdCopy').addEventListener('click', function () {
      var ta = document.getElementById('mdSource');
      ta.select();
      document.execCommand('copy');
    });
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

  function textareaSafe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  return { render: render };
})();