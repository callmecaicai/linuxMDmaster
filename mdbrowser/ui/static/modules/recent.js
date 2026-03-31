window.MDB_Recent = (function(){
  var boundState = null;

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(v) {
    return escapeHtml(v).replace(/`/g, '&#96;');
  }

  function basename(path) {
    var parts = String(path || '').split('/');
    return parts[parts.length - 1] || String(path || '');
  }

  function readRecentDocsFromStorage() {
    try {
      return JSON.parse(sessionStorage.getItem('md_recent_docs') || '[]');
    } catch (e) {
      return [];
    }
  }

  function writeRecentDocsToStorage(docs) {
    try {
      sessionStorage.setItem('md_recent_docs', JSON.stringify(docs || []));
    } catch (e) {}
  }

  function normalizeRecentDocs(docs) {
    var out = [];
    var seen = {};
    var items = Array.isArray(docs) ? docs : [];
    for (var i = 0; i < items.length; i++) {
      var doc = items[i] || {};
      if (!doc.path || seen[doc.path]) continue;
      seen[doc.path] = true;
      out.push({
        path: String(doc.path),
        name: doc.name || basename(doc.path),
        type: doc.type || 'md'
      });
      if (out.length >= 12) break;
    }
    return out;
  }

  function getRecentDocs(state) {
    var source = state && Array.isArray(state.recentDocs) ? state.recentDocs
      : (boundState && Array.isArray(boundState.recentDocs) ? boundState.recentDocs : readRecentDocsFromStorage());
    return normalizeRecentDocs(source);
  }

  function setRecentDocs(state, docs) {
    var normalized = normalizeRecentDocs(docs);
    if (state) state.recentDocs = normalized;
    if (boundState && state === boundState) boundState.recentDocs = normalized;
    writeRecentDocsToStorage(normalized);
    return normalized;
  }

  function addRecentDoc(doc, state) {
    var targetState = state || boundState;
    if (!targetState || !doc || !doc.path) return;
    var next = [{
      path: String(doc.path),
      name: doc.name || basename(doc.path),
      type: doc.type || 'md'
    }].concat(getRecentDocs(targetState).filter(function(item){ return item.path !== doc.path; }));
    setRecentDocs(targetState, next);
    renderRecentDocs(targetState);
  }

  function renderRecentDocs(state) {
    if (state) boundState = state;
    var box = document.getElementById('recentDocs');
    if (!box) return;
    var items = getRecentDocs(state || boundState);
    if (!items.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    var h = '<div class="recent-head">最近打开</div>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var name = it.name || basename(it.path);
      h += '<button class="recent-item" data-path="' + escapeAttr(it.path) + '" data-name="' + escapeAttr(name) + '" data-type="' + escapeAttr(it.type || 'md') + '">' +
        '<span class="recent-dot"></span><span class="recent-name">' + escapeHtml(name) + '</span></button>';
    }
    box.innerHTML = h;
  }

  function bind(state) {
    boundState = state;
    setRecentDocs(state, state.recentDocs);
    var box = document.getElementById('recentDocs');
    if (!box) return;
    if (box.__mdbRecentBound) {
      renderRecentDocs(state);
      return;
    }
    box.__mdbRecentBound = true;
    box.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.recent-item');
      if (!btn) return;
      MDB_Tabs.openFile(btn.dataset.path, btn.dataset.name, btn.dataset.type || 'md', state);
    });
    renderRecentDocs(state);
  }

  return { addRecentDoc: addRecentDoc, renderRecentDocs: renderRecentDocs, bind: bind };
})();
