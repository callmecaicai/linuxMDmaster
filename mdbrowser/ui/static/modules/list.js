window.MDB_List = (function(){
  var GENERIC_FILE_NAMES = {
    'readme.md': true,
    'index.md': true,
    'home.md': true
  };

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

  function formatDate(mtime) {
    var ts = Number(mtime);
    if (!isFinite(ts) || ts <= 0) return '';
    var d = new Date(ts * 1000);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  function isGenericFileName(name) {
    return !!GENERIC_FILE_NAMES[String(name || '').toLowerCase()];
  }

  function buildCardModel(file, section) {
    var filename = String(file && (file.title || file.name) || '');
    var sectionLabel = String(section && section.label || '');
    var generic = isGenericFileName(file && file.name);
    var subtitle = '';

    if (generic) {
      return {
        title: sectionLabel || filename,
        subtitle: filename,
        generic: true
      };
    }

    if (section && section.kind === 'current') {
      subtitle = file && file.scopeRelativeDir ? String(file.scopeRelativeDir) : '当前目录';
    } else if (file && file.sectionRelativeDir) {
      subtitle = sectionLabel ? (sectionLabel + ' / ' + file.sectionRelativeDir) : String(file.sectionRelativeDir);
    } else {
      subtitle = sectionLabel || '子目录';
    }

    return {
      title: filename,
      subtitle: subtitle,
      generic: false
    };
  }

  function buildMeta(file) {
    var parts = [];
    var date = formatDate(file && file.mtime);
    if (date) parts.push('更新 ' + escapeHtml(date));
    return parts.length ? '<div class="file-meta">' + parts.join(' · ') + '</div>' : '';
  }

  function renderGroups(grouped, state) {
    var el = document.getElementById('ml');
    var data = grouped || {};
    var sections = Array.isArray(data.sections) ? data.sections : [];
    var query = state && state.searchQuery ? String(state.searchQuery) : '';
    var h = '';
    var i;
    var j;
    var section;
    var files;
    var file;
    var model;

    if (!sections.length) {
      h = '<div class="group-empty">' +
        '<strong>' + escapeHtml((data && data.currentLabel) || '当前目录') + '</strong>' +
        '<span>' + (query ? '当前搜索条件下没有匹配的 Markdown 文档。' : '这个目录下还没有可展示的 Markdown 文档。') + '</span>' +
        '</div>';
      el.innerHTML = h;
      return;
    }

    for (i = 0; i < sections.length; i++) {
      section = sections[i] || {};
      files = Array.isArray(section.files) ? section.files : [];
      h += '<section class="doc-group ' + (section.kind === 'current' ? 'grp-current' : 'grp-child') + '">' +
        '<div class="doc-group-head">' +
        '<div class="doc-group-title">' + escapeHtml(section.label || '未命名目录') + '</div>' +
        '<div class="doc-group-meta">' +
        '<span class="doc-group-kind">' + (section.kind === 'current' ? '当前目录' : '子目录') + '</span>' +
        '<span class="doc-group-count">' + files.length + ' 篇</span>' +
        '</div></div>' +
        '<div class="doc-group-list">';

      for (j = 0; j < files.length; j++) {
        file = files[j] || {};
        model = buildCardModel(file, section);
        h += '<div class="cd' + (model.generic ? ' generic' : '') + '" role="button" tabindex="0" title="' + escapeAttr(file.path || '') + '"' +
          ' data-path="' + escapeAttr(file.path || '') + '"' +
          ' data-name="' + escapeAttr(file.name || '') + '"' +
          ' data-type="' + escapeAttr(file.type || 'md') + '">' +
          '<div class="file-body">' +
          '<div class="file-head">' +
          '<span class="fn' + (model.generic ? ' fn-generic' : '') + '">' + escapeHtml(model.title || '') + '<span class="file-badge md">MD</span></span>' +
          (model.subtitle ? '<div class="file-sub">' + escapeHtml(model.subtitle) + '</div>' : '') +
          buildMeta(file) +
          '</div>' +
          '</div>' +
          '<div class="btns">' +
          '<button class="ob" data-action="open" data-path="' + escapeAttr(file.path || '') + '" data-name="' + escapeAttr(file.name || '') + '" data-type="' + escapeAttr(file.type || 'md') + '">打开</button>' +
          '<button class="cb" data-action="copy" data-path="' + escapeAttr(file.path || '') + '">复制路径</button>' +
          '</div></div>';
      }

      h += '</div></section>';
    }

    el.innerHTML = h;
  }

  function renderPager() {
    document.getElementById('pgr').innerHTML = '';
  }

  return {
    renderGroups: renderGroups,
    renderPager: renderPager
  };
})();
