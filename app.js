/* Cap CPI V10 — pilote statique (aucun backend, stockage local). */
const ATTEMPTS_KEY = 'capcpi.v10.pilot.attempts';
const E_TEXT = 'Aucune réponse n’est valide.';
const NEW_AUTHORS = new Set([
  'Johannes Siegrist', 'Edward de Bono — six chapeaux', 'Locke et Latham — théorie des objectifs',
  'Mary Parker Follett', 'Chester Barnard', 'Herbert Simon — rationalité limitée',
  'Tom Burns et G. M. Stalker', 'Paul Lawrence et Jay Lorsch', 'Fred Fiedler — leadership contingent',
  'Robert House — path-goal', 'Geert Hofstede', 'Edgar Schein', 'Chris Argyris',
  'Mihaly Csikszentmihalyi', 'Albert Bandura',
]);

const state = {
  data: null,
  revision: null,
  lang: localStorage.getItem('capcpi.v10.pilot.lang') || 'fr',
  frData: null,
  arData: null,
  frRevision: null,
  arRevision: null,
  view: 'home',
  themeId: null,
  session: null,
  attempt: null,
  attempts: [],
  revisionTab: 'themes',
  search: '',
  reviewFilter: 'all',
  timerId: null,
  appliedHash: '#/',
  examConfig: { count: 30, duration: 40, canadian: true, revision: false },
};

const COUNTS = [5, 10, 20, 30, 40, 60, 80, 100];
const DURATIONS = [15, 30, 40, 45, 60, 90, 120];

const app = document.getElementById('app');
const settingsDialog = document.getElementById('settingsDialog');

function loadAttempts() {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]'); } catch { return []; }
}
function saveAttempts() {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state.attempts.slice(0, 30)));
}
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function mmss(total) {
  const value = Math.max(0, Math.round(total));
  const m = Math.floor(value / 60);
  const s = value % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtDate(iso) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function icon(name) {
  const paths = {
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pause: '<path d="M8 5h3v14H8zM14 5h3v14h-3z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    check: '<path d="m5 12 4 4 10-10"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    scale: '<path d="M12 3v18M5 7h14M7 7l-3 6h6zM17 7l-3 6h6z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    filecheck: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="m10 14 2 2 4-4"/>',
    listchecks: '<path d="M4 6h16M4 12h16M4 18h10"/><path d="m16 15 2 2 3-3"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  };
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
}

function setNav() {
  const map = { home: 'home', themes: 'themes', theme: 'themes', revision: 'revision', examConfig: 'exam', quiz: 'exam', results: 'exam', stats: 'stats' };
  const current = map[state.view] || '';
  document.querySelectorAll('.nav-item, .bottom-nav a').forEach((button) => {
    button.classList.toggle('active', button.dataset.nav === current && current !== '');
  });
}

function updateLegacyLinks() {
  const href = location.pathname.includes('/v10/') ? '../' : './legacy/';
  document.querySelectorAll('a.legacy').forEach((link) => { link.href = href; });
}

/* ---------- ROUTES ---------- */
function parseHash() {
  const body = (location.hash || '#/').replace(/^#/, '');
  const [pathPart, queryPart = ''] = body.split('?');
  return {
    parts: pathPart.split('/').filter(Boolean),
    params: new URLSearchParams(queryPart),
  };
}

function navigate(path) {
  const target = path.startsWith('#') ? path : `#/${String(path).replace(/^\/?/, '')}`;
  if (location.hash === target) { applyRoute(); return; }
  location.hash = target;
}

function stopClock() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function applyRoute() {
  const { parts, params } = parseHash();
  const first = parts[0] || '';

  if (!first) {
    state.view = 'home';
    state.themeId = null;
    state.attempt = null;
    stopClock();
  } else if (first === 'themes') {
    if (parts[1] && state.data?.themes.some((theme) => theme.id === parts[1])) {
      state.themeId = parts[1];
      state.view = 'theme';
    } else {
      state.themeId = null;
      state.view = 'themes';
    }
    state.attempt = null;
    stopClock();
  } else if (first === 'resume') {
    state.view = 'revision';
    state.attempt = null;
    stopClock();
  } else if (first === 'stats') {
    state.view = 'stats';
    state.attempt = null;
    stopClock();
  } else if (first === 'exam' && parts[1] === 'session') {
    startSessionFromParams(params);
    return;
  } else if (first === 'exam' && parts[1] === 'results') {
    const id = parts[2] || params.get('id');
    state.attempt = state.attempts.find((attempt) => attempt.id === id) || state.attempts[0] || null;
    state.view = state.attempt ? 'results' : 'examConfig';
    state.session = null;
    stopClock();
  } else if (first === 'exam') {
    state.view = 'examConfig';
    state.attempt = null;
    stopClock();
  } else {
    state.view = 'home';
    state.themeId = null;
    state.attempt = null;
    stopClock();
  }

  state.appliedHash = location.hash || '#/';
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function pageTitle() {
  const ar = state.lang === 'ar';
  const titles = {
    home: ar ? 'نجاحك يُحضَّر هنا' : 'Votre réussite se prépare ici',
    themes: ar ? 'المحاور الاثنا عشر' : 'Les 12 thèmes',
    theme: state.data?.themes.find((theme) => theme.id === state.themeId)?.shortTitle || (ar ? 'محور' : 'Thème'),
    revision: ar ? 'الأساسي الشامل' : 'L’essentiel global',
    examConfig: ar ? 'إعداد الاختبار' : 'Configurer l’examen',
    quiz: ar ? 'الاختبار' : 'Examen',
    results: ar ? 'النتائج' : 'Résultats',
    stats: ar ? 'الإحصائيات' : 'Statistiques',
  };
  return `${titles[state.view] || titles.home} · Cap CPI`;
}


function updateSideDashboard() {
  const el = document.getElementById('sideDashboard');
  if (!el) return;
  const ar = state.lang === 'ar';
  const attempts = state.attempts;
  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const average = attempts.length ? attempts.reduce((sum, attempt) => sum + attempt.score20, 0) / attempts.length : 0;
  const target = new Date('2026-12-27T00:00:00+01:00').getTime();
  const days = Math.max(0, Math.ceil((target - Date.now()) / 86400000));
  const countdown = ar ? (days > 0 ? `${days} يوماً` : 'اليوم') : (days > 0 ? `J-${days}` : 'Jour J');
  el.innerHTML = `
    <div class="eyebrow">${ar ? 'لوحة القيادة' : 'Tableau de bord'}</div>
    <div class="side-countdown">
      <strong>${countdown}</strong>
      <span>${ar ? 'قبل 27 ديسمبر 2026' : 'avant le 27 déc. 2026'}</span>
    </div>
    <div class="side-mini-stats">
      <div><strong>${attempts.length}</strong><span>${ar ? 'اختبارات' : 'tests'}</span></div>
      <div><strong>${totalQuestions}</strong><span>${ar ? 'أسئلة' : 'questions'}</span></div>
      <div><strong>${attempts.length ? average.toFixed(1) : '—'}</strong><span>/20</span></div>
    </div>
    <a class="side-dash-link" href="#/stats">${ar ? 'عرض التقدم' : 'Voir mes statistiques'} ${icon('arrow')}</a>
  `;
}

function render() {
  setNav();
  updateLegacyLinks();
  document.title = pageTitle();
  const views = {
    home: homeView,
    themes: themesView,
    theme: themeView,
    revision: revisionView,
    examConfig: examConfigView,
    quiz: quizView,
    results: resultsView,
    stats: statsView,
  };
  app.innerHTML = (views[state.view] || homeView)();
  updateSideDashboard();
  if (state.lang === 'ar') translateUI();
  if (state.view === 'revision') {
    const input = document.getElementById('revSearch');
    if (input && state.search) {
      input.focus();
      input.setSelectionRange(state.search.length, state.search.length);
    }
  }
}

/* ---------- ACCUEIL ---------- */
function homeView() {
  const themes = state.data?.themes || [];
  const attempts = state.attempts;
  const bankSize = state.data?.questions?.length || 0;
  const bankCounts = new Map(themes.map((theme) => [theme.id, 0]));
  for (const question of state.data?.questions || []) {
    if (bankCounts.has(question.themeId)) bankCounts.set(question.themeId, bankCounts.get(question.themeId) + 1);
  }
  const totalQuestions = attempts.reduce((sum, a) => sum + a.total, 0);
  const average = attempts.length ? attempts.reduce((sum, a) => sum + a.score20, 0) / attempts.length : 0;
  const last = attempts[0];
  const target = new Date('2026-12-27T00:00:00+01:00').getTime();
  const days = Math.max(0, Math.ceil((target - Date.now()) / 86400000));
  const countdown = state.lang === 'ar' ? (days > 0 ? `${days} يوماً` : 'اليوم') : (days > 0 ? `J-${days}` : 'Jour J');
  const themeLabel = state.lang === 'ar' ? 'المحاور' : 'Thèmes';
  const summaryLabel = state.lang === 'ar' ? 'الملخص' : 'Résumé';
  const examLabel = state.lang === 'ar' ? 'الاختبار' : 'Examen';
  const statsLabel = state.lang === 'ar' ? 'الإحصائيات' : 'Statistiques';
  const cardTitle = state.lang === 'ar' ? 'إلى أين تريد أن تذهب؟' : 'Que voulez-vous faire ?';
  const themesTitle = state.lang === 'ar' ? 'محاورك' : 'Vos thèmes';
  return `
    <div class="page-head home-head">
      <div>
        <div class="eyebrow">${state.lang === 'ar' ? 'التحضير للمباراة · 27 ديسمبر 2026' : 'Préparation au concours · 27 décembre 2026'}</div>
        <h1>${state.lang === 'ar' ? 'نجاحك يُحضَّر هنا.' : 'Votre réussite se prépare ici.'}</h1>
        <p>${state.lang === 'ar' ? 'فضاء واضح لمراجعة المحاور، اختبار reflexes، وتتبع تقدمك بهدوء.' : 'Un espace clair pour réviser les thèmes, tester vos réflexes et suivre votre progression, sans pression inutile.'}</p>
      </div>
      <span class="pilot-chip">${state.lang === 'ar' ? 'V10' : 'V10'}</span>
    </div>

    <section class="welcome-grid">
      <div class="card countdown-card">
        <div class="eyebrow">${state.lang === 'ar' ? 'يوم المباراة' : 'Jour J'}</div>
        <div class="countdown-value">${countdown}</div>
        <div class="countdown-date">${state.lang === 'ar' ? '27 ديسمبر 2026' : '27 décembre 2026'}</div>
        <p>${state.lang === 'ar' ? 'حظاً سعيداً! كل سؤال تنجزه يقربك من النجاح.' : 'Bonne chance ! Chaque question travaillée vous rapproche un peu plus de la réussite.'}</p>
        <div class="welcome-actions">
          <a class="btn btn-light" href="#/exam">${icon('play')} ${state.lang === 'ar' ? 'ابدأ اختباراً' : 'Configurer l’examen'}</a>
          <a class="btn btn-outline-light" href="#/resume">${icon('book')} ${state.lang === 'ar' ? 'الملخص' : 'Ouvrir le résumé'}</a>
        </div>
      </div>
      <div class="card warm-card">
        <div class="eyebrow">${state.lang === 'ar' ? 'لوحة القيادة' : 'Tableau de bord'}</div>
        <div class="warm-stats">
          <div><strong>${attempts.length}</strong><span>${state.lang === 'ar' ? 'اختبارات' : 'tests'}</span></div>
          <div><strong>${totalQuestions}</strong><span>${state.lang === 'ar' ? 'أسئلة' : 'questions'}</span></div>
          <div><strong>${attempts.length ? average.toFixed(1) + '<em>/20</em>' : '—'}</strong><span>${state.lang === 'ar' ? 'المعدل' : 'moyenne'}</span></div>
        </div>
        <p class="warm-last">${last
          ? (state.lang === 'ar' ? `آخر محاولة: ${last.score20.toFixed(1)}/20 · ${esc(last.title)}` : `Dernière tentative : ${last.score20.toFixed(1)}/20 · ${esc(last.title)}`)
          : (state.lang === 'ar' ? 'لا محاولة بعد. ابدأ عندما تكون مستعداً.' : 'Aucune tentative pour le moment. Commencez quand vous voulez.')}</p>
        <a class="btn btn-ghost btn-sm" href="#/stats">${state.lang === 'ar' ? 'عرض التقدم' : 'Voir ma progression'} ${icon('arrow')}</a>
      </div>
    </section>

    <div class="section-title">${cardTitle}</div>
    <div class="home-cards">
      <a class="home-card home-card-blue" href="#/themes">
        <span class="home-card-icon">${icon('layers')}</span>
        <span class="home-card-title">${themeLabel}</span>
        <span class="home-card-meta">${themes.length} ${state.lang === 'ar' ? `محوراً · ${bankSize} سؤالاً` : `thèmes · ${bankSize} questions`}</span>
        <span class="home-card-link">${state.lang === 'ar' ? 'افتح' : 'Ouvrir'} ${icon('arrow')}</span>
      </a>
      <a class="home-card home-card-gold" href="#/resume">
        <span class="home-card-icon">${icon('book')}</span>
        <span class="home-card-title">${summaryLabel}</span>
        <span class="home-card-meta">${state.lang === 'ar' ? '21 نصاً · 78 نظرية · 42 تعريفاً' : '21 textes · 78 théories · 42 définitions'}</span>
        <span class="home-card-link">${state.lang === 'ar' ? 'راجع الأساسي' : 'L’essentiel global'} ${icon('arrow')}</span>
      </a>
      <a class="home-card home-card-terra" href="#/exam">
        <span class="home-card-icon">${icon('play')}</span>
        <span class="home-card-title">${examLabel}</span>
        <span class="home-card-meta">${state.lang === 'ar' ? '30 سؤالاً · 40 دقيقة · 5 خيارات' : '30 questions · 40 minutes · 5 choix A–E'}</span>
        <span class="home-card-link">${state.lang === 'ar' ? 'اختر الإعداد' : 'Choisir les options'} ${icon('arrow')}</span>
      </a>
      <a class="home-card home-card-violet" href="#/stats">
        <span class="home-card-icon">${icon('chart')}</span>
        <span class="home-card-title">${statsLabel}</span>
        <span class="home-card-meta">${attempts.length ? `${attempts.length} ${state.lang === 'ar' ? 'اختبارات' : 'tests'} · ${average.toFixed(1)}/20` : (state.lang === 'ar' ? 'تقدمك هنا' : 'Votre progression ici')}</span>
        <span class="home-card-link">${state.lang === 'ar' ? 'عرض' : 'Voir mes stats'} ${icon('arrow')}</span>
      </a>
    </div>

    <div class="section-title">${themesTitle}</div>
    <div class="home-themes">
      ${themes.map((theme) => `
        <a class="card theme-card" href="#/themes/${esc(theme.id)}">
          <span class="theme-number">${state.lang === 'ar' ? 'المحور' : 'Thème'} ${esc(theme.number)} / 12</span>
          <h3>${esc(theme.shortTitle)}</h3>
          <p>${esc(theme.title)}</p>
          <div class="foot"><span>${bankCounts.get(theme.id)} ${state.lang === 'ar' ? 'سؤالاً' : 'questions'}</span><span>${state.lang === 'ar' ? 'افتح' : 'Ouvrir'} ${icon('arrow')}</span></div>
        </a>
      `).join('')}
    </div>
    <p class="footer-note">${state.lang === 'ar' ? 'نسخة محلية · لا بيانات اسمية · النسخة القديمة متاحة عبر أيقونة الأرشيف.' : 'Données locales · aucune donnée nominative · l’ancienne version reste accessible par l’icône archive.'}</p>
  `;
}

/* ---------- THÈMES ---------- */
function themesView() {
  const themes = state.data?.themes || [];
  const bankCounts = new Map(themes.map((theme) => [theme.id, 0]));
  for (const question of state.data?.questions || []) {
    if (bankCounts.has(question.themeId)) bankCounts.set(question.themeId, bankCounts.get(question.themeId) + 1);
  }
  return `
    <div class="page-head"><div><div class="eyebrow">Parcours</div><h1>Les 12 thèmes</h1><p>Chaque thème propose au moins 30 questions : définitions, lois, théories et mises en situation, avec corrections.</p></div></div>
    <div class="home-themes">
      ${themes.map((theme) => `
        <a class="card theme-card" href="#/themes/${esc(theme.id)}">
          <span class="theme-number">Thème ${esc(theme.number)} / 12</span>
          <h3>${esc(theme.shortTitle)}</h3>
          <p>${esc(theme.definition)}</p>
          <div class="foot"><span>${bankCounts.get(theme.id)} questions</span><span>Ouvrir ${icon('arrow')}</span></div>
        </a>
      `).join('')}
    </div>
  `;
}

function themeView() {
  const theme = state.data?.themes.find((item) => item.id === state.themeId);
  if (!theme) return homeView();
  return `
    <div class="page-head"><div><div class="eyebrow">Thème ${esc(theme.number)} / 12</div><h1>${esc(theme.shortTitle)}</h1><p>${esc(theme.title)}</p></div></div>
    <div class="card rev-card">
      <p><strong>Définition.</strong> ${esc(theme.definition)}</p>
      <div class="rev-columns">
        <div><strong>Objectifs</strong><ul class="rev-list">${theme.objectives.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><strong>Avantages</strong><ul class="rev-list">${theme.advantages.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><strong>Limites</strong><ul class="rev-list">${theme.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><strong>Conditions</strong><ul class="rev-list">${theme.conditions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card cta-card"><div><h3>Examen du thème</h3><p>30 questions · 30 minutes · pause · correction à la fin.</p></div><a class="btn btn-primary" href="#/exam/session?theme=${esc(theme.id)}&count=30&duration=30&canadian=1&mode=exam">${icon('play')} Tester</a></div>
      <div class="card cta-card"><div><h3>Révision du thème</h3><p>30+ questions · 40 minutes · correction immédiate · parcours complet.</p></div><a class="btn btn-ghost" href="#/exam/session?theme=${esc(theme.id)}&count=100&duration=40&canadian=1&mode=revision">${icon('book')} Réviser</a></div>
    </div>
    <p class="footer-note">Chaque thème propose au moins 30 questions. L’examen en tire 30 ; la révision parcourt l’ensemble du thème.</p>
  `;
}

/* ---------- RÉVISION & RÉSUMÉS ---------- */
function revisionView() {
  const ar = state.lang === 'ar';
  const file = ar ? './Revision_Minimale_Lois_Theories_AR_v2_3.docx' : './Revision_Minimale_Lois_Theories_FR_v2_3_tableaux.docx';
  return `
    <div class="page-head resume-head">
      <div>
        <div class="eyebrow">${ar ? 'الملخص' : 'Résumé'}</div>
        <h1>${ar ? 'الأساسي الشامل' : 'L’essentiel global'}</h1>
        <p>${ar ? 'مكان واحد للمراجعة: القوانين والنصوص والنظريات والمؤلفون والتعريفات ومعالم OFPPT من ملف v2.3 الموسع.' : 'Un seul endroit pour réviser : les lois, textes, théories, auteurs, définitions et repères OFPPT, issus du fichier v2.3 enrichi.'}</p>
      </div>
      <a class="btn btn-primary btn-lg" href="${file}" download>${icon('download')} ${ar ? 'تحميل الملخص' : 'Télécharger le résumé'}</a>
    </div>
    ${revisionGlobal()}
  `;
}

function revisionGlobal() {
  const q = state.search.trim().toLowerCase();
  const match = (value) => !q || String(value).toLowerCase().includes(q);
  const laws = state.revision.laws.filter((x) => match(x.ref) || match(x.summary) || match(x.nature));
  const theories = state.revision.theories.filter((x) => match(x.author) || match(x.idea));
  const definitions = state.revision.definitions.filter((x) => match(x.concept) || match(x.definition));
  return `
    <input id="revSearch" class="search" placeholder="Rechercher un texte, un auteur, une notion…" value="${esc(state.search)}" data-role="search" />
    <div class="card rev-card">
      <h3>Repères OFPPT 2026</h3>
      ${state.revision.facts.map((fact) => `<div class="fact">${esc(fact)}</div>`).join('')}
    </div>
    <details class="card rev-card" ${q ? 'open' : ''}><summary><strong>Lois, textes et référentiels (${laws.length})</strong></summary>
      <table class="rev-table"><thead><tr><th>Texte</th><th>Nature</th><th>À retenir</th></tr></thead><tbody>
        ${laws.map((law) => `<tr><td><strong>${esc(law.ref)}</strong></td><td>${esc(law.nature)}</td><td>${esc(law.summary)}</td></tr>`).join('')}
      </tbody></table>
    </details>
    <details class="card rev-card" ${q ? 'open' : ''}><summary><strong>Théories, auteurs et modèles (${theories.length})</strong></summary>
      <table class="rev-table"><thead><tr><th>Auteur / modèle</th><th>Idée clé</th></tr></thead><tbody>
        ${theories.map((theory) => `<tr><td><strong>${esc(theory.author)}</strong> ${NEW_AUTHORS.has(theory.author) ? '<span class="pill">Nouveau</span>' : ''}</td><td>${esc(theory.idea)}</td></tr>`).join('')}
      </tbody></table>
    </details>
    <details class="card rev-card" ${q ? 'open' : ''}><summary><strong>Définitions des concepts (${definitions.length})</strong></summary>
      <table class="rev-table"><thead><tr><th>Concept</th><th>Définition</th></tr></thead><tbody>
        ${definitions.map((definition) => `<tr><td><strong>${esc(definition.concept)}</strong></td><td>${esc(definition.definition)}</td></tr>`).join('')}
      </tbody></table>
    </details>
  `;
}

/* ---------- SESSION ---------- */
function prepare(questions, mode, title, minutes, canadian = true) {
  const prepared = shuffle(questions).map((q) => {
    const order = shuffle([0, 1, 2, 3]);
    const displayOptions = order.map((i) => q.options[i]).concat([q.options[4]]);
    const answer = q.answer === 4 ? 4 : order.indexOf(q.answer);
    return { ...q, displayOptions, displayAnswer: answer };
  });
  return {
    questions: prepared, index: 0, selections: {}, revealed: {}, mode, title,
    minutes: minutes || 0, remaining: minutes ? minutes * 60 : 0, elapsed: 0,
    paused: false, finished: false, start: Date.now(), pausedMs: 0, pausedAt: 0,
    canadian: Boolean(canadian), count: prepared.length,
  };
}

function pickCoverage(pool, count) {
  const groups = new Map();
  for (const question of pool) {
    if (!groups.has(question.themeId)) groups.set(question.themeId, []);
    groups.get(question.themeId).push(question);
  }
  const ordered = shuffle([...groups.values()].map((group) => shuffle(group)));
  const picked = [];
  for (const group of ordered) {
    if (picked.length >= count) break;
    if (group.length) picked.push(group.pop());
  }
  const rest = shuffle(ordered.flat());
  while (picked.length < count && rest.length) picked.push(rest.pop());
  return picked;
}

function mixExamQuestions(count) {
  const pool = state.data.questions;
  const situationsCount = Math.min(count, Math.round(count * 0.65));
  const directCount = count - situationsCount;
  const situations = pickCoverage(pool.filter((q) => q.type === 'situation'), situationsCount);
  const directs = pickCoverage(pool.filter((q) => q.type === 'direct'), directCount);
  const merged = [...situations, ...directs];
  if (merged.length < count) {
    const used = new Set(merged.map((q) => q.id));
    const rest = shuffle(pool.filter((q) => !used.has(q.id)));
    while (merged.length < count && rest.length) merged.push(rest.pop());
  }
  return merged;
}

function sessionUrl(settings) {
  const params = new URLSearchParams();
  if (settings.theme) params.set('theme', settings.theme);
  params.set('count', String(settings.count || 30));
  params.set('duration', String(settings.duration ?? 40));
  params.set('canadian', settings.canadian ? '1' : '0');
  params.set('mode', settings.revision ? 'revision' : 'exam');
  return `#/exam/session?${params.toString()}`;
}

function startSessionFromParams(params) {
  stopClock();
  const mode = params.get('mode') === 'revision' ? 'revision' : 'exam';
  const canadian = params.get('canadian') !== '0';
  const themeId = params.get('theme');
  const requestedCount = Number.parseInt(params.get('count') || '', 10);
  const requestedDuration = Number.parseInt(params.get('duration') || '', 10);
  const minutes = Number.isFinite(requestedDuration) ? Math.max(0, Math.min(180, requestedDuration)) : 40;

  if (themeId) {
    const theme = state.data.themes.find((item) => item.id === themeId);
    if (!theme) { navigate('#/themes'); return; }
    const count = Math.max(1, Math.min(100, Number.isFinite(requestedCount) ? requestedCount : 30));
    const pool = state.data.questions.filter((q) => q.themeId === themeId);
    const selected = shuffle(pool).slice(0, count);
    state.themeId = themeId;
    state.session = prepare(
      selected, mode,
      `${theme.shortTitle} · ${selected.length} ${state.lang === 'ar' ? 'سؤالاً' : 'questions'}`,
      minutes, canadian,
    );
  } else {
    const count = Math.max(5, Math.min(100, Number.isFinite(requestedCount) ? requestedCount : 30));
    state.themeId = null;
    const title = mode === 'revision'
      ? (state.lang === 'ar' ? 'مراجعة' : 'Révision')
      : (state.lang === 'ar' ? 'اختبار تجريبي' : 'Examen blanc');
    state.session = prepare(mixExamQuestions(count), mode, `${title} · ${count} ${state.lang === 'ar' ? 'سؤالاً' : 'questions'}`, minutes, canadian);
  }

  state.reviewFilter = 'all';
  state.view = 'quiz';
  state.appliedHash = location.hash || '#/';
  startClock();
  render();
}

function startExam(mode) {
  navigate(sessionUrl({ ...state.examConfig, revision: mode === 'revision' }));
}

function startTheme(themeId, mode) {
  navigate(sessionUrl({ theme: themeId, count: 15, duration: 20, canadian: true, revision: mode === 'revision' }));
}

/* ---------- CONFIGURATION DE L'EXAMEN ---------- */
function sectionHeading(number, title) {
  return `<div class="section-heading"><div><div class="eyebrow">${number}</div><h2>${title}</h2></div></div>`;
}

function fmtExamDate(iso) {
  try {
    return new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch { return ''; }
}

function examConfigView() {
  const ar = state.lang === 'ar';
  const cfg = state.examConfig;
  const totalQuestions = state.data?.questions?.length || 0;
  const modeLabel = cfg.revision ? (ar ? 'نمط المراجعة' : 'Mode révision') : (ar ? 'نمط الاختبار' : 'Mode examen');
  const note = cfg.revision
    ? (ar ? 'المؤقت وعدد الأسئلة وطريقة التنقيط تبقى كما هي؛ التصحيح فقط يصبح فورياً.' : 'Le chronomètre, le nombre de questions et le barème restent identiques ; seule la correction devient immédiate.')
    : (ar ? 'كما في الاختبار: دون أي تصحيح قبل النهاية.' : 'Comme à l’examen : aucune correction avant la fin.');
  const history = state.attempts.slice(0, 4);
  return `
    <div class="page exam-config-page">
      <header class="page-head">
        <div>
          <div class="eyebrow">${ar ? 'اختبار' : 'Examen'}</div>
          <h1>${ar ? 'اختبار تجريبي' : 'Examen blanc'}</h1>
          <p>${ar ? 'نمطان: اختبار (دون تصحيح قبل النهاية) أو مراجعة (تصحيح فوري)، مع مؤقت حسب الاختيار.' : 'Deux modes : examen (sans correction avant la fin) ou révision (correction immédiate), avec chronomètre au choix.'}</p>
        </div>
        <div class="head-chips">
          <span class="chip">${icon('listchecks')} ${cfg.count} ${ar ? 'سؤالاً' : 'questions'}</span>
          <span class="chip chip-emerald">${icon('timer')} ${cfg.duration} ${ar ? 'دقيقة' : 'min'}</span>
        </div>
      </header>

      <div class="training-layout">
        <section class="card config-card">
          ${sectionHeading('01', ar ? 'نمط الاختبار' : 'Mode de l’épreuve')}
          <div class="exam-mode-grid">
            <button type="button" class="exam-mode-card ${!cfg.revision ? 'selected' : ''}" data-action="cfg-mode" data-value="exam">
              <span class="exam-mode-icon">${icon('filecheck')}</span>
              <span>
                <strong>${ar ? 'نمط الاختبار' : 'Mode examen'}</strong>
                <small>${ar ? 'لا تصحيح قبل تسليم الورقة، كما في الاختبار.' : 'Aucune correction avant la remise de la copie, comme à l’examen.'}</small>
              </span>
            </button>
            <button type="button" class="exam-mode-card ${cfg.revision ? 'selected' : ''}" data-action="cfg-mode" data-value="revision">
              <span class="exam-mode-icon">${icon('eye')}</span>
              <span>
                <strong>${ar ? 'نمط المراجعة' : 'Mode révision'}</strong>
                <small>${ar ? 'تصحيح فوري بعد كل سؤال، مع الشرح والمصدر.' : 'Correction immédiate après chaque question, avec explication et source.'}</small>
              </span>
            </button>
          </div>

          ${sectionHeading('02', ar ? 'عدد الأسئلة' : 'Nombre de questions')}
          <p class="config-hint">${ar ? `تُسحب الأسئلة عشوائياً من ${totalQuestions} سؤالاً. يغطي البنك 21 نصاً و78 نظرية و42 تعريفاً، مع المحاور الاثني عشر.` : `Les questions sont tirées au hasard parmi ${totalQuestions} questions. La banque couvre les 21 lois, 78 théories et 42 définitions, avec les 12 thèmes.`}</p>
          <div class="count-picker">
            ${COUNTS.map((value) => `<button type="button" class="count-option ${cfg.count === value ? 'selected' : ''}" data-action="cfg-count" data-value="${value}">${value}</button>`).join('')}
          </div>

          ${sectionHeading('03', ar ? 'مدة المؤقت' : 'Durée du chronomètre')}
          <p class="config-hint">${ar ? 'يبدأ المؤقت عند انطلاق الاختبار.' : 'Le chronomètre démarre au lancement de l’examen.'}</p>
          <div class="count-picker">
            ${DURATIONS.map((value) => `<button type="button" class="count-option ${cfg.duration === value ? 'selected' : ''}" data-action="cfg-duration" data-value="${value}">${value} ${ar ? 'دقيقة' : 'min'}</button>`).join('')}
          </div>

          <div class="config-summary card">
            <div>
              <strong>${modeLabel} · ${cfg.count} ${ar ? 'سؤالاً' : 'questions'} · ${cfg.duration} ${ar ? 'دقيقة' : 'minutes'}</strong>
              <small>${note}</small>
            </div>
            <button type="button" class="btn btn-primary" data-action="start-config">${icon('play')} ${ar ? 'ابدأ الاختبار' : 'Commencer l’examen'} ${icon('arrow')}</button>
          </div>
        </section>

        <aside class="training-side">
          <div class="card side-panel exam-note-card">
            <div class="exam-note-icon">${icon('shield')}</div>
            <h3>${ar ? 'اختبار تجريبي' : 'Examen blanc'}</h3>
            <p>${note}</p>
            <div class="exam-note-meta">
              <span>${icon('listchecks')} ${cfg.count} ${ar ? 'سؤالاً' : 'questions'}</span>
              <span>${icon('clock')} ${cfg.duration} ${ar ? 'دقيقة' : 'min'}</span>
              <span>${icon('eye')} ${modeLabel}</span>
            </div>
          </div>

          <div class="card side-panel">
            <div class="eyebrow">${ar ? 'آخر الاختبارات التجريبية' : 'Derniers examens blancs'}</div>
            ${history.length ? `
              <div class="exam-history">
                ${history.map((attempt) => `
                  <a class="exam-history-row" href="#/exam/results/${esc(attempt.id)}">
                    <span class="exam-history-score">${attempt.score20.toFixed(1)}<small>/20</small></span>
                    <span class="exam-history-meta">${fmtExamDate(attempt.date)} · ${attempt.total} ${ar ? 'سؤالاً' : 'questions'}${attempt.mode === 'revision' ? ` · ${ar ? 'مراجعة' : 'Révision'}` : ''}</span>
                    ${icon('chevron')}
                  </a>
                `).join('')}
              </div>` : `<p class="panel-empty">${ar ? 'لم يُنجز أي اختبار تجريبي بعد.' : 'Aucun examen blanc terminé.'}</p>`}
          </div>
        </aside>
      </div>

      <div class="exam-steps">
        <div class="exam-step card">
          <span class="exam-step-icon">${icon('filecheck')}</span>
          <div><strong>${ar ? 'عدد الأسئلة' : 'Nombre de questions'}</strong><p>${ar ? `تغطية كاملة: 21 نصاً، 78 نظرية، 42 تعريفاً. سحب عشوائي من ${totalQuestions} سؤالاً.` : `Couverture complète : 21 lois, 78 théories, 42 définitions. Tirage aléatoire parmi ${totalQuestions} questions.`}</p></div>
        </div>
        <div class="exam-step card">
          <span class="exam-step-icon">${icon('timer')}</span>
          <div><strong>${ar ? 'مدة المؤقت' : 'Durée du chronomètre'}</strong><p>${ar ? 'يبدأ المؤقت عند انطلاق الاختبار.' : 'Le chronomètre démarre au lancement de l’examen.'}</p></div>
        </div>
        <div class="exam-step card">
          <span class="exam-step-icon">${icon('shield')}</span>
          <div><strong>${ar ? 'التصحيح والتفسيرات' : 'Correction et explications'}</strong><p>${note}</p></div>
        </div>
      </div>
    </div>
  `;
}

function startClock() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    const s = state.session;
    if (!s || s.finished || s.paused) return;
    if (s.minutes) {
      s.remaining = Math.max(0, s.remaining - 1);
      if (s.remaining === 0) finish(true);
    } else {
      s.elapsed += 1;
    }
    updateClock();
  }, 1000);
}
function clockText(s) {
  return s.minutes ? mmss(s.remaining) : mmss(s.elapsed);
}
function updateClock() {
  const s = state.session;
  if (!s || state.view !== 'quiz') return;
  const el = document.getElementById('clock');
  if (el) {
    el.textContent = clockText(s);
    if (s.minutes && s.remaining <= 60) el.classList.add('urgent');
  }
}

function quizView() {
  const s = state.session;
  if (!s) return homeView();
  const q = s.questions[s.index];
  const selected = s.selections[q.id];
  const revealed = s.mode === 'revision' && s.revealed[q.id];
  const isLast = s.index === s.questions.length - 1;
  const progress = ((s.index + 1) / s.questions.length) * 100;
  return `
    <div class="quiz-shell">
      <div class="quiz-head">
        <button class="icon-btn" data-action="quit" title="Quitter">${icon('back')}</button>
        <div class="quiz-title">${esc(s.title)}</div>
        <div class="timer ${s.minutes && s.remaining <= 60 ? 'urgent' : ''}" id="clock">${clockText(s)}</div>
        <button class="icon-btn" data-action="pause" title="Pause">${icon('pause')}</button>
      </div>
      <div class="quiz-progress"><span style="width:${progress}%"></span></div>
      <div class="card question-card">
        <div class="question-meta">
          <span>Question ${s.index + 1} / ${s.questions.length}</span>
          <span>${s.mode === 'revision' ? 'Mode révision' : 'Mode examen'} · ${s.minutes ? `${s.minutes} min` : 'temps libre'} · ${s.canadian ? 'Canadien' : 'Standard'}</span>
        </div>
        <h2 class="question-stem">${esc(q.stem)}</h2>
        <div class="options">
          ${q.displayOptions.map((option, i) => {
            const isSelected = selected === i;
            const isCorrect = i === q.displayAnswer;
            const cls = revealed && isCorrect ? 'correct' : revealed && isSelected && !isCorrect ? 'wrong' : isSelected ? 'selected' : '';
            return `<button class="option ${cls} ${revealed && !isCorrect && !isSelected ? 'dimmed' : ''}" data-action="option" data-index="${i}" ${revealed ? 'disabled' : ''}>
              <span class="option-letter">${String.fromCharCode(65 + i)}</span>
              <span class="option-text">${esc(option)}</span>
              ${revealed && isCorrect ? `<span class="option-state">Bonne réponse</span>` : ''}
            </button>`;
          }).join('')}
        </div>
        ${revealed ? `
          <div class="feedback ${selected === q.displayAnswer ? 'feedback-ok' : 'feedback-ko'}">
            <strong>${selected === q.displayAnswer ? 'Correct' : 'Incorrect'} · ${String.fromCharCode(65 + q.displayAnswer)}. ${esc(q.displayOptions[q.displayAnswer])}</strong>
            <p>${esc(q.explanation)}</p>
            <p class="review-source">Source · ${esc(q.source)}</p>
          </div>` : ''}
        <div class="quiz-foot">
          <button class="btn btn-ghost" data-action="prev" ${s.index === 0 ? 'disabled' : ''}>${icon('back')} Précédent</button>
          <div class="right">
            ${s.mode === 'revision' && !revealed ? `<button class="btn btn-quiet" data-action="skip">Passer</button>` : ''}
            ${!isLast || (s.mode === 'revision' && !revealed) ? `<button class="btn btn-quiet" data-action="submit">Rendre la copie</button>` : ''}
            ${s.mode === 'revision' && !revealed
              ? `<button class="btn btn-primary" data-action="reveal" ${selected === undefined ? 'disabled' : ''}>Valider et voir la correction ${icon('arrow')}</button>`
              : isLast
                ? `<button class="btn btn-primary" data-action="submit">Rendre la copie ${icon('check')}</button>`
                : `<button class="btn btn-primary" data-action="next">Question suivante ${icon('arrow')}</button>`}
          </div>
        </div>
      </div>
      <div class="navigator">
        ${s.questions.map((item, i) => `<button class="nav-dot ${s.selections[item.id] !== undefined ? 'answered' : ''} ${i === s.index ? 'current' : ''}" data-action="goto" data-index="${i}" title="Question ${i + 1}">${i + 1}</button>`).join('')}
      </div>
    </div>
    ${s.paused ? `<div class="pause-layer"><div class="card pause-card"><div class="eyebrow">Pause</div><h2>Session suspendue</h2><p>Le chronomètre est arrêté. Tu peux reprendre quand tu veux.</p><button class="btn btn-primary" data-action="resume">${icon('play')} Reprendre</button></div></div>` : ''}
  `;
}

function finish(auto) {
  const s = state.session;
  if (!s || s.finished) return;
  s.finished = true;
  if (state.timerId) clearInterval(state.timerId);
  const items = s.questions.map((q, i) => {
    const selected = s.selections[q.id];
    const correct = selected !== undefined && selected === q.displayAnswer;
    return {
      number: i + 1, id: q.id, themeId: q.themeId, stem: q.stem,
      options: q.displayOptions, answer: q.displayAnswer, selected: selected ?? null,
      correct: Boolean(correct), explanation: q.explanation, source: q.source,
    };
  });
  const correct = items.filter((x) => x.correct).length;
  const blank = items.filter((x) => x.selected === null).length;
  const wrong = items.length - correct - blank;
  const raw = correct - wrong;
  const maxRawScore = items.length;
  const score20 = s.canadian
    ? Math.max(0, Math.round((raw / Math.max(1, maxRawScore)) * 20 * 10) / 10)
    : Math.round((correct / Math.max(1, items.length)) * 20 * 10) / 10;
  const elapsed = Math.round((Date.now() - s.start - s.pausedMs) / 1000);
  const duration = s.minutes ? Math.min(s.minutes * 60, elapsed) : elapsed;
  const themeIds = new Set(items.map((item) => item.themeId));
  const attempt = {
    id: `v10-${Date.now()}`,
    date: new Date().toISOString(),
    mode: s.mode, title: s.title, total: items.length,
    correct, wrong, blank, raw, maxRawScore, score20, duration, auto: Boolean(auto),
    canadian: Boolean(s.canadian), revision: s.mode === 'revision',
    settings: {
      theme: themeIds.size === 1 ? items[0].themeId : null,
      count: items.length,
      duration: s.minutes,
      canadian: Boolean(s.canadian),
      revision: s.mode === 'revision',
    },
    items,
  };
  state.attempts.unshift(attempt);
  saveAttempts();
  state.attempt = attempt;
  state.session = null;
  state.view = 'results';
  history.replaceState(null, '', `#/exam/results/${attempt.id}`);
  state.appliedHash = location.hash;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ---------- RÉSULTATS ---------- */
function resultsView() {
  const a = state.attempt;
  if (!a) return homeView();
  const percent = Math.round((a.correct / a.total) * 100);
  const items = (a.items || []).map((item, i) => ({
    number: i + 1,
    stem: item.stem || `Question ${i + 1}`,
    options: item.options || [],
    answer: item.answer ?? 0,
    selected: item.selected ?? null,
    correct: Boolean(item.correct),
    explanation: item.explanation || '',
    source: item.source || '',
    themeId: item.themeId,
  }));
  const filtered = state.reviewFilter === 'errors' ? items.filter((x) => !x.correct) : items;
  return `
    <div class="quiz-shell">
      <div class="card result-hero">
        <div>
          <div class="eyebrow">${a.mode === 'revision' ? 'Révision terminée' : 'Examen terminé'} · ${esc(a.title)}</div>
          <h1>${a.score20.toFixed(1)} / 20</h1>
          <p>${a.correct} bonnes · ${a.wrong} mauvaises · ${a.blank} sans réponse · ${mmss(a.duration)}</p>
          <p>${a.canadian ? `Barème canadien · score brut ${a.raw} / ${a.maxRawScore || a.total}` : `Barème standard · ${a.correct} / ${a.total}`} ${a.auto ? '· temps écoulé' : ''}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" data-action="retake">${icon('play')} Refaire</button>
          <button class="btn btn-ghost" data-action="home">${icon('back')} Accueil</button>
        </div>
      </div>
      <div class="stat-grid">
        <div class="card stat"><strong>${a.correct}</strong><span>Bonnes réponses</span></div>
        <div class="card stat"><strong>${a.wrong}</strong><span>Mauvaises</span></div>
        <div class="card stat"><strong>${a.blank}</strong><span>Sans réponse</span></div>
        <div class="card stat"><strong>${percent}%</strong><span>Réussite</span></div>
      </div>
      <div class="page-head" style="margin-top:18px"><div><div class="eyebrow">Correction</div><h2 style="margin:2px 0">Toutes les questions</h2></div></div>
      <div class="tabs">
        <button class="tab ${state.reviewFilter === 'all' ? 'active' : ''}" data-action="filter" data-filter="all">Toutes</button>
        <button class="tab ${state.reviewFilter === 'errors' ? 'active' : ''}" data-action="filter" data-filter="errors">Erreurs · ${a.total - a.correct}</button>
      </div>
      <div class="review-list">
        ${filtered.map((item) => `
          <details class="review-item">
            <summary>
              <span>${item.correct ? icon('check') : icon('x')}</span>
              <span><strong>Question ${item.number} · ${item.correct ? 'Correct' : item.selected === null ? 'Sans réponse' : 'Erreur'}</strong><br><span style="color:var(--muted);font-size:12px">${esc(item.stem)}</span></span>
            </summary>
            <div class="review-body">
              <div class="review-line"><span>Votre réponse</span><strong>${item.selected === null ? 'Aucune' : `${String.fromCharCode(65 + item.selected)}. ${esc(item.options[item.selected])}`}</strong></div>
              <div class="review-line"><span>Bonne réponse</span><strong>${String.fromCharCode(65 + item.answer)}. ${esc(item.options[item.answer])}</strong></div>
              <p class="review-expl">${esc(item.explanation)}</p>
              <p class="review-source">Source · ${esc(item.source)}</p>
            </div>
          </details>
        `).join('')}
      </div>
      <div class="quiz-foot"><button class="btn btn-ghost" data-action="home">${icon('back')} Accueil</button><button class="btn btn-primary" data-action="retake">${icon('play')} Refaire</button></div>
    </div>
  `;
}

/* ---------- STATISTIQUES ---------- */
function statsView() {
  const attempts = state.attempts;
  const themes = state.data?.themes || [];
  if (!attempts.length) {
    return `
      <div class="page-head"><div><div class="eyebrow">Statistiques</div><h1>Votre progression</h1><p>Les statistiques apparaîtront après le premier examen ou la première révision.</p></div></div>
      <div class="card empty"><p>Aucune tentative pour le moment.</p><a class="btn btn-primary" href="#/exam">${icon('play')} Configurer l’examen</a></div>
    `;
  }
  const totalQuestions = attempts.reduce((sum, a) => sum + a.total, 0);
  const correct = attempts.reduce((sum, a) => sum + a.correct, 0);
  const wrong = attempts.reduce((sum, a) => sum + a.wrong, 0);
  const blank = attempts.reduce((sum, a) => sum + a.blank, 0);
  const average = attempts.reduce((sum, a) => sum + a.score20, 0) / attempts.length;
  const best = Math.max(...attempts.map((a) => a.score20));
  const totalDuration = attempts.reduce((sum, a) => sum + a.duration, 0);
  const successRate = Math.round((correct / Math.max(1, totalQuestions)) * 100);
  const byTheme = new Map(themes.map((theme) => [theme.id, { theme, total: 0, correct: 0, blank: 0 }]));
  for (const attempt of attempts) {
    for (const item of attempt.items || []) {
      const entry = byTheme.get(item.themeId);
      if (!entry) continue;
      entry.total += 1;
      entry.correct += item.correct ? 1 : 0;
      entry.blank += item.selected === null ? 1 : 0;
    }
  }
  const modeStats = ['exam', 'revision'].map((mode) => {
    const list = attempts.filter((a) => a.mode === mode);
    return {
      mode,
      count: list.length,
      average: list.length ? list.reduce((sum, a) => sum + a.score20, 0) / list.length : 0,
    };
  });
  return `
    <div class="page-head"><div><div class="eyebrow">Statistiques</div><h1>Votre progression</h1><p>Questions travaillées, réussite, temps, thèmes et modes. Les données restent sur cet appareil.</p></div></div>
    <div class="stat-grid">
      <div class="card stat"><strong>${attempts.length}</strong><span>${attempts.length === 1 ? 'test passé' : 'tests passés'}</span></div>
      <div class="card stat"><strong>${totalQuestions}</strong><span>questions traitées</span></div>
      <div class="card stat"><strong>${average.toFixed(1)}<em>/20</em></strong><span>note moyenne</span></div>
      <div class="card stat"><strong>${best.toFixed(1)}<em>/20</em></strong><span>meilleur score</span></div>
    </div>
    <div class="stat-grid" style="margin-top:10px">
      <div class="card stat"><strong>${successRate}%</strong><span>taux de réussite</span></div>
      <div class="card stat"><strong>${mmss(totalQuestions ? totalDuration / totalQuestions : 0)}</strong><span>temps moyen / question</span></div>
      <div class="card stat"><strong>${correct}</strong><span>bonnes réponses</span></div>
      <div class="card stat"><strong>${wrong} <em>· ${blank}</em></strong><span>erreurs · sans réponse</span></div>
    </div>

    <h2 class="section-title">Par thème</h2>
    <div class="card rev-card">
      ${themes.map((theme) => {
        const entry = byTheme.get(theme.id);
        const rate = entry.total ? Math.round((entry.correct / entry.total) * 100) : 0;
        return `<div class="stats-theme">
          <div class="stats-theme-head"><strong>${esc(theme.shortTitle)}</strong><span>${entry.correct}/${entry.total} · ${rate}%</span></div>
          <div class="stats-bar"><span style="width:${rate}%"></span></div>
          <div class="stats-theme-meta">${entry.total ? `${entry.total} ${entry.total === 1 ? 'question' : 'questions'} · ${entry.blank} sans réponse` : 'Pas encore travaillé'}</div>
        </div>`;
      }).join('')}
    </div>

    <h2 class="section-title">Par mode</h2>
    <div class="grid grid-2">
      ${modeStats.map((item) => `<div class="card rev-card"><h3>${item.mode === 'exam' ? 'Examen' : 'Révision'}</h3><p>${item.count} ${item.count === 1 ? 'test' : 'tests'} · moyenne ${item.average.toFixed(1)}/20</p></div>`).join('')}
    </div>

    <h2 class="section-title">Dernières tentatives</h2>
    <div class="card rev-card">
      ${attempts.slice(0, 8).map((a) => `<div class="attempt-row"><span>${fmtDate(a.date)} · ${esc(a.title)} · ${a.mode === 'revision' ? 'Révision' : 'Examen'}</span><strong>${a.score20.toFixed(1)}/20</strong></div>`).join('')}
    </div>
    <div class="quiz-foot"><a class="btn btn-primary" href="#/exam">${icon('play')} Nouvel examen</a><button class="btn btn-ghost" data-action="home">${icon('back')} Accueil</button></div>
  `;
}

/* ---------- ACTIONS ---------- */
app.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'start-exam') { startExam(el.dataset.mode); return; }
  if (action === 'start-theme') { startTheme(el.dataset.theme, el.dataset.mode); return; }
  if (action === 'start-config') { navigate(sessionUrl({ ...state.examConfig })); return; }
  if (action === 'cfg-mode') { state.examConfig.revision = el.dataset.value === 'revision'; render(); return; }
  if (action === 'cfg-count') { state.examConfig.count = Number(el.dataset.value); render(); return; }
  if (action === 'cfg-duration') { state.examConfig.duration = Number(el.dataset.value); render(); return; }
  if (action === 'open-theme') { navigate(`#/themes/${el.dataset.theme}`); return; }
  if (action === 'open-revision') { navigate('#/resume'); return; }
  if (action === 'open-themes') { navigate('#/themes'); return; }
  if (action === 'open-stats') { navigate('#/stats'); return; }
  if (action === 'home') { navigate('#/'); return; }
  if (action === 'retake') {
    const a = state.attempt;
    const settings = a?.settings || {
      theme: null, count: a?.total || state.examConfig.count, duration: state.examConfig.duration,
      canadian: a?.canadian ?? state.examConfig.canadian, revision: a?.mode === 'revision',
    };
    navigate(sessionUrl({ ...settings, revision: a?.mode === 'revision' }));
    return;
  }
  if (action === 'quit') {
    if (state.session && !state.session.finished && !confirm('Quitter la session ? La progression en cours sera perdue.')) return;
    stopClock();
    state.session = null;
    navigate('#/exam');
    return;
  }
  if (action === 'filter') { state.reviewFilter = el.dataset.filter; render(); return; }
  if (action === 'rev-tab') { state.revisionTab = el.dataset.tab; render(); return; }
  if (!state.session) return;
  const s = state.session;
  if (action === 'option') {
    const i = Number(el.dataset.index);
    s.selections[s.questions[s.index].id] = i;
    render();
    return;
  }
  if (action === 'prev') { s.index = Math.max(0, s.index - 1); render(); return; }
  if (action === 'next') { s.index = Math.min(s.questions.length - 1, s.index + 1); render(); return; }
  if (action === 'goto') { s.index = Number(el.dataset.index); render(); return; }
  if (action === 'skip') {
    if (s.index === s.questions.length - 1) submitSession(); else { s.index += 1; render(); }
    return;
  }
  if (action === 'reveal') {
    const q = s.questions[s.index];
    if (s.selections[q.id] === undefined) return;
    s.revealed[q.id] = true;
    render();
    return;
  }
  if (action === 'submit') { submitSession(); return; }
  if (action === 'pause') { s.paused = true; s.pausedAt = Date.now(); render(); return; }
  if (action === 'resume') { s.pausedMs += Date.now() - s.pausedAt; s.paused = false; render(); return; }
});

function submitSession() {
  const s = state.session;
  const blank = s.questions.filter((q) => s.selections[q.id] === undefined).length;
  const message = blank ? `${blank} question(s) sans réponse. Rendre la copie ?` : 'Rendre la copie ?';
  if (confirm(message)) finish(false);
}

app.addEventListener('input', (event) => {
  if (event.target.dataset.role === 'search') {
    state.search = event.target.value;
    render();
  }
});

window.addEventListener('hashchange', () => {
  if (state.view === 'quiz' && state.session && !state.session.finished) {
    if (!confirm('Quitter la session en cours ? La progression sera perdue.')) {
      history.replaceState(null, '', state.appliedHash || '#/');
      return;
    }
    state.session = null;
    stopClock();
  }
  applyRoute();
});
document.getElementById('settingsBtn').addEventListener('click', () => settingsDialog.showModal());
document.getElementById('settingsBtnMobile').addEventListener('click', () => settingsDialog.showModal());
document.getElementById('closeSettings').addEventListener('click', () => settingsDialog.close());
document.getElementById('resetPilot').addEventListener('click', () => {
  if (!confirm('Effacer les tentatives ? L’ancienne version n’est pas concernée.')) return;
  state.attempts = []; saveAttempts(); settingsDialog.close(); navigate('#/');
});

const AR_UI = {
  "Accueil": "الرئيسية",
  "Examen": "اختبار",
  "Révision & résumés": "المراجعة والملخصات",
  "Thèmes": "المحاور",
  "Révision": "مراجعة",
  "Pilote": "نسخة تجريبية",
  "PILOTE": "تجريبي",
  "PILOTE · REFONTE 2026": "تجريبي · إعادة التصميم 2026",
  "PILOTE · 30 PAR EXAMEN": "تجريبي · 30 لكل اختبار",
  "V10.0 · pilote": "V10.0 · نسخة تجريبية",
  "30 questions · 2 thèmes": "30 سؤالاً · محوران",
  "18 situations · 12 directes, avec des pièges renforcés.": "18 حالة عملية · 12 سؤالاً مباشراً لاختبار الصعوبة.",
  "60 % situations · 40 % direct": "60% حالات · 40% مباشر",
  "Paramètres": "الإعدادات",
  "Version classique": "النسخة الكلاسيكية",
  "Langue": "اللغة",
  "Refonte 2026 · pilote de validation": "إعادة التصميم 2026 · نسخة تحقق",
  "Cap CPI V10": "كاب CPI V10",
  "Un pilote construit sur le vécu du vrai concours : 5 choix, E = « Aucune réponse n’est valide », barème canadien, mises en situation et pièges d’un mot.": "نسخة تجريبية مبنية على تجربة الامتحان الحقيقي: 5 خيارات، E = «لا توجد إجابة صحيحة»، سلم كندي، حالات عملية وفخاخ كلمة واحدة.",
  "Objectif": "الهدف",
  "Se former aux pièges, pas aux questions.": "التكوين على الفخاخ، لا على الأسئلة.",
  "Le pilote s’appuie sur une banque de 40 questions pour 2 thèmes. Chaque examen en tire 30 : 20 mises en situation et 10 questions directes. Le reste des 12 thèmes sera produit après validation.": "تشمل النسخة التجريبية محورين: التحديث والتحفيز. 30 سؤالاً، منها 18 حالة عملية. ستُنتج بقية المحاور الاثني عشر بعد التحقق من المستوى.",
  "2 thèmes pilotes": "محوران تجريبيان",
  "18 situations · 12 directes": "18 حالة · 12 مباشراً",
  "40 minutes": "40 دقيقة",
  "Barème canadien": "سلم كندي",
  "Démarrer": "ابدأ",
  "Examen pilote": "اختبار تجريبي",
  "30 questions tirées": "30 سؤالاً مختلطاً",
  "Banque de 40 · 5 choix A–E · 40 minutes · pause · correction finale.": "5 خيارات A–E · 40 دقيقة · الإيقاف المؤقت مسموح · التصحيح في النهاية.",
  "30 questions tirées avec correction immédiate": "30 سؤالاً مع تصحيح فوري",
  "Temps libre, explications et source pour chaque question.": "وقت حر، تفسيرات ومرجع لكل سؤال.",
  "Réviser": "راجع",
  "Thèmes du pilote": "محاور النسخة التجريبية",
  "15 questions tirées": "15 سؤالاً تجريبياً",
  "Ouvrir": "افتح",
  "10 autres thèmes": "10 محاور أخرى",
  "À produire après validation : Transformation, GPEEC, Intelligence collective, Digital, Performance, Risques, Équipes, Changement, Contrôle interne, Management.": "ستُنتج بعد التحقق: التحول، GPEEC، الذكاء الجماعي، الرقمي، الأداء، المخاطر، الفرق، التغيير، المراقبة الداخلية، التدبير.",
  "Aucune tentative": "لا محاولة",
  "Lance l’examen ou un thème pour commencer.": "ابدأ الاختبار أو محوراً للبدء.",
  "Dernières tentatives": "آخر المحاولات",
  "Moyenne pilote": "معدل النسخة التجريبية",
  "L’essentiel": "الأساسي",
  "Révision & résumés": "المراجعة والملخصات",
  "Le fichier v2.3, enrichi": "ملف v2.3 الموسع",
  "21 textes, 78 théories et auteurs, 42 définitions, les repères OFPPT 2026 et les nouveaux théoriciens.": "21 نصاً، 78 نظرية ومؤلفاً، 42 تعريفاً، معالم OFPPT 2026 والمفكرون الجدد.",
  "Données locales · aucune donnée nominative · l’ancienne version reste accessible par l’icône archive.": "نسخة محلية · لا بيانات اسمية · النسخة القديمة متاحة عبر أيقونة الأرشيف.",
  "Parcours pilote": "مسار تجريبي",
  "Deux thèmes disponibles pour tester le niveau des pièges. Les dix autres seront ajoutés après validation.": "محوران متاحان لاختبار مستوى الفخاخ. ستُضاف العشرة الأخرى بعد التحقق.",
  "15 questions": "15 سؤالاً",
  "Définition": "التعريف",
  "Définition.": "التعريف.",
  "Objectifs": "الأهداف",
  "Avantages": "المزايا",
  "Limites": "الحدود",
  "Conditions": "شروط النجاح",
  "Examen du thème": "اختبار المحور",
  "15 questions · 20 minutes · pause · correction à la fin.": "15 سؤالاً · 20 دقيقة · إيقاف مؤقت · التصحيح في النهاية.",
  "30 questions · 30 minutes · pause · correction à la fin.": "30 سؤالاً · 30 دقيقة · إيقاف مؤقت · التصحيح في النهاية.",
  "30+ questions · 40 minutes · correction immédiate · parcours complet.": "أكثر من 30 سؤالاً · 40 دقيقة · تصحيح فوري · مسار كامل.",
  "Chaque thème propose au moins 30 questions. L’examen en tire 30 ; la révision parcourt l’ensemble du thème.": "كل محور يضم 30 سؤالاً على الأقل. يسحب الاختبار 30 منها، بينما تغطي المراجعة كامل المحور.",
  "Tester": "اختبر",
  "Révision du thème": "مراجعة المحور",
  "15 questions · correction immédiate · temps libre.": "15 سؤالاً · تصحيح فوري · وقت حر.",
  "Le découpage final (définitions, lois, théories, situations, défi) sera appliqué après le pilote ; ici, l’objectif est de valider le style des questions.": "سيُطبق التقسيم النهائي (تعريفات، قوانين، نظريات، حالات، تحدٍ) بعد النسخة التجريبية؛ الهدف هنا التحقق من أسلوب الأسئلة.",
  "Révision & résumés": "المراجعة والملخصات",
  "Un seul endroit pour réviser": "مكان واحد للمراجعة",
  "Le résumé minimal par thème et l’essentiel global, issus du fichier v2.3 enrichi.": "الملخص الأدنى لكل محور والأساسي الشامل من ملف v2.3 الموسع.",
  "Par thème": "حسب المحور",
  "L’essentiel global": "الأساسي الشامل",
  "Repères OFPPT 2026": "معالم OFPPT 2026",
  "Lois, textes et référentiels": "القوانين والنصوص والمراجع",
  "Théories, auteurs et modèles": "النظريات والمؤلفون والنماذج",
  "Définitions des concepts": "تعريفات المفاهيم",
  "Rechercher un texte, un auteur, une notion…": "ابحث عن نص أو مؤلف أو مفهوم…",
  "Auteur / modèle": "المؤلف / النموذج",
  "Idée clé": "الفكرة الرئيسية",
  "Concept": "المفهوم",
  "Définition": "التعريف",
  "Définition.": "التعريف.",
  "Texte": "النص",
  "Nature": "النوع",
  "À retenir": "ما يجب تذكره",
  "Source": "المصدر",
  "Nouveau": "جديد",
  "Télécharger le Word": "تحميل ملف Word",
  "Source": "المصدر",
  "Question": "سؤال",
  "Mode examen": "نمط الاختبار",
  "Mode révision": "نمط المراجعة",
  "temps libre": "وقت حر",
  "Canadien": "كندي",
  "Précédent": "السابق",
  "Passer": "تخطي",
  "Rendre la copie": "سلّم الورقة",
  "Valider et voir la correction": "تحقق واعرض التصحيح",
  "Question suivante": "السؤال التالي",
  "Correct": "صحيح",
  "Incorrect": "خطأ",
  "Bonne réponse": "الإجابة الصحيحة",
  "Pause": "إيقاف مؤقت",
  "Session suspendue": "الجلسة موقوفة",
  "Le chronomètre est arrêté. Tu peux reprendre quand tu veux.": "العداد متوقف. يمكنك الاستئناف متى شئت.",
  "Reprendre": "استئناف",
  "Examen terminé": "انتهى الاختبار",
  "Révision terminée": "انتهت المراجعة",
  "Refaire": "أعد",
  "Bonnes réponses": "إجابات صحيحة",
  "Mauvaises": "خاطئة",
  "Sans réponse": "دون إجابة",
  "Réussite": "نسبة النجاح",
  "Correction": "التصحيح",
  "Toutes les questions": "كل الأسئلة",
  "Toutes": "الكل",
  "Erreurs": "الأخطاء",
  "Erreur": "خطأ",
  "Votre réponse": "إجابتك",
  "Aucune": "لا شيء",
  "Accueil": "الرئيسية",
  "Paramètres du pilote": "إعدادات النسخة التجريبية",
  "Pilote local : les tentatives restent sur cet appareil. Aucun nom, aucun concours, aucune base de données.": "نسخة محلية: تبقى المحاولات على هذا الجهاز. لا اسم ولا مسابقة ولا قاعدة بيانات.",
  "L’ancienne plateforme reste accessible via l’icône archive à côté des paramètres.": "تبقى المنصة القديمة متاحة عبر أيقونة الأرشيف بجانب الإعدادات.",
  "Réinitialiser le pilote": "إعادة ضبط النسخة التجريبية",
  "Fermer": "إغلاق",
  "PRÉPARATION 2026": "التحضير 2026",
  "240 questions · 12 thèmes": "240 سؤالاً · 12 محوراً",
  "Les 12 thèmes": "المحاور الاثنا عشر",
  "20 questions par thème · 30 tirées par examen, avec pièges renforcés.": "20 سؤالاً لكل محور · 30 سؤالاً مسحوباً لكل اختبار مع فخاخ معززة.",
  "Les 12 thèmes": "المحاور الاثنا عشر",
  "Chaque thème propose au moins 30 questions : définitions, lois, théories et mises en situation, avec corrections.": "كل محور يضم 30 سؤالاً على الأقل: تعريفات وقوانين ونظريات وحالات عملية مع التصحيح.",
  "Chaque thème propose au moins 30 questions, dont 15 tirées pour une session d’entraînement.": "كل محور يضم 30 سؤالاً على الأقل، يُسحب منها 15 لجلسة تدريب.",
  "Les tentatives restent sur cet appareil. Aucun nom, aucune base de données.": "تبقى المحاولات على هذا الجهاز. لا اسم ولا قاعدة بيانات.",
  "Réinitialiser les données": "إعادة ضبط البيانات",
  "Configurer l’examen": "إعداد الاختبار",
  "Résumé": "الملخص",
  "Statistiques": "الإحصائيات",
  "Stats": "إحصائيات",
  "40 questions · 2 thèmes": "40 سؤالاً · محوران",
  "30 questions tirées : 20 situations, 10 directes, avec pièges renforcés.": "30 سؤالاً مسحوباً: 20 حالة و10 أسئلة مباشرة مع فخاخ معززة.",
  "65 % situations · 35 % direct": "65% حالات · 35% مباشر",
  "Le pilote s’appuie sur une banque de 40 questions pour 2 thèmes. Chaque examen en tire 30 : 20 mises en situation et 10 questions directes. Le reste des 12 thèmes sera produit après validation.": "تعتمد النسخة التجريبية على بنك من 40 سؤالاً لمحورين. يسحب كل اختبار 30 سؤالاً: 20 حالة عملية و10 أسئلة مباشرة. ستُنتج بقية المحاور بعد التحقق.",
  "30 questions tirées": "30 سؤالاً مسحوباً",
  "30 questions tirées avec correction immédiate": "30 سؤالاً مسحوباً مع تصحيح فوري",
  "20 situations · 10 directes par examen": "20 حالة · 10 مباشرة لكل اختبار",
  "Banque de 40 · 5 choix A–E · 40 minutes · pause · correction finale.": "بنك 40 · 5 خيارات A–E · 40 دقيقة · إيقاف مؤقت · تصحيح نهائي.",
  "15 questions tirées": "15 سؤالاً مسحوباً",
  "Un seul endroit pour réviser : les lois, textes, théories, auteurs, définitions et repères OFPPT, issus du fichier v2.3 enrichi.": "مكان واحد للمراجعة: القوانين والنصوص والنظريات والمؤلفون والتعريفات ومعالم OFPPT من ملف v2.3 الموسع.",
  "Questions travaillées, réussite, temps, thèmes et modes. Les données restent sur cet appareil.": "الأسئلة المنجزة، النجاح، الوقت، المحاور والأنماط. تبقى البيانات على هذا الجهاز.",
  "Votre progression": "تقدمك",
  "tests passés": "اختبارات منجزة",
  "test passé": "اختبار منجز",
  "questions traitées": "أسئلة معالجة",
  "note moyenne": "المعدل",
  "meilleur score": "أفضل نتيجة",
  "taux de réussite": "نسبة النجاح",
  "temps moyen / question": "الزمن المتوسط / سؤال",
  "bonnes réponses": "إجابات صحيحة",
  "erreurs · sans réponse": "أخطاء · دون إجابة",
  "Par thème": "حسب المحور",
  "Par mode": "حسب النمط",
  "Dernières tentatives": "آخر المحاولات",
  "Pas encore travaillé": "لم يُنجز بعد",
  "questions · ": "أسئلة · ",
  "Nouvel examen": "اختبار جديد",
  "Lancer l’examen": "ابدأ الاختبار",
  "Les statistiques apparaîtront après le premier examen ou la première révision.": "ستظهر الإحصائيات بعد أول اختبار أو مراجعة.",
};

const AR_PATTERNS = [
  [/^Question (\d+) \/ (\d+)$/, "السؤال $1 / $2"],
  [/^Thème (\d+) \/ 12$/, "المحور $1 / 12"],
  [/^(\d+) questions pilotes$/, "$1 أسئلة تجريبية"],
  [/^(\d+) questions$/, "$1 أسئلة"],
  [/^(\d+) bonnes · (\d+) mauvaises · (\d+) sans réponse · (.+)$/, "$1 صحيحة · $2 خاطئة · $3 دون إجابة · $4"],
  [/^Score brut canadien : (-?\d+) \/ (\d+)( · temps écoulé)?$/, "النتيجة الخام الكندية: $1 / $2$3"],
  [/^Moyenne pilote : ([\d.,]+)\/20$/, "معدل النسخة التجريبية: $1/20"],
  [/^Erreurs · (\d+)$/, "الأخطاء · $1"],
  [/^Notions clés \((\d+)\)$/, "المفاهيم الأساسية ($1)"],
  [/^Lois, textes et référentiels \((\d+)\)$/, "القوانين والنصوص والمراجع ($1)"],
  [/^Théories, auteurs et modèles \((\d+)\)$/, "النظريات والمؤلفون والنماذج ($1)"],
  [/^Définitions des concepts \((\d+)\)$/, "تعريفات المفاهيم ($1)"],
  [/^Question (\d+) · (Correct|Sans réponse|Erreur)$/, "السؤال $1 · $2"],
  [/^Mode examen · (\d+) min · Canadien$/, "نمط الاختبار · $1 دقيقة · كندي"],
  [/^Mode examen · (\d+) min · Standard$/, "نمط الاختبار · $1 دقيقة · عادي"],
  [/^Mode révision · (\d+) min · Standard$/, "نمط المراجعة · $1 دقيقة · عادي"],
  [/^Barème canadien · score brut (-?\d+) \/ (\d+)( · temps écoulé)?$/, "النظام الكندي · النقطة الخام $1 / $2$3"],
  [/^Barème standard · (\d+) \/ (\d+)( · temps écoulé)?$/, "التصحيح العادي · $1 / $2$3"],
  [/^Mode révision · temps libre · Canadien$/, "نمط المراجعة · وقت حر · كندي"],
  [/^(\d+) min$/, "$1 دقيقة"],
  [/^(\d+) questions pilotes$/, "$1 أسئلة تجريبية"],
  [/(\d+) situations · (\d+) directes$/, "$1 حالات · $2 مباشر"],
  [/^Révision terminée · (.+)$/, "انتهت المراجعة · $1"],
  [/^Examen terminé · (.+)$/, "انتهى الاختبار · $1"],
  [/^Question (\d+) · Correct$/, "السؤال $1 · صحيح"],
  [/^Question (\d+) · Sans réponse$/, "السؤال $1 · دون إجابة"],
  [/^Question (\d+) · Erreur$/, "السؤال $1 · خطأ"],
  [/^Correct · (.+)$/, "صحيح · $1"],
  [/^Incorrect · (.+)$/, "خطأ · $1"],
  [/^Source · (.+)$/, "المصدر · $1"],
  [/^Score brut canadien : (-?\d+) \/ (\d+)$/, "النتيجة الخام الكندية: $1 / $2"],
  [/^Score brut canadien : (-?\d+) \/ (\d+) · temps écoulé$/, "النتيجة الخام الكندية: $1 / $2 · انتهى الوقت"],
  [/^Source : (.+)$/, "المصدر: $1"],
  [/^ · (\d+) textes · (\d+) théories · (\d+) définitions · repères OFPPT 2026\.$/, " · $1 نصاً · $2 نظرية · $3 تعريفاً · معالم OFPPT 2026."],
  [/^(\d+) tests passés$/, "$1 اختبارات منجزة"],
  [/^(\d+) questions traitées$/, "$1 أسئلة معالجة"],
  [/^(\d+) questions · (\d+) sans réponse$/, "$1 أسئلة · $2 دون إجابة"],
  [/^(\d+) test · moyenne ([\d.]+)\/20$/, "$1 اختبار · المعدل $2/20"],
  [/^(\d+) tests · moyenne ([\d.]+)\/20$/, "$1 اختبارات · المعدل $2/20"],
];

function translateText(text) {
  const exact = AR_UI[text];
  if (exact) return exact;
  for (const [pattern, replacement] of AR_PATTERNS) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

function translateUI() {
  if (state.lang !== 'ar') return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style')) continue;
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const translated = translateText(trimmed);
    if (translated !== trimmed) node.nodeValue = raw.replace(trimmed, translated);
  }
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const value = el.getAttribute(attr);
      if (value) {
        const translated = translateText(value.trim());
        if (translated !== value.trim()) el.setAttribute(attr, translated);
      }
    }
  });
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === state.lang);
  });
}

async function boot() {
  state.attempts = loadAttempts();
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/');
  try {
    const [questions, questionsAr, revision, revisionAr] = await Promise.all([
      fetch('./questions.json').then((r) => r.json()),
      fetch('./questions_ar.json').then((r) => r.json()).catch(() => null),
      fetch('./revision.json').then((r) => r.json()),
      fetch('./revision_ar.json').then((r) => r.json()).catch(() => null),
    ]);
    state.frData = questions;
    state.arData = questionsAr;
    state.frRevision = revision;
    state.arRevision = revisionAr;
    applyLanguage(state.lang, false);
  } catch (error) {
    app.innerHTML = `<div class="card empty"><h2>Pilote indisponible</h2><p>${esc(error.message)}</p><p>Ouvre le site via son adresse HTTP, pas en file://.</p></div>`;
  }
}

function applyLanguage(lang, persist = true) {
  state.lang = lang;
  if (persist) localStorage.setItem('capcpi.v10.pilot.lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  state.data = lang === 'ar' && state.arData ? state.arData : state.frData;
  state.revision = lang === 'ar' && state.arRevision ? state.arRevision : state.frRevision;
  document.querySelectorAll('[data-lang]').forEach((button) => button.classList.toggle('active', button.dataset.lang === lang));
  applyRoute();
}

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => {
    localStorage.setItem('capcpi.v10.pilot.lang', button.dataset.lang);
    location.reload();
  });
});
boot();
