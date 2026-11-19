// Traduceri Planora 3D. Limba de bază e româna: textul românesc e cheia, iar dicționarele dau traducerea.
// Pentru pagina de prezentare cheile sunt nume scurte (ex. „hero.title”), cu româna scrisă direct în HTML.
(function () {
  const LANGS = [['ro', 'RO', 'Română'], ['en', 'EN', 'English'], ['ru', 'RU', 'Русский'], ['fr', 'FR', 'Français'], ['de', 'DE', 'Deutsch']];
  const DICT = window.PLANORA_DICT || {};
  let lang = 'ro';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    const saved = localStorage.getItem('planora-lang');
    const nav = (navigator.language || 'ro').slice(0, 2);
    lang = [q, saved, nav].find((l) => l && LANGS.some(([c]) => c === l)) || 'ro';
    if (q) localStorage.setItem('planora-lang', q);
  } catch (e) { /* fără stocare */ }

  function t(s) {
    if (lang === 'ro' || s == null) return s;
    const d = DICT[lang];
    return (d && d[s]) || s;
  }
  function apply(root) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      if (el.dataset.ro == null) el.dataset.ro = el.innerHTML.trim();
      const key = el.getAttribute('data-i18n') || el.dataset.ro;
      const tr = lang === 'ro' ? null : (DICT[lang] || {})[key];
      el.innerHTML = tr || el.dataset.ro;
    });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      // format: "atribut:cheie;atribut2:cheie2"
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':');
        const roKey = 'ro' + attr;
        if (el.dataset[roKey] == null) el.dataset[roKey] = el.getAttribute(attr) || '';
        const tr = lang === 'ro' ? null : (DICT[lang] || {})[key || el.dataset[roKey]];
        el.setAttribute(attr, tr || el.dataset[roKey]);
      });
    });
    const tt = document.querySelector('meta[name=description]');
    if (tt && DICT[lang] && DICT[lang]['meta.description']) tt.setAttribute('content', DICT[lang]['meta.description']);
  }
  function mountSelector(sel) {
    if (!sel) return;
    sel.innerHTML = LANGS.map(([c, short, name]) => `<option value="${c}" ${c === lang ? 'selected' : ''} title="${name}">${short}</option>`).join('');
    sel.addEventListener('change', () => {
      try { localStorage.setItem('planora-lang', sel.value); } catch (e) { }
      const u = new URL(location.href); u.searchParams.delete('lang'); u.searchParams.delete('sablon');
      location.href = u.pathname + u.search + u.hash;
    });
  }
  window.I18N = { t, apply, mountSelector, LANG: lang, LANGS };
})();
