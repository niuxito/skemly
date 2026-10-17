// Landing page: language switch, the live DSL → diagram hero and the contact form.
(function () {
  var root = document.documentElement;
  function lang() { return root.lang === 'en' ? 'en' : 'es'; }

  // ── Language switch ─────────────────────────────────────────────────────────
  var listeners = [];
  function applyLang() {
    document.querySelectorAll('[data-ph-es]').forEach(function (el) {
      el.placeholder = el.getAttribute('data-ph-' + lang());
    });
    document.title = lang() === 'en' ? 'Skemly · Case study · Alexis Parrón' : 'Skemly · Caso de estudio · Alexis Parrón';
    listeners.forEach(function (fn) { fn(); });
  }
  document.getElementById('lang-switch').addEventListener('click', function () {
    root.lang = lang() === 'en' ? 'es' : 'en';
    try { localStorage.setItem('landing-lang', root.lang); } catch (e) {}
    applyLang();
  });

  // ── Hero: the DSL is typed line by line and each line reveals its part ─────
  var LINES = {
    es: [
      ['<span class="t">&lt;Internet&gt;</span> -&gt; <span class="s">[Balanceador]</span><span class="k">#info</span>', 1],
      ['<span class="k">group</span> "Nube privada" <span class="k">#safe</span> {', 2],
      ['  <span class="s">[Balanceador]</span> -&gt; <span class="s">[App 1]</span>, <span class="s">[App 2]</span>', 3],
      ['  <span class="s">[App 1]</span>, <span class="s">[App 2]</span> -&gt; <span class="t">(Base de datos)</span>', 4],
      ['}', 4]
    ],
    en: [
      ['<span class="t">&lt;Internet&gt;</span> -&gt; <span class="s">[Load balancer]</span><span class="k">#info</span>', 1],
      ['<span class="k">group</span> "Private cloud" <span class="k">#safe</span> {', 2],
      ['  <span class="s">[Load balancer]</span> -&gt; <span class="s">[App 1]</span>, <span class="s">[App 2]</span>', 3],
      ['  <span class="s">[App 1]</span>, <span class="s">[App 2]</span> -&gt; <span class="t">(Database)</span>', 4],
      ['}', 4]
    ]
  };
  var STATUS = {
    es: { typing: 'escribiendo…', done: 'listo · el código lo ha colocado' },
    en: { typing: 'writing…', done: 'done · the code laid it out' }
  };
  var code = document.getElementById('code');
  var status = document.getElementById('status');
  var groups = document.querySelectorAll('.stage [data-step]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal(step) {
    groups.forEach(function (g) { g.classList.toggle('on', +g.dataset.step <= step); });
  }
  function plain(html) {
    var d = document.createElement('div'); d.innerHTML = html; return d.textContent;
  }
  function escape(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var timer = null, line = 0, chars = 0, done = [];
  function restart() {
    clearTimeout(timer);
    line = 0; chars = 0; done = [];
    if (reduce) {
      code.innerHTML = LINES[lang()].map(function (l) { return l[0]; }).join('\n');
      status.textContent = STATUS[lang()].done;
      reveal(4);
      return;
    }
    reveal(0);
    status.textContent = STATUS[lang()].typing;
    tick();
  }
  function tick() {
    var lines = LINES[lang()];
    if (line >= lines.length) {
      status.textContent = STATUS[lang()].done;
      timer = setTimeout(restart, 3500);
      return;
    }
    var text = plain(lines[line][0]);
    chars += 1;
    var current = chars >= text.length ? lines[line][0] : escape(text.slice(0, chars));
    code.innerHTML = done.concat(current).join('\n') + '<span class="cursor"></span>';
    if (chars >= text.length) {
      reveal(lines[line][1]);
      done.push(lines[line][0]);
      line += 1; chars = 0;
      timer = setTimeout(tick, 450);
    } else {
      timer = setTimeout(tick, 28);
    }
  }
  listeners.push(restart);

  // ── Contact form → /api/chat?op=contact → Telegram ─────────────────────────
  var form = document.getElementById('contact-form');
  var formStatus = document.getElementById('form-status');
  var TEXT = {
    es: { sending: 'Enviando…', ok: 'Recibido. Te respondo pronto.', invalid: 'Revisa los campos: el mensaje necesita al menos 10 caracteres.', limit: 'Has enviado demasiados mensajes hoy. Inténtalo mañana.', error: 'No se ha podido enviar. Inténtalo más tarde.' },
    en: { sending: 'Sending…', ok: "Got it. I'll get back to you soon.", invalid: 'Check the fields: the message needs at least 10 characters.', limit: "You've sent too many messages today. Try again tomorrow.", error: "It couldn't be sent. Please try again later." }
  };
  function show(key, cls) {
    formStatus.textContent = TEXT[lang()][key];
    formStatus.className = 'status' + (cls ? ' ' + cls : '');
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.checkValidity()) { show('invalid', 'ko'); return; }
    var button = form.querySelector('button[type=submit]');
    var field = function (name) { return form.elements[name].value; };
    var data = {
      name: field('name').trim(),
      contact: field('contact').trim(),
      message: field('message').trim(),
      website: field('website'),
      lang: lang()
    };
    button.disabled = true;
    show('sending');
    fetch('/api/chat?op=contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (res) {
        if (res.ok) { form.reset(); show('ok', 'ok'); return; }
        show(res.status === 429 ? 'limit' : res.status === 400 ? 'invalid' : 'error', 'ko');
      })
      .catch(function () { show('error', 'ko'); })
      .then(function () { button.disabled = false; });
  });

  applyLang();
})();
