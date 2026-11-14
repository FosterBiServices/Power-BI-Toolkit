// Data and privacy page: the Clear all pages button (same as the home page's)
(function(){
  const $ = id => document.getElementById(id);
  const showClear = on => { $('pvClearConfirm').hidden = !on; $('pvClearAll').hidden = on; $('pvClearAll').setAttribute('aria-expanded', on); if (on) { $('pvClearDone').textContent = ''; $('pvClearNo').focus(); } };
  $('pvClearAll').addEventListener('click', () => showClear(true));
  $('pvClearNo').addEventListener('click', () => { showClear(false); $('pvClearAll').focus(); });
  $('pvClearYes').addEventListener('click', () => { SF_SUITE.clearAll(); showClear(false); $('pvClearDone').textContent = 'Every tool is empty and the saved model export is removed.'; $('pvClearAll').focus(); });
})();
