/* ============================================================
   Members Area controller
   - Gates the "Curso" tab on a valid ?t= token (proof of purchase),
     using the outcome of the EXISTING get_order_summary RPC
     (broadcast by order-summary.js via the `ordersummary:result` event).
   - Builds the course (3 modules / 46 lessons) from the AULAS AMAZON
     Supabase project (lmfwxmtolpvpdxglujjl), ordered by the `lessons` table.
   - Per-lesson "watched" state persisted in localStorage.
   - No token / invalid token => this file changes nothing on the page.
   ============================================================ */
(function () {
  'use strict';

  // ---- AULAS AMAZON course project (public bucket + public-read tables) ----
  var COURSE_SUPA_URL = 'https://lmfwxmtolpvpdxglujjl.supabase.co';
  var COURSE_ANON_KEY = 'sb_publishable_PZYzRdQAiNfdXMrzDI-9lQ_NKFDbGW3';
  var STORAGE_BASE = COURSE_SUPA_URL + '/storage/v1/object/public/course-files/';
  var LS_PREFIX = 'amz_watched_';
  var LS_LAST = 'amz_last_lesson';

  var html = document.documentElement;
  var deciding = html.classList.contains('t-loading');

  /* ---------------- TAB SWITCHING ---------------- */
  function setTab(tab) {
    var pedido = tab === 'pedido';
    html.classList.toggle('show-pedido', pedido);
    var tabs = document.querySelectorAll('.member-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === tab;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.member-tab') : null;
    if (t) { e.preventDefault(); setTab(t.getAttribute('data-tab')); }
  });

  // If nothing to gate (no token / invalid-mock), leave the page exactly as today.
  if (!deciding) return;

  /* ---------------- GATE DECISION ---------------- */
  var decided = false;
  function reveal() {
    if (decided) return; decided = true;
    html.classList.remove('t-loading', 'show-pedido'); // ensure Curso is always the initial tab
    html.classList.add('t-member');   // Course becomes the default panel
  }
  function plain() {
    if (decided) return; decided = true;
    html.classList.remove('t-loading'); // -> today's page shows (tracking + any error message)
  }
  document.addEventListener('ordersummary:result', function (e) {
    var st = e.detail && e.detail.state;
    if (st === 'valid') reveal(); else plain();
  });
  // Backstop: if no result ever arrives (e.g. CustomEvent unsupported), fall back
  // to today's behavior rather than gating a real buyer behind a broken event.
  setTimeout(function () { if (!decided) plain(); }, 10000);

  // Build the course in parallel so it's ready the moment Course is revealed.
  buildCourse();

  /* ---------------- COURSE DATA ---------------- */
  function fetchModules() {
    if (!window.supabase || !window.supabase.createClient) return Promise.reject(new Error('no-supabase'));
    var client = window.supabase.createClient(COURSE_SUPA_URL, COURSE_ANON_KEY);
    return Promise.all([
      client.from('courses').select('id,slug,title,subtitle,sort_order').order('sort_order', { ascending: true }),
      client.from('lessons').select('id,course_id,sort_order,title,description,video_path').order('sort_order', { ascending: true })
    ]).then(function (res) {
      var cErr = res[0].error, lErr = res[1].error;
      if (cErr || lErr) throw (cErr || lErr);
      var courses = res[0].data || [], lessons = res[1].data || [];
      if (!courses.length || !lessons.length) throw new Error('empty');
      var byCourse = {};
      lessons.forEach(function (l) { (byCourse[l.course_id] = byCourse[l.course_id] || []).push(l); });
      return courses.map(function (c) {
        return {
          id: c.slug, title: c.title, subtitle: c.subtitle || '',
          lessons: (byCourse[c.id] || []).map(function (l) {
            return {
              id: l.id, title: l.title || ('Lesson ' + l.sort_order),
              description: l.description || '',
              url: STORAGE_BASE + l.video_path
            };
          })
        };
      }).filter(function (m) { return m.lessons.length; });
    });
  }

  // Resilience fallback derived from the known bucket structure (scout map),
  // used only if the DB read fails. Ordering/paths match the storage layout.
  function fallbackModules() {
    function build(slug, title, subtitle, count, pad) {
      var lessons = [];
      for (var i = 1; i <= count; i++) {
        var n = pad ? String(i).padStart(2, '0') : String(i);
        lessons.push({
          id: slug + '-' + i, title: 'Lesson ' + (i < 10 ? '0' + i : i),
          description: '', url: STORAGE_BASE + slug + '/video-' + n + '.mp4'
        });
      }
      return { id: slug, title: title, subtitle: subtitle, lessons: lessons };
    }
    return [
      build('affiliate-profits', 'Amazon Affiliate Profits', 'For aspiring Amazon affiliates', 15, true),
      build('marketing-made-easy', 'Amazon Marketing Made Easy', 'For active Amazon sellers', 21, true),
      build('fulfillment-by-amazon', 'Fulfillment By Amazon', 'For first-time FBA sellers', 10, true)
    ];
  }

  function buildCourse() {
    var mount = document.getElementById('courseMount');
    if (!mount) return;
    fetchModules()
      .then(function (mods) { renderCourse(mount, mods); })
      .catch(function () { renderCourse(mount, fallbackModules()); });
  }

  /* ---------------- WATCHED STATE ---------------- */
  function isDone(id) {
    try { return localStorage.getItem(LS_PREFIX + id) === '1'; } catch (e) { return false; }
  }
  function setDone(id, val) {
    try { val ? localStorage.setItem(LS_PREFIX + id, '1') : localStorage.removeItem(LS_PREFIX + id); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- RENDER ---------------- */
  function renderCourse(mount, modules) {
    // Flat lesson list (for prev/next + global numbering)
    var flat = [];
    modules.forEach(function (m, mi) {
      m.lessons.forEach(function (l, li) { flat.push({ l: l, mi: mi, li: li }); });
    });
    var total = flat.length;
    var CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    var sidebarModules = modules.map(function (m, mi) {
      var lessonsHtml = m.lessons.map(function (l, li) {
        return '<div class="lsn" data-id="' + esc(l.id) + '" data-mi="' + mi + '" data-li="' + li + '">' +
          '<span class="lsn-check">' + CHECK + '</span>' +
          '<span class="lsn-body"><span class="lsn-title">' + esc(l.title) + '</span></span>' +
          '<span class="lsn-num">' + (li + 1) + '</span>' +
          '</div>';
      }).join('');
      return '<div class="mod" data-mi="' + mi + '">' +
        '<button class="mod-head" type="button">' +
          '<span class="mod-idx">' + (mi + 1) + '</span>' +
          '<span class="mod-titles"><span class="mod-title">' + esc(m.title) + '</span>' +
            '<span class="mod-meta"><span class="mod-count">0</span>/' + m.lessons.length + ' • ' + esc(m.subtitle) + '</span></span>' +
          '<svg class="mod-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
        '<div class="mod-lessons">' + lessonsHtml + '</div>' +
      '</div>';
    }).join('');

    mount.innerHTML =
      '<section class="course-hero"><div class="container">' +
        '<span class="course-eyebrow"><span class="dot"></span>Members Area · AULAS AMAZON</span>' +
        '<h1>Your Amazon Course</h1>' +
        '<p class="course-sub">Full access to every module. Watch at your pace and track your progress — it saves automatically on this device.</p>' +
        '<div class="course-progress">' +
          '<div class="course-progress-top">' +
            '<span class="course-progress-label"><span id="cpDone">0</span> of ' + total + ' lessons completed</span>' +
            '<span class="course-progress-pct" id="cpPct">0<span>%</span></span>' +
          '</div>' +
          '<div class="course-bar"><div class="course-bar-fill" id="cpBar"></div></div>' +
        '</div>' +
      '</div></section>' +

      '<div class="course-body">' +
        '<button class="drawer-toggle" id="drawerToggle" type="button">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' +
          'Lessons <span class="dt-count" id="dtCount"></span>' +
        '</button>' +

        '<aside class="course-sidebar">' +
          '<div class="sidebar-head"><div><h2>Course content</h2><p>' + modules.length + ' modules · ' + total + ' lessons</p></div>' +
            '<button class="drawer-close" id="drawerClose" type="button" aria-label="Close">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="sidebar-scroll">' + sidebarModules + '</div>' +
        '</aside>' +

        '<main class="course-main">' +
          '<div class="player-card">' +
            '<div class="player-frame">' +
              '<video id="courseVideo" controls playsinline preload="metadata"></video>' +
            '</div>' +
            '<div class="player-meta">' +
              '<div class="player-kicker"><span class="player-badge" id="pModule"></span><span class="player-lessonnum" id="pNum"></span></div>' +
              '<h2 class="player-title" id="pTitle">Select a lesson</h2>' +
              '<p class="player-desc" id="pDesc" hidden></p>' +
              '<div class="player-actions">' +
                '<button class="watch-toggle" id="watchToggle" type="button">' +
                  '<span class="wt-ico">' + CHECK + '</span><span class="wt-label">Mark as watched</span>' +
                '</button>' +
                '<div class="player-nav">' +
                  '<button class="nav-btn" id="prevBtn" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Prev</button>' +
                  '<button class="nav-btn" id="nextBtn" type="button">Next<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</main>' +
      '</div>' +
      '<div class="drawer-scrim" id="drawerScrim"></div>';

    /* ----- element refs ----- */
    var video = mount.querySelector('#courseVideo');
    var pModule = mount.querySelector('#pModule');
    var pNum = mount.querySelector('#pNum');
    var pTitle = mount.querySelector('#pTitle');
    var pDesc = mount.querySelector('#pDesc');
    var watchToggle = mount.querySelector('#watchToggle');
    var wtLabel = watchToggle.querySelector('.wt-label');
    var prevBtn = mount.querySelector('#prevBtn');
    var nextBtn = mount.querySelector('#nextBtn');
    var lessonEls = mount.querySelectorAll('.lsn');
    var current = -1;

    /* ----- progress ----- */
    function refreshProgress() {
      var done = 0;
      flat.forEach(function (f) { if (isDone(f.l.id)) done++; });
      var pct = total ? Math.round(done / total * 100) : 0;
      mount.querySelector('#cpDone').textContent = done;
      mount.querySelector('#cpPct').innerHTML = pct + '<span>%</span>';
      mount.querySelector('#cpBar').style.width = pct + '%';
      mount.querySelector('#dtCount').textContent = done + '/' + total;
      // per-module counts + lesson done classes
      modules.forEach(function (m, mi) {
        var c = 0;
        m.lessons.forEach(function (l) { if (isDone(l.id)) c++; });
        var modEl = mount.querySelector('.mod[data-mi="' + mi + '"] .mod-count');
        if (modEl) modEl.textContent = c;
      });
      for (var i = 0; i < lessonEls.length; i++) {
        var id = lessonEls[i].getAttribute('data-id');
        lessonEls[i].classList.toggle('done', isDone(id));
      }
    }

    function syncWatchBtn() {
      if (current < 0) return;
      var done = isDone(flat[current].l.id);
      watchToggle.classList.toggle('is-done', done);
      wtLabel.textContent = done ? 'Watched' : 'Mark as watched';
    }

    /* ----- load a lesson ----- */
    function load(idx, opts) {
      if (idx < 0 || idx >= total) return;
      current = idx;
      var f = flat[idx], l = f.l, m = modules[f.mi];
      video.src = l.url;
      video.load();
      if (opts && opts.autoplay) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
      pModule.textContent = 'Module ' + (f.mi + 1);
      pNum.textContent = 'Lesson ' + (f.li + 1) + ' of ' + m.lessons.length;
      pTitle.textContent = l.title;
      if (l.description) { pDesc.textContent = l.description; pDesc.hidden = false; }
      else { pDesc.hidden = true; }
      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === total - 1;
      // active highlight + open its module
      for (var i = 0; i < lessonEls.length; i++) lessonEls[i].classList.remove('active');
      var el = mount.querySelector('.lsn[data-id="' + cssId(l.id) + '"]');
      if (el) {
        el.classList.add('active');
        var mod = el.closest('.mod');
        if (mod && !mod.classList.contains('open')) openModule(mod);
        el.scrollIntoView({ block: 'nearest' });
      }
      syncWatchBtn();
      try { localStorage.setItem(LS_LAST, l.id); } catch (e) {}
    }
    function cssId(id) { return String(id).replace(/"/g, '\\"'); }

    /* ----- module accordion ----- */
    function openModule(mod) {
      var mods = mount.querySelectorAll('.mod');
      for (var i = 0; i < mods.length; i++) mods[i].classList.remove('open');
      mod.classList.add('open');
    }
    var modHeads = mount.querySelectorAll('.mod-head');
    for (var h = 0; h < modHeads.length; h++) {
      modHeads[h].addEventListener('click', function () {
        var mod = this.closest('.mod');
        if (mod.classList.contains('open')) mod.classList.remove('open');
        else openModule(mod);
      });
    }

    /* ----- lesson click ----- */
    for (var j = 0; j < lessonEls.length; j++) {
      lessonEls[j].addEventListener('click', function () {
        var mi = +this.getAttribute('data-mi'), li = +this.getAttribute('data-li');
        var idx = flatIndex(mi, li);
        if (idx >= 0) { load(idx, { autoplay: true }); closeDrawer(); }
      });
    }
    function flatIndex(mi, li) {
      for (var i = 0; i < flat.length; i++) if (flat[i].mi === mi && flat[i].li === li) return i;
      return -1;
    }

    /* ----- watched toggle ----- */
    watchToggle.addEventListener('click', function () {
      if (current < 0) return;
      var id = flat[current].l.id;
      setDone(id, !isDone(id));
      syncWatchBtn(); refreshProgress();
    });
    // auto-mark on finish
    video.addEventListener('ended', function () {
      if (current < 0) return;
      setDone(flat[current].l.id, true);
      syncWatchBtn(); refreshProgress();
    });

    /* ----- prev / next ----- */
    prevBtn.addEventListener('click', function () { if (current > 0) load(current - 1, { autoplay: true }); });
    nextBtn.addEventListener('click', function () { if (current < total - 1) load(current + 1, { autoplay: true }); });

    /* ----- mobile drawer ----- */
    var toggle = mount.querySelector('#drawerToggle');
    var closeBtn = mount.querySelector('#drawerClose');
    var scrim = mount.querySelector('#drawerScrim');
    function openDrawer() { html.classList.add('drawer-open'); document.body.classList.add('drawer-locked'); }
    function closeDrawer() { html.classList.remove('drawer-open'); document.body.classList.remove('drawer-locked'); }
    if (toggle) toggle.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (scrim) scrim.addEventListener('click', closeDrawer);

    /* ----- initial state ----- */
    refreshProgress();
    var lastId = null;
    try { lastId = localStorage.getItem(LS_LAST); } catch (e) {}
    var startIdx = 0;
    if (lastId) { for (var k = 0; k < flat.length; k++) if (flat[k].l.id === lastId) { startIdx = k; break; } }
    load(startIdx, { autoplay: false });
    if (startIdx === 0) { var first = mount.querySelector('.mod'); if (first) first.classList.add('open'); }
  }
})();
