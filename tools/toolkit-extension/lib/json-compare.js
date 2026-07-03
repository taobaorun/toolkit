// json-compare.js — JSON Compare module
// Structural diff: key-path-based comparison with tree-style colored output.
// @author yuanxuan

var JsonCompare = (function () {
  'use strict';

  function render(container) {
    bindCompare(container);
  }

  function bindCompare(container) {
    var taA = document.getElementById('jsonCompareA');
    var taB = document.getElementById('jsonCompareB');
    var diffView = document.getElementById('jsonDiffView');
    var toolbar = document.getElementById('jsonCompareToolbar');
    if (!taA || !taB || !diffView) return;

    // Build toolbar buttons if not present
    if (toolbar && !toolbar.querySelector('#diffFormatBtn')) {
      toolbar.innerHTML = '' +
        '<button class="btn small" id="diffFormatBtn">Format both</button>' +
        '<button class="btn small" id="diffSwapBtn">Swap</button>' +
        '<button class="btn small" id="diffStructuralBtn">Structural</button>' +
        '<button class="btn small" id="diffLineBtn">Line diff</button>';
    }

    var diffMode = 'structural';

    var renderDiff = function () {
      // Both panes empty is the initial state, not an error.
      if (taA.value.trim() === '' && taB.value.trim() === '') {
        diffView.innerHTML = '';
        return;
      }
      if (diffMode === 'structural') {
        renderStructuralDiff(taA, taB, diffView);
      } else {
        renderLineDiff(taA, taB, diffView);
      }
    };

    taA.addEventListener('input', renderDiff);
    taB.addEventListener('input', renderDiff);

    // Format both
    var formatBtn = document.getElementById('diffFormatBtn');
    if (formatBtn) {
      formatBtn.addEventListener('click', function () {
        try { taA.value = JSON.stringify(JSON.parse(taA.value), null, 2); } catch (_) {}
        try { taB.value = JSON.stringify(JSON.parse(taB.value), null, 2); } catch (_) {}
        renderDiff();
      });
    }

    // Swap
    var swapBtn = document.getElementById('diffSwapBtn');
    if (swapBtn) {
      swapBtn.addEventListener('click', function () {
        var tmp = taA.value;
        taA.value = taB.value;
        taB.value = tmp;
        renderDiff();
      });
    }

    // Toggle mode
    var structuralBtn = document.getElementById('diffStructuralBtn');
    var lineBtn = document.getElementById('diffLineBtn');
    if (structuralBtn) {
      structuralBtn.classList.add('active');
      structuralBtn.addEventListener('click', function () {
        diffMode = 'structural';
        structuralBtn.classList.add('active');
        lineBtn.classList.remove('active');
        renderDiff();
      });
    }
    if (lineBtn) {
      lineBtn.addEventListener('click', function () {
        diffMode = 'line';
        lineBtn.classList.add('active');
        structuralBtn.classList.remove('active');
        renderDiff();
      });
    }

    renderDiff();
  }

  // --- Structural diff ---

  function renderStructuralDiff(taA, taB, diffView) {
    try {
      var objA = JSON.parse(taA.value);
      var objB = JSON.parse(taB.value);
    } catch (e) {
      diffView.innerHTML = '<div class="json-parse-error">Invalid JSON: ' + escapeHtml(e.message || '') + '</div>';
      return;
    }

    var stats = { added: 0, removed: 0, changed: 0, unchanged: 0 };
    var treeHtml = '<div class="diff-stats">' +
      '<span class="diff-added">+' + stats.added + ' added</span> ' +
      '<span class="diff-removed">−' + stats.removed + ' removed</span> ' +
      '<span class="diff-changed">~' + stats.changed + ' changed</span> ' +
      '<span class="diff-unchanged">' + stats.unchanged + ' unchanged</span>' +
    '</div>' +
    '<div class="json-tree" style="padding-top:8px"><div class="json-tree-root">' +
      renderDiffNode(objA, objB, '', 0) +
    '</div></div>';

    diffView.innerHTML = treeHtml;

    // Bind tree toggles
    var toggles = diffView.querySelectorAll('.tree-toggle');
    toggles.forEach(function (t) {
      t.addEventListener('click', function () {
        var target = document.getElementById(t.dataset.target);
        if (!target) return;
        var isOpen = t.classList.contains('open');
        if (isOpen) { t.classList.remove('open'); target.style.display = 'none'; }
        else { t.classList.add('open'); target.style.display = ''; }
      });
    });

    // Update stats after rendering
    updateDiffStats(diffView, objA, objB);
  }

  function renderDiffNode(valA, valB, keyPath, depth) {
    var indent = '';
    for (var i = 0; i < depth; i++) indent += '  ';

    // Both are the same primitive
    if (valA === valB && typeof valA !== 'object') {
      return '<div class="diff-tree-node">' +
        '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ' +
        renderDiffValue(valA) + '</div>';
    }

    // Both null
    if (valA === null && valB === null) {
      return '<div class="diff-tree-node">' +
        '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ' +
        '<span class="json-tree-null">null</span></div>';
    }

    // A removed
    if (valA !== undefined && valB === undefined) {
      return '<div class="diff-tree-node diff-del-node">' +
        '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ' +
        renderDiffValue(valA) + ' <span style="font-size:10px;color:var(--bad)">removed</span></div>';
    }

    // B added
    if (valA === undefined && valB !== undefined) {
      return '<div class="diff-tree-node diff-add-node">' +
        '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ' +
        renderDiffValue(valB) + ' <span style="font-size:10px;color:var(--good)">added</span></div>';
    }

    // Type changed
    var typeA = getType(valA);
    var typeB = getType(valB);
    if (typeA !== typeB) {
      return '<div class="diff-tree-node diff-chg-node">' +
        '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ' +
        '<span class="diff-chg-del">' + renderDiffValue(valA) + '</span>' +
        '<span class="diff-chg-add">' + renderDiffValue(valB) + '</span></div>';
    }

    // Both objects — recurse
    if (typeA === 'object') {
      var id = 'diff-' + Math.random().toString(36).slice(2);
      var allKeys = {};
      Object.keys(valA || {}).forEach(function (k) { allKeys[k] = (allKeys[k] || 0) + 1; });
      Object.keys(valB || {}).forEach(function (k) { allKeys[k] = (allKeys[k] || 0) + 1; });
      var sortedKeys = Object.keys(allKeys).sort();

      var label = keyPath !== '' ? ('<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ') : '';
      var changes = countChanges(valA, valB);
      var badge = '';
      if (changes.added > 0 || changes.removed > 0 || changes.changed > 0) {
        badge = ' <span style="font-size:10px;color:var(--clay)">(' +
          (changes.added > 0 ? '+' + changes.added + ' ' : '') +
          (changes.removed > 0 ? '−' + changes.removed + ' ' : '') +
          (changes.changed > 0 ? '~' + changes.changed : '') + ')</span>';
      }

      var html = '<div class="diff-tree-node">' +
        '<span class="tree-toggle open" data-target="' + id + '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>' +
        '</span>' + label + '{' + badge +
        '<div class="json-tree-children" id="' + id + '">';

      for (var i = 0; i < sortedKeys.length; i++) {
        var k = sortedKeys[i];
        html += renderDiffNode(valA ? valA[k] : undefined, valB ? valB[k] : undefined, k, depth + 1);
      }
      html += '</div>}</div>';
      return html;
    }

    // Both arrays — recurse by index
    if (typeA === 'array') {
      var arrId = 'diff-' + Math.random().toString(36).slice(2);
      var maxLen = Math.max(valA.length, valB.length);
      var arrBadge = '';
      if (valA.length !== valB.length) {
        arrBadge = ' <span style="font-size:10px;color:var(--clay)">(' + valA.length + ' → ' + valB.length + ')</span>';
      }

      var html = '<div class="diff-tree-node">' +
        '<span class="tree-toggle open" data-target="' + arrId + '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>' +
        '</span>' +
        '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: [' + arrBadge +
        '<div class="json-tree-children" id="' + arrId + '">';

      for (var j = 0; j < maxLen; j++) {
        html += renderDiffNode(valA[j], valB[j], j, depth + 1);
      }
      html += '</div>]</div>';
      return html;
    }

    // Both primitives but different values
    return '<div class="diff-tree-node diff-chg-node">' +
      '<span class="diff-tree-key">' + escapeHtml(String(keyPath)) + '</span>: ' +
      '<span class="diff-chg-del">' + renderDiffValue(valA) + '</span> ' +
      '<span class="diff-chg-add">' + renderDiffValue(valB) + '</span></div>';
  }

  function renderDiffValue(val) {
    if (val === null) return '<span class="json-tree-null">null</span>';
    if (val === undefined) return '<span class="json-tree-null" style="opacity:0.5">—</span>';
    if (typeof val === 'string') return '<span class="json-tree-string">&quot;' + escapeHtml(val) + '&quot;</span>';
    if (typeof val === 'number') return '<span class="json-tree-number">' + val + '</span>';
    if (typeof val === 'boolean') return '<span class="json-tree-bool">' + val + '</span>';
    return escapeHtml(String(val));
  }

  function countChanges(a, b) {
    var result = { added: 0, removed: 0, changed: 0 };
    var keys = {};
    Object.keys(a || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(b || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      if (!(k in (a || {}))) result.added++;
      else if (!(k in (b || {}))) result.removed++;
      else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) result.changed++;
    });
    return result;
  }

  function updateDiffStats(diffView, objA, objB) {
    var stats = countChanges(objA, objB);
    var statsEl = diffView.querySelector('.diff-stats');
    if (statsEl) {
      statsEl.innerHTML =
        '<span class="diff-added">+' + stats.added + ' added</span> ' +
        '<span class="diff-removed">−' + stats.removed + ' removed</span> ' +
        '<span class="diff-unchanged" style="color:var(--clay)">~' + stats.changed + ' changed</span>';
    }
  }

  // --- Line diff (original behavior) ---

  function renderLineDiff(taA, taB, diffView) {
    try {
      var linesA = JSON.stringify(JSON.parse(taA.value), null, 2).split('\n');
      var linesB = JSON.stringify(JSON.parse(taB.value), null, 2).split('\n');
    } catch (_) {
      diffView.innerHTML = '<div class="json-parse-error">Invalid JSON</div>';
      return;
    }

    var added = 0, removed = 0, unchanged = 0;
    var usedB = {};
    var diffA = [], diffB = [];

    for (var i = 0; i < linesA.length; i++) {
      var found = false;
      for (var k = 0; k < linesB.length; k++) {
        if (!usedB[k] && linesB[k] === linesA[i]) { found = true; usedB[k] = true; break; }
      }
      if (found) { diffA.push({ text: linesA[i], type: 'same' }); unchanged++; }
      else { diffA.push({ text: linesA[i], type: 'removed' }); removed++; }
    }
    for (var j = 0; j < linesB.length; j++) {
      if (usedB[j]) { diffB.push({ text: linesB[j], type: 'same' }); }
      else { diffB.push({ text: linesB[j], type: 'added' }); added++; }
    }

    var html = '<div class="diff-stats"><span class="diff-added">+' + added + ' added</span> <span class="diff-removed">−' + removed + ' removed</span> <span class="diff-unchanged">' + unchanged + ' unchanged</span></div>';
    html += '<div class="diff-columns"><div class="diff-col"><div class="pane-label">A — ORIGINAL</div><pre><code>';

    var numA = 0;
    for (var ai = 0; ai < diffA.length; ai++) {
      numA++;
      var cls = diffA[ai].type === 'removed' ? 'diff-removed' : '';
      html += '<span class="diff-line ' + cls + '"><span class="diff-num">' + numA + '</span>' + escapeHtml(diffA[ai].text) + '</span>\n';
    }
    html += '</code></pre></div>';

    html += '<div class="diff-col"><div class="pane-label">B — CHANGED</div><pre><code>';
    var numB = 0;
    for (var bi = 0; bi < diffB.length; bi++) {
      numB++;
      var clsB = diffB[bi].type === 'added' ? 'diff-added' : '';
      html += '<span class="diff-line ' + clsB + '"><span class="diff-num">' + numB + '</span>' + escapeHtml(diffB[bi].text) + '</span>\n';
    }
    html += '</code></pre></div></div>';

    diffView.innerHTML = html;
  }

  function getType(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render: render };
})();