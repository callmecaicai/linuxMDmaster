window.MDB_Tabs = (function(){
  function buildReadQuery(path, state) {
    var params = ['path=' + encodeURIComponent(path)];
    var roots = (state && state.roots) || [];
    for (var i = 0; i < roots.length; i++) {
      params.push('dirs=' + encodeURIComponent(roots[i]));
    }
    return params.join('&');
  }

  function basename(path) {
    var parts = String(path || '').split('/');
    return parts[parts.length - 1] || String(path || '');
  }

  function getOpenTab(path, state) {
    var tabs = state && Array.isArray(state.openTabs) ? state.openTabs : [];
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].path === path) return tabs[i];
    }
    return null;
  }

  function touchRecent(tab, state) {
    MDB_Recent.addRecentDoc({ path: tab.path, name: tab.name, type: tab.type }, state);
  }

  function renderPaneState(paneEl, text, extraClass) {
    if (!paneEl) return;
    paneEl.innerHTML =
      '<div class="reader-shell reader-shell-state">' +
      '<p class="' + (extraClass || 'pane-loading') + '">' + String(text || '') + '</p>' +
      '</div>';
  }

  function renderPaneContent(paneEl, html) {
    if (!paneEl) return;
    paneEl.innerHTML =
      '<div class="reader-shell">' +
      '<article class="md-reader-container">' + String(html || '') + '</article>' +
      '</div>';
  }

  function openFile(path, name, ftype, state) {
    if (!state) return;
    var docPath = String(path || '');
    if (!docPath) return;
    var docName = name || basename(docPath);
    var docType = (ftype || 'md').toLowerCase();
    var existing = getOpenTab(docPath, state);
    if (existing) {
      state.activateTab(existing);
      touchRecent(existing, state);
      return;
    }

    document.getElementById('emptyPane').classList.remove('act');
    var tabEl = document.createElement('div');
    tabEl.className = 'tab';
    var sp1 = document.createElement('span');
    sp1.textContent = docName;
    sp1.title = docPath;
    var sp2 = document.createElement('span');
    sp2.className = 'x';
    sp2.textContent = '\u2715';
    tabEl.appendChild(sp1);
    tabEl.appendChild(sp2);
    document.getElementById('tabs').appendChild(tabEl);

    var paneEl = document.createElement('div');
    paneEl.className = 'pane';
    renderPaneState(paneEl, '加载中...', 'pane-loading');
    document.getElementById('panes').appendChild(paneEl);

    var tab = {path: docPath, name: docName, type: docType, tabEl: tabEl, paneEl: paneEl};
    state.openTabs.push(tab);
    syncCloseAllButton(state);
    tabEl.addEventListener('click', function(ev){ if (ev.target === sp2) return; state.activateTab(tab); touchRecent(tab, state); });
    sp2.addEventListener('click', function(ev){ ev.stopPropagation(); closeTab(tab, state); });
    state.activateTab(tab);
    touchRecent(tab, state);

    if (state.contentCache[docPath]) {
      renderPaneContent(paneEl, state.contentCache[docPath]);
      return;
    }

    fetch('/read?' + buildReadQuery(docPath, state))
      .then(function(r){
        if (!r.ok) throw new Error('read_failed');
        return r.text();
      })
      .then(function(h){
        state.contentCache[docPath] = h;
        renderPaneContent(paneEl, h);
      })
      .catch(function(){
        renderPaneState(paneEl, '读取失败', 'pane-loading');
      });
  }

  function activateTab(tab, state) {
    if (!tab || !state) return;
    var tabs = Array.isArray(state.openTabs) ? state.openTabs : [];
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].tabEl.classList.toggle('act', tabs[i] === tab);
      tabs[i].paneEl.classList.toggle('act', tabs[i] === tab);
    }
    state.activeTab = tab;
  }

  function syncCloseAllButton(state) {
    var btn = document.getElementById('tabsCloseAll');
    if (btn) btn.disabled = !state || !state.openTabs || !state.openTabs.length;
  }

  function closeTab(tab, state) {
    if (!state || !Array.isArray(state.openTabs)) return;
    var idx = state.openTabs.indexOf(tab);
    if (idx < 0) return;
    state.openTabs.splice(idx, 1);
    tab.tabEl.remove();
    tab.paneEl.remove();
    if (state.openTabs.length > 0) {
      state.activateTab(state.openTabs[Math.min(idx, state.openTabs.length - 1)]);
    } else {
      state.activeTab = null;
      document.getElementById('emptyPane').classList.add('act');
    }
    syncCloseAllButton(state);
  }

  function closeAllTabs(state) {
    if (!state || !Array.isArray(state.openTabs) || !state.openTabs.length) return;
    while (state.openTabs.length) {
      var tab = state.openTabs.pop();
      tab.tabEl.remove();
      tab.paneEl.remove();
    }
    state.activeTab = null;
    document.getElementById('emptyPane').classList.add('act');
    syncCloseAllButton(state);
  }

  return {
    openFile: openFile,
    activateTab: activateTab,
    closeTab: closeTab,
    closeAllTabs: closeAllTabs,
    syncCloseAllButton: syncCloseAllButton,
    renderPaneContent: renderPaneContent,
    renderPaneState: renderPaneState
  };
})();
