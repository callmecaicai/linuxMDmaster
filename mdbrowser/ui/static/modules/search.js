window.MDB_Search = (function(){
  function bind(state) {
    var input = document.getElementById('search');
    input.addEventListener('input', function(){
      var q = this.value.trim().toLowerCase();
      state.searchQuery = q;
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(function(){
        state.syncFiles();
        state.searchTimer = null;
      }, 150);
    });

    if (!document.body.__mdbSearchShortcutBound) {
      document.body.__mdbSearchShortcutBound = true;
      document.addEventListener('keydown', function(event){
        var active = document.activeElement;
        var tagName = active && active.tagName ? active.tagName.toLowerCase() : '';
        if (tagName === 'input' || tagName === 'textarea' || (active && active.isContentEditable)) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key !== '/') return;
        event.preventDefault();
        input.focus();
        input.select();
      });
    }
  }
  return { bind: bind };
})();
