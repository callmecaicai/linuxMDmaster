window.MDB_Resize = (function(){
  function setup(rzId, target) {
    var rz = document.getElementById(rzId);
    var startX, startW;
    rz.addEventListener('mousedown', function(e){
      e.preventDefault();
      startX = e.clientX;
      startW = target.offsetWidth;
      rz.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      function onMove(e){
        var nw = startW + (e.clientX - startX);
        if (nw < 120) nw = 120;
        if (nw > 600) nw = 600;
        target.style.width = nw + 'px';
      }
      function onUp(){
        rz.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  return { setup: setup };
})();
