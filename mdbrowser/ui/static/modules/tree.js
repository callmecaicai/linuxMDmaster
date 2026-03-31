window.MDB_Tree = (function(){
  function isBranchSelected(path, currentFilterPath) {
    if (!currentFilterPath) return false;
    return currentFilterPath === path || currentFilterPath.indexOf(path + '/') === 0;
  }

  function isActiveTrail(path, currentFilterPath) {
    if (!currentFilterPath) return false;
    return currentFilterPath === path || currentFilterPath.indexOf(path + '/') === 0;
  }

  function renderTrees(trees, state) {
    var sb = document.getElementById('sb');
    var nodes = Array.isArray(trees) ? trees : [];
    var i;
    sb.innerHTML = '';
    for (i = 0; i < nodes.length; i++) buildNode(nodes[i], sb, state || {});
  }

  function buildNode(node, parent, state) {
    var hasChildren = node && Array.isArray(node.children) && node.children.length;
    var wrap = document.createElement('div');
    var label = document.createElement('div');
    var arrow = document.createElement('span');
    var icon = document.createElement('span');
    var name = document.createElement('span');
    var childrenWrap = null;
    var i;
    var selected = state.currentFilterPath === node.path;
    var open = hasChildren && isBranchSelected(node.path, state.currentFilterPath);
    var trail = isActiveTrail(node.path, state.currentFilterPath);

    wrap.className = 'tree-node';
    wrap.classList.add('depth-' + Math.min(node.depth || 0, 3));
    if (trail) wrap.classList.add('trail');

    label.className = 'lbl';
    label.classList.add('depth-' + Math.min(node.depth || 0, 3));
    label.style.paddingLeft = (8 + node.depth * 12) + 'px';
    if (selected) label.classList.add('sel');
    if (trail && !selected) label.classList.add('trail');
    if (hasChildren) label.classList.add('branch');
    if (open) label.classList.add('opn');

    arrow.className = 'ar';
    arrow.textContent = hasChildren ? '\u25B6' : '';
    if (open) arrow.classList.add('op');
    if (!hasChildren) arrow.style.visibility = 'hidden';

    icon.className = 'tree-ic';
    icon.textContent = open ? '▣' : (hasChildren ? '▣' : '▢');

    name.className = 'tree-name';
    name.textContent = node.name;

    label.appendChild(arrow);
    label.appendChild(icon);
    label.appendChild(name);
    wrap.appendChild(label);

    if (hasChildren) {
      childrenWrap = document.createElement('div');
      childrenWrap.className = 'ch' + (open ? ' op' : '');
      for (i = 0; i < node.children.length; i++) buildNode(node.children[i], childrenWrap, state);
      wrap.appendChild(childrenWrap);
    }

    label.addEventListener('click', function(){
      if (state && typeof state.selectPath === 'function') state.selectPath(node.path);
    });

    parent.appendChild(wrap);
  }

  return { renderTrees: renderTrees };
})();
