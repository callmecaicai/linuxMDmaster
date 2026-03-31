window.MDB_Docs = (function(){
  function basename(path) {
    var parts = String(path || '').split('/');
    return parts[parts.length - 1] || String(path || '');
  }

  function normalizeDir(path) {
    var value = String(path || '');
    if (value.length > 1 && value.slice(-1) === '/') return value.slice(0, -1);
    return value;
  }

  function isPathUnder(path, root) {
    var filePath = normalizeDir(path);
    var rootPath = normalizeDir(root);
    if (!filePath || !rootPath) return false;
    return filePath === rootPath || filePath.indexOf(rootPath + '/') === 0;
  }

  function relativeTo(root, path) {
    var rootPath = normalizeDir(root);
    var filePath = normalizeDir(path);
    if (!rootPath || !filePath || !isPathUnder(filePath, rootPath)) return '';
    if (filePath === rootPath) return '';
    return filePath.slice(rootPath.length + 1);
  }

  function dirname(path) {
    var value = String(path || '');
    var idx = value.lastIndexOf('/');
    return idx < 0 ? '' : value.slice(0, idx);
  }

  function cloneFile(file) {
    var out = {};
    var key;
    for (key in file) out[key] = file[key];
    return out;
  }

  function sortFiles(files) {
    return (files || []).slice().sort(function(a, b){
      return String(a.path || '').localeCompare(String(b.path || ''));
    });
  }

  function findNodeByPath(trees, targetPath) {
    var nodes = Array.isArray(trees) ? trees : [];
    var target = normalizeDir(targetPath);
    var i;
    for (i = 0; i < nodes.length; i++) {
      var found = findNode(nodes[i], target);
      if (found) return found;
    }
    return null;
  }

  function findNode(node, targetPath) {
    var children;
    var i;
    if (!node || normalizeDir(node.path) !== targetPath) {
      children = node && Array.isArray(node.children) ? node.children : [];
      for (i = 0; i < children.length; i++) {
        var found = findNode(children[i], targetPath);
        if (found) return found;
      }
      return null;
    }
    return node;
  }

  function pathExistsInTrees(trees, targetPath) {
    return !!findNodeByPath(trees, targetPath);
  }

  function pickInitialPath(trees, preferredRoots, rootParam) {
    var nodes = Array.isArray(trees) ? trees : [];
    var i;
    var preferred = Array.isArray(preferredRoots) ? preferredRoots : [];

    for (i = 0; i < preferred.length; i++) {
      if (pathExistsInTrees(nodes, preferred[i])) return preferred[i];
    }

    if (rootParam) {
      for (i = 0; i < nodes.length; i++) {
        if (isPathUnder(nodes[i].path, rootParam)) return nodes[i].path;
      }
    }

    return nodes.length ? nodes[0].path : null;
  }

  function buildBreadcrumbs(currentPath, roots) {
    var path = normalizeDir(currentPath);
    var rootList = Array.isArray(roots) ? roots.slice() : [];
    var i;
    var selectedRoot = '';
    var crumbs = [];
    var rel;
    var parts;
    var acc;

    if (!path) return crumbs;

    rootList.sort(function(a, b){ return String(b || '').length - String(a || '').length; });
    for (i = 0; i < rootList.length; i++) {
      if (isPathUnder(path, rootList[i])) {
        selectedRoot = normalizeDir(rootList[i]);
        break;
      }
    }
    if (!selectedRoot) selectedRoot = path;

    crumbs.push({ path: selectedRoot, label: basename(selectedRoot) || selectedRoot, current: selectedRoot === path });
    if (selectedRoot === path) return crumbs;

    rel = relativeTo(selectedRoot, path);
    parts = rel ? rel.split('/').filter(Boolean) : [];
    acc = selectedRoot;
    for (i = 0; i < parts.length; i++) {
      acc = normalizeDir(acc + '/' + parts[i]);
      crumbs.push({ path: acc, label: parts[i], current: acc === path });
    }
    return crumbs;
  }

  function enrichFile(file, scopePath, sectionPath) {
    var next = cloneFile(file || {});
    var scopeRelativePath = relativeTo(scopePath, next.path || '');
    var sectionRelativePath = relativeTo(sectionPath, next.path || '');
    next.scopeRelativePath = scopeRelativePath;
    next.sectionRelativePath = sectionRelativePath;
    next.scopeRelativeDir = dirname(scopeRelativePath);
    next.sectionRelativeDir = dirname(sectionRelativePath);
    return next;
  }

  function buildSection(label, kind, path, files) {
    return {
      label: label,
      kind: kind,
      path: path,
      files: sortFiles(files)
    };
  }

  function groupForDirectory(files, currentPath, trees) {
    var scopePath = normalizeDir(currentPath);
    var selectedNode = findNodeByPath(trees, scopePath);
    var source = sortFiles(files);
    var directFiles = [];
    var childGroups = {};
    var sections = [];
    var orderedChildren = [];
    var seen = {};
    var i;
    var relPath;
    var parts;
    var groupName;
    var childPath;
    var fileItem;
    var keys;

    if (!scopePath) {
      return {
        currentLabel: '当前目录',
        total: 0,
        sections: []
      };
    }

    for (i = 0; i < source.length; i++) {
      relPath = relativeTo(scopePath, source[i].path || '');
      if (!relPath) continue;
      parts = relPath.split('/').filter(Boolean);
      if (!parts.length) continue;
      if (parts.length === 1) {
        directFiles.push(enrichFile(source[i], scopePath, scopePath));
        continue;
      }
      groupName = parts[0];
      childPath = normalizeDir(scopePath + '/' + groupName);
      if (!childGroups[groupName]) childGroups[groupName] = [];
      fileItem = enrichFile(source[i], scopePath, childPath);
      childGroups[groupName].push(fileItem);
    }

    if (directFiles.length) {
      sections.push(buildSection(selectedNode ? selectedNode.name : basename(scopePath) || scopePath, 'current', scopePath, directFiles));
    }

    if (selectedNode && Array.isArray(selectedNode.children)) {
      for (i = 0; i < selectedNode.children.length; i++) {
        orderedChildren.push(selectedNode.children[i].name);
      }
    } else {
      orderedChildren = Object.keys(childGroups).sort();
    }

    for (i = 0; i < orderedChildren.length; i++) {
      groupName = orderedChildren[i];
      if (!childGroups[groupName] || seen[groupName]) continue;
      seen[groupName] = true;
      sections.push(buildSection(groupName, 'child', normalizeDir(scopePath + '/' + groupName), childGroups[groupName]));
    }

    keys = Object.keys(childGroups).sort();
    for (i = 0; i < keys.length; i++) {
      groupName = keys[i];
      if (seen[groupName]) continue;
      sections.push(buildSection(groupName, 'child', normalizeDir(scopePath + '/' + groupName), childGroups[groupName]));
    }

    return {
      currentLabel: selectedNode ? selectedNode.name : basename(scopePath) || scopePath,
      total: source.length,
      sections: sections
    };
  }

  function filterByPath(files, path) {
    if (!path) return (files || []).slice();
    return (files || []).filter(function(file){
      file = file || {};
      return isPathUnder(file.path || '', path);
    });
  }

  function filterByQuery(files, query) {
    var q = (query || '').trim().toLowerCase();
    var terms;
    if (!q) return (files || []).slice();
    terms = q.split(/\s+/).filter(Boolean);
    return (files || []).filter(function(file){
      file = file || {};
      var hay = [
        file.name || '',
        file.title || '',
        file.path || ''
      ].join(' ').toLowerCase();
      var i;
      for (i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });
  }

  return {
    buildBreadcrumbs: buildBreadcrumbs,
    filterByPath: filterByPath,
    filterByQuery: filterByQuery,
    findNodeByPath: findNodeByPath,
    groupForDirectory: groupForDirectory,
    pathExistsInTrees: pathExistsInTrees,
    pickInitialPath: pickInitialPath
  };
})();
