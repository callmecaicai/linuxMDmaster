window.MDB_Refresh = (function(){
  function buildReadQuery(state, path, stamp) {
    var params = ['path=' + encodeURIComponent(path)];
    var dirs = (state && state.roots) || [];
    for (var i = 0; i < dirs.length; i++) {
      params.push('dirs=' + encodeURIComponent(dirs[i]));
    }
    if (stamp) params.push('_t=' + stamp);
    return params.join('&');
  }

  function doRefresh(state, silent) {
    var btn = document.getElementById('rfBtn');
    if (!silent) { btn.disabled = true; btn.textContent = '刷新中...'; }
    return fetch('/refresh?' + buildDirsQuery(state.roots))
      .then(function(r){ return r.json(); })
      .then(function(data){
        state.applyPayload(data);
        if (!silent) {
          btn.disabled = false;
          btn.textContent = data.changed || data.deleted ? ('已更新 ' + data.changed + ' / 删除 ' + data.deleted) : '刷新';
          setTimeout(function(){ btn.textContent = '刷新'; }, 1400);
        }
      })
      .then(function(){
      state.contentCache = {};
      var tasks = [];
      for (var i = 0; i < state.openTabs.length; i++) {
        (function(tab){
          MDB_Tabs.renderPaneState(tab.paneEl, '刷新中...', 'pane-loading');
          tasks.push(
            fetch('/read?' + buildReadQuery(state, tab.path, Date.now()))
              .then(function(r){
                if (!r.ok) throw new Error('read_failed');
                return r.text();
              })
              .then(function(h){
                state.contentCache[tab.path] = h;
                MDB_Tabs.renderPaneContent(tab.paneEl, h);
              })
              .catch(function(){
                MDB_Tabs.renderPaneState(tab.paneEl, '读取失败', 'pane-loading');
              })
          );
        })(state.openTabs[i]);
      }
      return Promise.all(tasks);
    }).catch(function(){
      if (!silent) {
        btn.disabled = false;
        btn.textContent = '刷新失败';
        setTimeout(function(){ btn.textContent = '刷新'; }, 1400);
      }
    });
  }

  return { doRefresh: doRefresh };
})();
