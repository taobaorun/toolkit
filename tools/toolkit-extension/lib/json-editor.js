// json-editor.js — Enhanced JSON Editor module
// Tree mode: inline editing, node operations, type conversion, expand/collapse all, counts
// Code mode: textarea with line numbers and error reporting
// Compare mode: delegates to JsonCompare for structural diff
// @author yuanxuan

var JsonEditor = (function () {
  'use strict';

  var container, mode;

  // --- Undo/Redo history ---
  var history = { stack: [], index: -1, maxSize: 100 };

  function pushHistory(value) {
    // Discard redo history beyond current index
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(value);
    if (history.stack.length > history.maxSize) history.stack.shift();
    else history.index++;
  }

  function undo() {
    if (history.index > 0) {
      history.index--;
      return history.stack[history.index];
    }
    return null;
  }

  function redo() {
    if (history.index < history.stack.length - 1) {
      history.index++;
      return history.stack[history.index];
    }
    return null;
  }

  // --- Render entry point ---

  function render(parent) {
    container = parent;
    mode = 'tree';

    container.innerHTML =
      '<div class="json-toolbar" id="jsonToolbar">' +
        buildToolbarHTML() +
      '</div>' +
      // Tree mode
      '<div id="jsonTreeArea" class="json-editor-area">' +
        '<div class="json-editor-pane">' +
          '<div class="pane-label">SOURCE</div>' +
          '<textarea id="jsonSource" class="json-textarea" placeholder="Paste JSON here..." spellcheck="false"></textarea>' +
        '</div>' +
        '<div class="json-tree-pane">' +
          '<div class="pane-label">' +
            'TREE' +
            '<span class="tree-toggle-all" id="treeExpandAll" title="Expand all">[+]</span>' +
            '<span class="tree-toggle-all" id="treeCollapseAll" title="Collapse all">[&minus;]</span>' +
          '</div>' +
          '<div id="jsonTree" class="json-tree"></div>' +
        '</div>' +
      '</div>' +
      // Code mode
      '<div id="jsonCodeArea" class="json-code-area hidden">' +
        '<div class="json-code-layout">' +
          '<div class="line-numbers" id="lineNumbers"></div>' +
          '<textarea id="jsonCodeSource" class="json-code-textarea" placeholder="Paste JSON here..." spellcheck="false"></textarea>' +
        '</div>' +
        '<div id="jsonCodeError" class="json-code-error hidden"></div>' +
      '</div>' +
      // Compare mode
      '<div id="jsonCompareArea" class="json-compare-area hidden">' +
        '<div class="json-compare-panes">' +
          '<div class="json-compare-pane">' +
            '<div class="pane-label">A — ORIGINAL</div>' +
            '<textarea id="jsonCompareA" class="json-textarea" placeholder="Paste original JSON..." spellcheck="false"></textarea>' +
          '</div>' +
          '<div class="json-compare-pane">' +
            '<div class="pane-label">B — CHANGED</div>' +
            '<textarea id="jsonCompareB" class="json-textarea" placeholder="Paste changed JSON..." spellcheck="false"></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="json-compare-toolbar" id="jsonCompareToolbar"></div>' +
        '<div id="jsonDiffView" class="json-diff-view"></div>' +
      '</div>' +
      // Hidden file input for upload
      '<input type="file" id="jsonFileInput" class="hidden" accept=".json,application/json">';

    bindEvents();
    updateModeUI();
    renderTree();
    pushHistory(document.getElementById('jsonSource').value);
  }

  // --- Toolbar ---

  function buildToolbarHTML() {
    return '' +
      '<div class="json-mode-tabs">' +
        '<button class="btn small active" data-json-mode="tree" id="jsonModeTree">Tree</button>' +
        '<button class="btn small" data-json-mode="code" id="jsonModeCode">Code</button>' +
        '<button class="btn small" data-json-mode="compare" id="jsonModeCompare">Compare</button>' +
      '</div>' +
      '<div class="spacer"></div>' +
      '<span class="search-icon-wrap"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.3-4.3"/></svg></span>' +
      '<input type="text" class="json-search" id="jsonSearch" placeholder="Search..." />' +
      '<button class="btn small" id="jsonBeautify" title="Format JSON">Format</button>' +
      '<button class="btn small" id="jsonMinify" title="Minify JSON">Minify</button>' +
      '<button class="btn small" id="jsonSort" title="Sort keys alphabetically">Sort</button>' +
      '<button class="btn small" id="jsonCopy" title="Copy to clipboard">Copy</button>' +
      '<button class="btn small" id="jsonDownload" title="Download as .json"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>' +
      '<button class="btn small" id="jsonUpload" title="Load from file"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></button>';
  }

  // --- Event binding ---

  function bindEvents() {
    // Mode switching
    var modeBtns = container.querySelectorAll('[data-json-mode]');
    modeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        mode = this.dataset.jsonMode;
        updateModeUI();
        if (mode === 'tree') {
          syncSourceToTree();
          renderTree();
        } else if (mode === 'code') {
          syncSourceToCode();
          updateLineNumbers();
        } else if (mode === 'compare') {
          syncSourceToCompare();
          JsonCompare.render(document.getElementById('jsonCompareArea'));
        }
      });
    });

    // Source textarea (Tree mode) — debounced tree re-render
    var srcTextarea = document.getElementById('jsonSource');
    var debounce;
    srcTextarea.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        renderTree();
        pushHistory(srcTextarea.value);
      }, 300);
    });
    // Undo/Redo on keydown for Tree source
    srcTextarea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
      }
    });

    // Code source textarea
    var codeTextarea = document.getElementById('jsonCodeSource');
    codeTextarea.addEventListener('input', function () {
      updateLineNumbers();
      showCodeError();
    });
    codeTextarea.addEventListener('scroll', function () {
      document.getElementById('lineNumbers').scrollTop = codeTextarea.scrollTop;
    });
    codeTextarea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndoCode();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleRedoCode();
      }
    });
    // Push history on code input (debounced)
    var codeDebounce;
    codeTextarea.addEventListener('input', function () {
      clearTimeout(codeDebounce);
      codeDebounce = setTimeout(function () {
        pushHistory(codeTextarea.value);
      }, 500);
    });

    // Common buttons
    document.getElementById('jsonBeautify').addEventListener('click', function () {
      var ta = getActiveTextarea();
      try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); pushHistory(ta.value); }
      catch (_) {}
      afterTextareaChange();
    });
    document.getElementById('jsonMinify').addEventListener('click', function () {
      var ta = getActiveTextarea();
      try { ta.value = JSON.stringify(JSON.parse(ta.value)); pushHistory(ta.value); }
      catch (_) {}
      afterTextareaChange();
    });
    document.getElementById('jsonSort').addEventListener('click', function () {
      var ta = getActiveTextarea();
      try { var obj = JSON.parse(ta.value); ta.value = JSON.stringify(sortObjectKeys(obj), null, 2); pushHistory(ta.value); }
      catch (_) {}
      afterTextareaChange();
    });
    document.getElementById('jsonCopy').addEventListener('click', function () {
      var ta = getActiveTextarea();
      ta.select();
      document.execCommand('copy');
      showToast('Copied to clipboard');
    });
    document.getElementById('jsonDownload').addEventListener('click', function () {
      var ta = getActiveTextarea();
      try {
        // Validate JSON before download
        JSON.parse(ta.value);
        var blob = new Blob([ta.value], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'toolkit-export.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Downloaded');
      } catch (_) {
        showToast('Invalid JSON — cannot download');
      }
    });
    document.getElementById('jsonUpload').addEventListener('click', function () {
      document.getElementById('jsonFileInput').click();
    });
    document.getElementById('jsonFileInput').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var ta = getActiveTextarea();
        try {
          // Validate and beautify
          var parsed = JSON.parse(e.target.result);
          ta.value = JSON.stringify(parsed, null, 2);
          pushHistory(ta.value);
          afterTextareaChange();
          showToast('File loaded: ' + file.name);
        } catch (err) {
          showToast('Invalid JSON file');
        }
      };
      reader.readAsText(file);
      this.value = '';
    });

    // Search — keep ancestors visible when descendants match
    document.getElementById('jsonSearch').addEventListener('input', function () {
      var q = this.value.toLowerCase();
      if (mode === 'tree') {
        filterTreeNodes(q);
      } else if (mode === 'code') {
        filterCodeLines(q);
      }
    });

    // Expand / Collapse all
    document.getElementById('treeExpandAll').addEventListener('click', function () {
      var toggles = document.querySelectorAll('.tree-toggle:not(.open)');
      toggles.forEach(function (t) { t.click(); });
    });
    document.getElementById('treeCollapseAll').addEventListener('click', function () {
      var toggles = document.querySelectorAll('.tree-toggle.open');
      // Collapse deepest first to avoid parent collapsing children prematurely
      var arr = Array.prototype.slice.call(toggles);
      arr.reverse();
      arr.forEach(function (t) { t.click(); });
    });

    // Global keydown for undo/redo in tree/code modes
    document.addEventListener('keydown', function (e) {
      // Already handled for textarea above; this catches focus on non-textarea elements
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (mode === 'tree') handleUndo();
        else if (mode === 'code') handleUndoCode();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (mode === 'tree') handleRedo();
        else if (mode === 'code') handleRedoCode();
      }
    });
  }

  // --- Mode UI ---

  function updateModeUI() {
    var treeBtn = document.getElementById('jsonModeTree');
    var codeBtn = document.getElementById('jsonModeCode');
    var compareBtn = document.getElementById('jsonModeCompare');
    var treeArea = document.getElementById('jsonTreeArea');
    var codeArea = document.getElementById('jsonCodeArea');
    var compareArea = document.getElementById('jsonCompareArea');

    [treeBtn, codeBtn, compareBtn].forEach(function (b) { b.classList.remove('active'); });
    if (mode === 'tree') { treeBtn.classList.add('active'); treeArea.classList.remove('hidden'); codeArea.classList.add('hidden'); compareArea.classList.add('hidden'); }
    else if (mode === 'code') { codeBtn.classList.add('active'); treeArea.classList.add('hidden'); codeArea.classList.remove('hidden'); compareArea.classList.add('hidden'); }
    else if (mode === 'compare') { compareBtn.classList.add('active'); treeArea.classList.add('hidden'); codeArea.classList.add('hidden'); compareArea.classList.remove('hidden'); }
  }

  function getActiveTextarea() {
    if (mode === 'code') return document.getElementById('jsonCodeSource');
    if (mode === 'compare') return document.getElementById('jsonCompareA');
    return document.getElementById('jsonSource');
  }

  function afterTextareaChange() {
    if (mode === 'tree') renderTree();
    else if (mode === 'code') { updateLineNumbers(); showCodeError(); }
  }

  function syncSourceToTree() {
    var codeTa = document.getElementById('jsonCodeSource');
    var treeTa = document.getElementById('jsonSource');
    if (codeTa.value !== treeTa.value) {
      treeTa.value = codeTa.value;
    }
  }

  function syncSourceToCode() {
    var treeTa = document.getElementById('jsonSource');
    var codeTa = document.getElementById('jsonCodeSource');
    if (treeTa.value !== codeTa.value) {
      codeTa.value = treeTa.value;
    }
  }

  function syncSourceToCompare() {
    var srcTa = document.getElementById('jsonSource');
    var cmpA = document.getElementById('jsonCompareA');
    if (srcTa.value !== cmpA.value) {
      cmpA.value = srcTa.value;
    }
  }

  // --- Undo/Redo handlers ---

  function handleUndo() {
    var snapshot = undo();
    if (snapshot !== null) {
      var ta = document.getElementById('jsonSource');
      ta.value = snapshot;
      renderTree();
    }
  }

  function handleRedo() {
    var snapshot = redo();
    if (snapshot !== null) {
      var ta = document.getElementById('jsonSource');
      ta.value = snapshot;
      renderTree();
    }
  }

  function handleUndoCode() {
    var snapshot = undo();
    if (snapshot !== null) {
      var ta = document.getElementById('jsonCodeSource');
      ta.value = snapshot;
      updateLineNumbers();
      showCodeError();
    }
  }

  function handleRedoCode() {
    var snapshot = redo();
    if (snapshot !== null) {
      var ta = document.getElementById('jsonCodeSource');
      ta.value = snapshot;
      updateLineNumbers();
      showCodeError();
    }
  }

  // === Tree Mode ========================================================

  function filterTreeNodes(q) {
    var all = document.querySelectorAll('.json-tree-node, .json-tree-branch');
    // Single flat list: mark each node matching
    var matches = {};
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (!q) { matches[i] = true; continue; }
      var key = (n.dataset.key || '').toLowerCase();
      var val = (n.dataset.val || '').toLowerCase();
      matches[i] = key.indexOf(q) !== -1 || val.indexOf(q) !== -1;
    }
    // Propagate match upward: if a child matches, its branch ancestors must stay visible
    for (var j = 0; j < all.length; j++) {
      if (!matches[j]) continue;
      var el = all[j].parentElement;
      while (el) {
        // Find the branch element that contains this node
        if (el.classList && el.classList.contains('json-tree-branch')) {
          // Mark this branch as matching
          for (var k = 0; k < all.length; k++) {
            if (all[k] === el) { matches[k] = true; break; }
          }
        }
        el = el.parentElement;
      }
    }
    // Apply visibility
    for (var m = 0; m < all.length; m++) {
      all[m].style.display = matches[m] ? '' : 'none';
    }
  }

  function filterCodeLines(q) {
    var ta = document.getElementById('jsonCodeSource');
    var lines = ta.value.split('\n');
    var lnDiv = document.getElementById('lineNumbers');
    if (!q) {
      var nums = '';
      for (var i = 1; i <= Math.max(lines.length, 1); i++) nums += i + '\n';
      lnDiv.innerHTML = nums;
      return;
    }
    var highlighted = '';
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().indexOf(q) !== -1) {
        highlighted += '<span style="color:var(--text)">' + (i + 1) + '</span>\n';
      } else {
        highlighted += (i + 1) + '\n';
      }
    }
    lnDiv.innerHTML = highlighted;
  }

  function renderTree() {
    var tree = document.getElementById('jsonTree');
    var src = document.getElementById('jsonSource').value;
    // A blank editor is the empty state, not an error.
    if (src.trim() === '') { tree.innerHTML = ''; return; }
    try {
      var data = JSON.parse(src);
      tree.innerHTML = '<div class="json-tree-root">' + renderNode(data, '', 0, []) + '</div>';
      bindTreeToggles(tree);
      bindTreeDelegation(tree);
    } catch (e) {
      tree.innerHTML = '<div class="json-parse-error">' + escapeHtml(e.message || 'Invalid JSON') + '</div>';
    }
  }

  function renderNode(val, keyPath, depth, parentPath) {
    var indent = '';
    for (var i = 0; i < depth; i++) indent += '  ';

    var displayKey = (keyPath === '' || keyPath === 0 || (typeof keyPath === 'number')) ? String(keyPath) : keyPath;
    // Skip empty root key to avoid paths like ['', 'user'] that break navigation
    var fullPath = keyPath === '' ? parentPath.slice() : parentPath.concat([keyPath]);
    var pathStr = fullPath.join('/');
    var type = getJsonType(val);

    if (val === null) {
      return '<div class="json-tree-node" data-key="' + escapeHtml(displayKey) + '" data-val="null" data-path="' + escapeHtml(pathStr) + '" data-type="null">' +
        '<span class="json-tree-key node-key" data-path="' + escapeHtml(pathStr) + '" data-is-key="true">' + escapeHtml(displayKey) + '</span>: ' +
        '<span class="json-tree-null node-val" data-path="' + escapeHtml(pathStr) + '" data-is-key="false">null</span>' +
        '<span class="json-type-tag json-type-null-tag">null</span>' +
        buildNodeActionButtons(pathStr, 'null') +
      '</div>';
    }

    if (typeof val === 'boolean') {
      return '<div class="json-tree-node" data-key="' + escapeHtml(displayKey) + '" data-val="' + val + '" data-path="' + escapeHtml(pathStr) + '" data-type="boolean">' +
        '<span class="json-tree-key node-key" data-path="' + escapeHtml(pathStr) + '" data-is-key="true">' + escapeHtml(displayKey) + '</span>: ' +
        '<span class="json-tree-bool node-val" data-path="' + escapeHtml(pathStr) + '" data-is-key="false">' + val + '</span>' +
        '<span class="json-type-tag json-type-bool-tag">bool</span>' +
        buildNodeActionButtons(pathStr, 'boolean') +
      '</div>';
    }

    if (typeof val === 'number') {
      return '<div class="json-tree-node" data-key="' + escapeHtml(displayKey) + '" data-val="' + val + '" data-path="' + escapeHtml(pathStr) + '" data-type="number">' +
        '<span class="json-tree-key node-key" data-path="' + escapeHtml(pathStr) + '" data-is-key="true">' + escapeHtml(displayKey) + '</span>: ' +
        '<span class="json-tree-number node-val" data-path="' + escapeHtml(pathStr) + '" data-is-key="false">' + val + '</span>' +
        '<span class="json-type-tag json-type-number-tag">num</span>' +
        buildNodeActionButtons(pathStr, 'number') +
      '</div>';
    }

    if (typeof val === 'string') {
      return '<div class="json-tree-node" data-key="' + escapeHtml(displayKey) + '" data-val="' + escapeHtml(val) + '" data-path="' + escapeHtml(pathStr) + '" data-type="string">' +
        '<span class="json-tree-key node-key" data-path="' + escapeHtml(pathStr) + '" data-is-key="true">' + escapeHtml(displayKey) + '</span>: ' +
        '<span class="json-tree-string node-val" data-path="' + escapeHtml(pathStr) + '" data-is-key="false">&quot;' + escapeHtml(val) + '&quot;</span>' +
        '<span class="json-type-tag json-type-string-tag">str</span>' +
        buildNodeActionButtons(pathStr, 'string') +
      '</div>';
    }

    if (Array.isArray(val)) {
      var arrId = 'tree-' + Math.random().toString(36).slice(2);
      var count = val.length;
      var countText = count + ' item' + (count !== 1 ? 's' : '');
      var html = '<div class="json-tree-branch" data-key="' + escapeHtml(displayKey) + '" data-type="array" data-path="' + escapeHtml(pathStr) + '" data-val="">' +
        '<span class="tree-toggle open" data-target="' + arrId + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>' +
        '<span class="json-tree-key node-key" data-path="' + escapeHtml(pathStr) + '" data-is-key="true">' + escapeHtml(displayKey) + '</span>: [' +
        '<span class="json-tree-count" id="' + arrId + '-count"> ' + countText + ' </span>' +
        buildNodeActionButtons(pathStr, 'array') +
        '<div class="json-tree-children" id="' + arrId + '">';
      for (var j = 0; j < val.length; j++) {
        html += renderNode(val[j], j, depth + 1, fullPath);
      }
      html += '</div>]</div>';
      return html;
    }

    if (typeof val === 'object') {
      var objId = 'tree-' + Math.random().toString(36).slice(2);
      var keys = Object.keys(val);
      var propCount = keys.length;
      var propText = propCount + ' propert' + (propCount !== 1 ? 'ies' : 'y');
      var label = keyPath !== '' ? ('<span class="json-tree-key node-key" data-path="' + escapeHtml(pathStr) + '" data-is-key="true">' + escapeHtml(displayKey) + '</span>: ') : '';
      var objHtml = '<div class="json-tree-branch" data-key="' + escapeHtml(displayKey) + '" data-type="object" data-path="' + escapeHtml(pathStr) + '" data-val="">' +
        '<span class="tree-toggle open" data-target="' + objId + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>' +
        label + '{' +
        '<span class="json-tree-count" id="' + objId + '-count"> ' + propText + ' </span>' +
        buildNodeActionButtons(pathStr, 'object') +
        '<div class="json-tree-children" id="' + objId + '">';
      for (var k = 0; k < keys.length; k++) {
        objHtml += renderNode(val[keys[k]], keys[k], depth + 1, fullPath);
      }
      objHtml += '</div>}</div>';
      return objHtml;
    }

    return '';
  }

  function buildNodeActionButtons(pathStr, type) {
    var html = '<span class="node-actions" data-path="' + escapeHtml(pathStr) + '" data-type="' + escapeHtml(type) + '">';
    if (type === 'object' || type === 'array') {
      html += '<button class="node-act-btn node-act-add" title="Add child">+</button>';
    }
    html += '<button class="node-act-btn node-act-dup" title="Duplicate">&#x29C9;</button>';
    html += '<button class="node-act-btn node-act-del" title="Remove">&times;</button>';
    html += '</span>';
    return html;
  }

  // --- Tree toggles ---

  function bindTreeToggles(root) {
    var toggles = root.querySelectorAll('.tree-toggle');
    toggles.forEach(function (t) {
      t.addEventListener('click', function () {
        var targetId = t.dataset.target;
        var target = document.getElementById(targetId);
        if (!target) return;
        var isOpen = t.classList.contains('open');
        var countEl = document.getElementById(targetId + '-count');
        if (isOpen) {
          t.classList.remove('open');
          target.style.display = 'none';
          if (countEl) countEl.style.display = 'inline';
        } else {
          t.classList.add('open');
          target.style.display = '';
          if (countEl) countEl.style.display = 'none';
        }
      });
    });
  }

  // --- Unified tree interaction delegation ---
  // Single click handler walks up from e.target; handles ALL tree interactions:
  // node action buttons, inline value/key edit, and type tag cycling.
  // This avoids conflicts between multiple handlers on the same element.

  var treeDelegator;

  function bindTreeDelegation(root) {
    if (treeDelegator) root.removeEventListener('click', treeDelegator);

    treeDelegator = function (e) {
      var el = e.target;

      while (el && el !== root) {
        if (!el.classList) { el = el.parentElement; continue; }

        // -- Node action buttons (+ / dup / ×) --
        if (el.classList.contains('node-act-btn')) {
          e.stopPropagation();
          e.preventDefault();
          var actions = findAncestor(el, 'node-actions');
          if (!actions) return;
          var path = actions.dataset.path;
          var type = actions.dataset.type;
          if (el.classList.contains('node-act-add')) { addChildNode(path, type); }
          else if (el.classList.contains('node-act-dup')) { duplicateNode(path); }
          else if (el.classList.contains('node-act-del')) { removeNodeAt(path); }
          return;
        }

        // -- Inline value edit --
        if (el.classList.contains('node-val')) {
          e.stopPropagation();
          var currentVal = el.textContent;
          if (currentVal.charAt(0) === '"' && currentVal.charAt(currentVal.length - 1) === '"') {
            currentVal = currentVal.slice(1, -1);
          }
          startInlineEdit(el, el.dataset.path, currentVal, false);
          return;
        }

        // -- Inline key edit --
        if (el.classList.contains('node-key')) {
          e.stopPropagation();
          startInlineEdit(el, el.dataset.path, el.textContent, true);
          return;
        }

        // -- Type tag cycling --
        if (el.classList.contains('json-type-tag')) {
          e.stopPropagation();
          var parentNode = el.parentElement;
          if (parentNode) cycleType(parentNode.dataset.path);
          return;
        }

        el = el.parentElement;
      }
    };

    root.addEventListener('click', treeDelegator);
  }

  function findAncestor(el, cls) {
    while (el) {
      if (el.classList && el.classList.contains(cls)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function startInlineEdit(el, path, currentValue, isKey) {
    // Close any existing edit
    var existing = container.querySelector('.tree-inline-input');
    if (existing) cancelEdit();

    var input = document.createElement('input');
    input.className = 'tree-inline-input';
    input.value = currentValue;
    input.style.width = Math.max(currentValue.length * 8 + 20, 40) + 'px';
    input.dataset.path = path;
    input.dataset.isKey = isKey ? 'true' : 'false';
    input.dataset.originalValue = currentValue;

    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      var newVal = input.value;
      if (newVal === input.dataset.originalValue) return; // No change
      commitEdit(path, newVal, isKey);
    }

    function cancel() {
      el.textContent = isKey ? input.dataset.originalValue : formatDisplayValue(input.dataset.originalValue, 'string');
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', function () {
      // Small delay so click on another element can be processed first
      setTimeout(function () {
        if (input.parentElement && container.contains(input)) {
          commit();
        }
      }, 150);
    });
  }

  function cancelEdit() {
    var input = container.querySelector('.tree-inline-input');
    if (!input) return;
    var el = input.parentElement;
    var isKey = input.dataset.isKey === 'true';
    el.textContent = isKey ? input.dataset.originalValue : formatDisplayValue(input.dataset.originalValue, 'string');
  }

  function commitEdit(path, newValue, isKey) {
    var srcTextarea = document.getElementById('jsonSource');
    try {
      var data = JSON.parse(srcTextarea.value);
      var pathParts = parsePath(path);
      if (isKey) {
        renameKey(data, pathParts, newValue);
      } else {
        var typedValue = coerceValue(newValue);
        setValueAtPath(data, pathParts, typedValue);
      }
      srcTextarea.value = JSON.stringify(data, null, 2);
      pushHistory(srcTextarea.value);
      renderTree();
    } catch (e) {
      renderTree();
    }
  }

  // --- Node operation implementations ---

  function addChildNode(path, parentType) {
    var srcTextarea = document.getElementById('jsonSource');
    try {
      var data = JSON.parse(srcTextarea.value);
      var pathParts = parsePath(path);
      var parent = (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === '')) ? data : getValueAtPath(data, pathParts);
      if (!parent || typeof parent !== 'object') return;

      if (Array.isArray(parent)) {
        parent.push(null);
      } else {
        // Generate unique key
        var base = 'newKey';
        var idx = 1;
        while (parent.hasOwnProperty(base + idx)) idx++;
        parent[base + idx] = '';
      }
      srcTextarea.value = JSON.stringify(data, null, 2);
      pushHistory(srcTextarea.value);
      renderTree();
    } catch (e) {
      // Invalid JSON — ignore
    }
  }

  function duplicateNode(path) {
    var srcTextarea = document.getElementById('jsonSource');
    try {
      var data = JSON.parse(srcTextarea.value);
      var pathParts = parsePath(path);
      var target = getValueAtPath(data, pathParts);
      var parentPath = pathParts.slice(0, -1);
      var lastKey = pathParts[pathParts.length - 1];
      var parent = (parentPath.length === 0) ? data : getValueAtPath(data, parentPath);

      if (!parent || typeof parent !== 'object') return;
      var cloned = JSON.parse(JSON.stringify(target));

      if (Array.isArray(parent)) {
        var idx = typeof lastKey === 'number' ? lastKey : parseInt(lastKey, 10);
        if (!isNaN(idx)) parent.splice(idx + 1, 0, cloned);
        else parent.push(cloned);
      } else {
        var base = String(lastKey) + '_copy';
        var i = 1;
        while (parent.hasOwnProperty(base + i)) i++;
        parent[base + i] = cloned;
      }
      srcTextarea.value = JSON.stringify(data, null, 2);
      pushHistory(srcTextarea.value);
      renderTree();
    } catch (e) {
      // Invalid JSON — ignore
    }
  }

  function removeNodeAt(path) {
    var srcTextarea = document.getElementById('jsonSource');
    try {
      var data = JSON.parse(srcTextarea.value);
      var pathParts = parsePath(path);
      removeAtPath(data, pathParts);
      srcTextarea.value = JSON.stringify(data, null, 2);
      pushHistory(srcTextarea.value);
      renderTree();
    } catch (e) {
      // Invalid JSON — ignore
    }
  }

  function cycleType(path) {
    var srcTextarea = document.getElementById('jsonSource');
    try {
      var data = JSON.parse(srcTextarea.value);
      var pathParts = parsePath(path);
      var current = getValueAtPath(data, pathParts);
      var next;
      if (current === null) next = false;
      else if (typeof current === 'boolean') next = 0;
      else if (typeof current === 'number') next = '';
      else next = null;
      setValueAtPath(data, pathParts, next);
      srcTextarea.value = JSON.stringify(data, null, 2);
      pushHistory(srcTextarea.value);
      renderTree();
    } catch (e) {
      // Invalid JSON — ignore
    }
  }

  // === Code Mode ========================================================

  function updateLineNumbers() {
    var ta = document.getElementById('jsonCodeSource');
    var lines = ta.value.split('\n');
    var lnDiv = document.getElementById('lineNumbers');
    var maxLine = Math.max(lines.length, 1);
    var html = '';
    for (var i = 1; i <= maxLine; i++) html += i + '\n';
    lnDiv.textContent = html;
    lnDiv.scrollTop = ta.scrollTop;
  }

  function showCodeError() {
    var ta = document.getElementById('jsonCodeSource');
    var errDiv = document.getElementById('jsonCodeError');
    // A blank editor is the empty state, not an error.
    if (ta.value.trim() === '') {
      errDiv.classList.add('hidden');
      errDiv.textContent = '';
      return;
    }
    try {
      JSON.parse(ta.value);
      errDiv.classList.add('hidden');
      errDiv.textContent = '';
    } catch (e) {
      var msg = e.message || 'Invalid JSON';
      // Extract line/col if present in message
      errDiv.textContent = msg;
      errDiv.classList.remove('hidden');
    }
  }

  // === Compare Mode =====================================================

  // Compare mode uses the pre-built DOM and delegates to JsonCompare.render()

  // === JSON path helpers ================================================

  function parsePath(pathStr) {
    if (!pathStr) return [];
    return pathStr.split('/').map(function (seg) {
      var num = parseInt(seg, 10);
      return isNaN(num) ? seg : num;
    });
  }

  function getValueAtPath(obj, path) {
    var current = obj;
    for (var i = 0; i < path.length; i++) {
      if (current === null || typeof current !== 'object') return undefined;
      current = current[path[i]];
    }
    return current;
  }

  function setValueAtPath(obj, path, value) {
    if (path.length === 0) return;
    var current = obj;
    for (var i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  function removeAtPath(obj, path) {
    if (path.length === 0) return;
    var current = obj;
    for (var i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    var last = path[path.length - 1];
    if (Array.isArray(current)) {
      current.splice(last, 1);
    } else {
      delete current[last];
    }
  }

  function renameKey(obj, path, newKey) {
    if (path.length === 0) return;
    var parentPath = path.slice(0, -1);
    var oldKey = path[path.length - 1];
    var parent = (parentPath.length === 0) ? obj : getValueAtPath(obj, parentPath);
    if (!parent || typeof parent !== 'object') return;

    // Rebuild object with new key order
    var newObj = {};
    var keys = Object.keys(parent);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === String(oldKey)) {
        newObj[newKey] = parent[oldKey];
      } else {
        newObj[keys[i]] = parent[keys[i]];
      }
    }
    // Replace in parent
    if (parentPath.length === 0) {
      // Root object — copy back
      Object.keys(obj).forEach(function (k) { delete obj[k]; });
      Object.keys(newObj).forEach(function (k) { obj[k] = newObj[k]; });
    } else {
      setValueAtPath(obj, parentPath, newObj);
    }
  }

  function coerceValue(raw) {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    var num = Number(raw);
    if (!isNaN(num) && raw.trim() !== '') return num;
    return raw;
  }

  function getJsonType(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  }

  function formatDisplayValue(val, type) {
    if (val === null) return 'null';
    if (typeof val === 'string') return '"' + val + '"';
    return String(val);
  }

  function sortObjectKeys(obj) {
    if (Array.isArray(obj)) {
      return obj.map(function (item) { return sortObjectKeys(item); });
    }
    if (obj !== null && typeof obj === 'object') {
      var sorted = {};
      var keys = Object.keys(obj).sort();
      for (var i = 0; i < keys.length; i++) {
        sorted[keys[i]] = sortObjectKeys(obj[keys[i]]);
      }
      return sorted;
    }
    return obj;
  }

  // --- Toast ---

  function showToast(msg) {
    var toast = document.getElementById('toolkitToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toolkitToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function () {
      toast.classList.remove('show');
    }, 1800);
  }

  // --- Utilities ---

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render: render };
})();