// alexisparron.com analytics: Consent Mode v2 + GTM + cookie banner.
// Same setup as scripts/analytics-snippet.html on alexisparron.com, as a file
// because this site's CSP does not allow inline scripts. Load it first in <head>.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: /(?:^|; )ap_consent=granted/.test(document.cookie) ? 'granted' : 'denied',
  wait_for_update: 500
});
(function (w, d, s, l, i) {
  w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
  j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f);
})(window, document, 'script', 'dataLayer', 'GTM-TJ78RL4D');
(function () {
  var c = document.createElement('script');
  c.src = 'https://www.alexisparron.com/consent.js'; c.defer = true;
  document.head.appendChild(c);
})();
