var rootParam = new URLSearchParams(location.search).get('root') || '.';

function buildDirsQuery(roots) {
  return (roots || []).map(function(root){
    return 'dirs=' + encodeURIComponent(root);
  }).join('&');
}

function safeReadArray(key) {
  try {
    var value = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(Boolean) : [];
  } catch (err) {
    return [];
  }
}

function renderBreadcrumbs() {
  var el = document.getElementById('crumbs');
  var crumbs = MDB_Docs.buildBreadcrumbs(state.currentFilterPath, state.roots);
  var h = '';
  var i;

  if (!crumbs.length) {
    el.innerHTML = '<span class="crumb cur">未选择目录</span>';
    return;
  }

  for (i = 0; i < crumbs.length; i++) {
    if (i) h += '<span class="crumb-sep">/</span>';
    h += '<button class="crumb' + (crumbs[i].current ? ' cur' : '') + '" data-path="' +
      String(crumbs[i].path || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;') +
      '">' +
      String(crumbs[i].label || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;') +
      '</button>';
  }
  el.innerHTML = h;
}

function updateHeader() {
  var info = document.getElementById('mhInfo');
  var timing = document.getElementById('timing');
  var grouped = state.groupedFiles || {};
  var label = grouped.currentLabel || '当前目录';
  var pieces = [label, state.viewFiles.length + ' 篇文档'];
  if (state.searchQuery) pieces.push('搜索: ' + state.searchQuery);
  if (typeof state.lastLoadMs === 'number') pieces.push('加载 ' + state.lastLoadMs + 'ms');
  renderBreadcrumbs();
  info.textContent = pieces.join(' · ');
  timing.textContent = state.loadedFiles.length + ' 总文档 / ' + state.roots.length + ' 个根目录';
}

function ensureCurrentFilterPath() {
  if (state.currentFilterPath && MDB_Docs.pathExistsInTrees(state.treeRoots, state.currentFilterPath)) return;
  state.currentFilterPath = MDB_Docs.pickInitialPath(state.treeRoots, state.roots, rootParam);
}

function applyPayload(data, ms) {
  var files = (data && data.files) || [];
  var trees = (data && data.trees) || [];
  state.lastLoadMs = typeof ms === 'number' ? ms : null;
  state.loadedFiles = files.slice();
  state.baseFiles = state.loadedFiles.slice();
  state.treeRoots = trees.slice();
  ensureCurrentFilterPath();
  MDB_Tree.renderTrees(state.treeRoots, state);
  syncFiles();
}

var state = {
  roots: safeReadArray('md_dirs'),
  treeRoots: [],
  loadedFiles: [],
  baseFiles: [],
  viewFiles: [],
  groupedFiles: null,
  openTabs: [],
  activeTab: null,
  contentCache: {},
  recentDocs: safeReadArray('md_recent_docs'),
  autoRefreshMs: 5 * 60 * 1000,
  currentFilterPath: null,
  searchQuery: '',
  searchTimer: null,
  lastLoadMs: null,
  loadData: loadData,
  applyPayload: applyPayload,
  showPage: showPage,
  syncFiles: syncFiles,
  activateTab: function(tab){ MDB_Tabs.activateTab(tab, state); },
  selectPath: selectPath
};

if (!state.roots.length) location.href = '/?root=' + encodeURIComponent(rootParam);

function loadData() {
  document.getElementById('mhInfo').textContent = '加载中...';
  var t0 = performance.now();
  return fetch('/load?' + buildDirsQuery(state.roots))
    .then(function(r){ return r.json(); })
    .then(function(d){
      var ms = Math.round(performance.now() - t0);
      applyPayload(d, ms);
    })
    .catch(function(err){
      document.getElementById('mhInfo').textContent = '加载失败，请刷新重试';
      document.getElementById('crumbs').innerHTML = '<span class="crumb cur">目录读取失败</span>';
      document.getElementById('timing').textContent = '';
      return Promise.reject(err);
    });
}

function syncFiles() {
  var source = state.searchQuery ? MDB_Docs.filterByQuery(state.loadedFiles, state.searchQuery) : state.loadedFiles.slice();
  var scoped = state.currentFilterPath ? MDB_Docs.filterByPath(source, state.currentFilterPath) : source;
  state.viewFiles = scoped;
  state.groupedFiles = MDB_Docs.groupForDirectory(scoped, state.currentFilterPath, state.treeRoots);
  updateHeader();
  showPage();
  MDB_Recent.renderRecentDocs(state);
}

function showPage() {
  MDB_List.renderGroups(state.groupedFiles, state);
  MDB_List.renderPager();
}

function selectPath(path) {
  if (!path) return;
  state.currentFilterPath = path;
  MDB_Tree.renderTrees(state.treeRoots, state);
  syncFiles();
}

document.getElementById('crumbs').addEventListener('click', function(e){
  var btn = e.target.closest && e.target.closest('.crumb');
  if (!btn || !btn.dataset || !btn.dataset.path) return;
  selectPath(btn.dataset.path);
});

document.getElementById('ml').addEventListener('click', function(e){
  var target = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
  var actionEl = target && target.closest ? target.closest('[data-action]') : null;
  var card = target && target.closest ? target.closest('.cd') : null;
  if (actionEl && actionEl.dataset) {
    if (actionEl.dataset.action === 'open') {
      MDB_Tabs.openFile(actionEl.dataset.path, actionEl.dataset.name, actionEl.dataset.type || 'md', state);
    } else if (actionEl.dataset.action === 'copy') {
      navigator.clipboard.writeText(actionEl.dataset.path).then(function(){
        actionEl.textContent = '\u2714 已复制';
        setTimeout(function(){ actionEl.textContent = '复制路径'; }, 1200);
      });
    }
    return;
  }
  if (card && card.dataset) {
    MDB_Tabs.openFile(card.dataset.path, card.dataset.name, card.dataset.type || 'md', state);
  }
});

document.getElementById('ml').addEventListener('keydown', function(e){
  var target = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
  var card = target && target.closest ? target.closest('.cd') : null;
  if (!card || !card.dataset) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    MDB_Tabs.openFile(card.dataset.path, card.dataset.name, card.dataset.type || 'md', state);
  }
});

document.getElementById('search').setAttribute('placeholder', '过滤当前目录 (按 /)');

document.getElementById('rfBtn').addEventListener('click', function(){ MDB_Refresh.doRefresh(state, false); });
setInterval(function(){ MDB_Refresh.doRefresh(state, true); }, state.autoRefreshMs);
document.getElementById('tabsCloseAll').addEventListener('click', function(){ MDB_Tabs.closeAllTabs(state); });
MDB_Tabs.syncCloseAllButton(state);
document.getElementById('bkBtn').addEventListener('click', function(){
  var root = new URLSearchParams(location.search).get('root') || '.';
  location.href = '/?root=' + encodeURIComponent(root);
});

MDB_Search.bind(state);
MDB_Recent.bind(state);
MDB_Resize.setup('rz1', document.getElementById('sb'));
MDB_Resize.setup('rz2', document.querySelector('.mid'));
loadData().catch(function(){});
