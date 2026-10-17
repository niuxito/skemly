// Landing language, set before first paint: ?lang= wins, then the saved
// choice, then the browser.
(function () {
  var q = new URLSearchParams(location.search).get('lang');
  var saved = null;
  try { saved = localStorage.getItem('landing-lang'); } catch (e) {}
  var lang = q || saved || ((navigator.language || 'es').toLowerCase().indexOf('es') === 0 ? 'es' : 'en');
  document.documentElement.lang = lang === 'en' ? 'en' : 'es';
})();
