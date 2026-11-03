/* Planos: la app. Lee la ruta y las unidades de ./data, guarda el progreso en el iPhone (IndexedDB),
   gestiona la instalación y el aviso de cada mañana, el repaso espaciado, la lectura en voz alta,
   el simulacro de entrevista con Claude, el glosario con buscador y la página de progreso (racha, calendario y logros). */
(() => {
  'use strict';
  const C = window.PlanosCore;

  // Clave pública VAPID: con ella el iPhone acepta los avisos que firma la tarea diaria de Claude.
  const VAPID_PUBLIC = 'BJkgg8WXyX8y1UY_sIxzuKDtnEdMxVWT5_iFF9x_C3FGssW44FcbdWpPDXXdf3Ai9cTgP2dbSsfJlSp4-LKa9HE';
  const REMINDER_TIME = '9:53';
  const CALLOUT_LABEL = { tip: 'Truco', trap: 'Ojo', interview: 'En la entrevista', example: 'Ejemplo' };
  const FEEL = [
    { id: 'ok', label: 'Lo tengo' },
    { id: 'meh', label: 'Más o menos' },
    { id: 'review', label: 'Quiero repasarlo' },
  ];
  const CARD_LABEL = { term: 'Término', mcq: 'Pregunta', qa: 'Pregunta del problema' };
  const TTS_RATES = [1, 1.25, 0.85];

  const ICON = {
    mark: '<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="8" fill="var(--blue)"/><path d="M8 9h7v6H8zM19 9h7v6h-7zM13.5 22h7v4h-7z" fill="none" stroke="var(--on-blue)" stroke-width="1.8"/><path d="M11.5 15v3.5h11V15M17 18.5V22" fill="none" stroke="var(--on-blue)" stroke-width="1.8"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20zM12 10v4M12 17v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" class="share-ico" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/></svg>',
    cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="14" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 4h11a3 3 0 0 1 3 3v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5c-3.9 0-6.8-2.8-6.8-6.6 0-3.4 2.2-5.4 3.8-7.6.3 1.7 1.2 2.9 2.4 3.4.1-3.4 1.6-5.8 3.2-8.2.7 3.2 5.2 6.2 5.2 11.6 0 4.3-3.1 7.4-7.8 7.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 21.5c-1.8 0-3-1.3-3-3 0-1.8 1.4-2.8 2.3-4.3.9 1.3 3.8 2.4 3.8 4.5 0 1.6-1.3 2.8-3.1 2.8z" fill="currentColor"/></svg>',
    rest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    medal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="15" r="5.8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.6 10.3 6 3h4l2 4.6L14 3h4l-2.6 7.3M12 12.6l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const NODE_ICON = {
    client: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    lb: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="12" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v9.6M11 7l-5 10M13 7l5 10"/>',
    service: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9h10M7 13h10M7 17h6"/>',
    cache: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    queue: '<rect x="2.5" y="7" width="5" height="10" rx="1"/><rect x="9.5" y="7" width="5" height="10" rx="1"/><rect x="16.5" y="7" width="5" height="10" rx="1"/>',
    storage: '<path d="M4 7h16l-2 13H6z"/><ellipse cx="12" cy="7" rx="8" ry="2.6"/>',
    cdn: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    worker: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    external: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"/>',
    stream: '<path d="M3 8c3-3 6 3 9 0s6 3 9 0M3 16c3-3 6 3 9 0s6 3 9 0"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  };

  const S = {
    status: 'loading', path: null, ready: new Set(), version: '', units: {}, progress: {},
    cards: {}, reviewLog: {}, reviewInfo: null, rev: null, seenBadges: null, cal: null,
    search: { q: '', ready: false, terms: [], docs: [] },
    view: { name: 'home' }, ui: {}, reg: null,
    push: { supported: false, permission: 'default', subscribed: false, code: null, sent: false, busy: false },
    settings: { showCode: false, restore: false, restoreText: '', restoreError: '' },
  };
  const app = document.getElementById('app');

  // ---------- text ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  }
  function table(lines) {
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(lines[0]);
    const body = lines.slice(2).map(cells);
    return '<div class="tbl"><table><thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' +
      body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function md(text) {
    const out = [];
    String(text ?? '').split('```').forEach((part, i) => {
      if (i % 2 === 1) {
        const nl = part.indexOf('\n');
        const body = (nl >= 0 ? part.slice(nl + 1) : part).replace(/\n$/, '');
        out.push(`<pre class="code"><code>${esc(body)}</code></pre>`);
        return;
      }
      // Group consecutive lines of the same kind, so "Intro:\n- a\n- b" becomes a paragraph and a list.
      const kindOf = (l) => (/^\s*\|.*\|\s*$/.test(l) ? 'table' : /^\s*[-•]\s+/.test(l) ? 'ul' : /^\s*\d+[.)]\s+/.test(l) ? 'ol' : /^\s*$/.test(l) ? 'blank' : 'p');
      const groups = [];
      part.split('\n').forEach((l) => {
        const k = kindOf(l);
        const last = groups[groups.length - 1];
        if (k === 'blank') { groups.push({ k, lines: [] }); return; }
        if (last && last.k === k) last.lines.push(l);
        else groups.push({ k, lines: [l] });
      });
      groups.forEach(({ k, lines }) => {
        if (!lines.length) return;
        if (k === 'table' && lines.length >= 2 && /^\s*\|[\s:|-]+\|\s*$/.test(lines[1])) out.push(table(lines));
        else if (k === 'ul') out.push('<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-•]\s+/, '')) + '</li>').join('') + '</ul>');
        else if (k === 'ol') out.push('<ol>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>').join('') + '</ol>');
        else out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
      });
    });
    return out.join('');
  }
  // Markdown to plain text, for listening and for search. Code and tables are left out.
  function plain(text) {
    return String(text ?? '')
      .replace(/```[\s\S]*?```/g, ' ')
      .split('\n').filter((l) => !/^\s*\|.*\|\s*$/.test(l)).join('\n')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*`]/g, '')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '');
  }
  // Lowercase without accents, keeping the length so positions map back to the original text.
  const fold = (s) => String(s ?? '').split('').map((ch) => (ch.normalize('NFD')[0] || ch).toLowerCase()).join('');

  // ---------- data ----------
  const outline = () => C.outline(S.path);
  const modules = () => (Array.isArray(S.path?.modules) ? S.path.modules : []);
  const meta = (id) => outline().find((u) => u.id === id);
  const isReady = (id) => S.ready.has(id);
  const content = (id) => S.units[id] || null;
  const prog = (id) => S.progress[id] || null;
  const isDone = (id) => prog(id)?.status === 'done';
  const kindLabel = C.kindLabel;
  const unitTitle = (id) => meta(id)?.title || id;
  const todayPlan = () => C.todayPlan(S.path, S.progress);
  const nextUndone = () => outline().find((u) => !isDone(u.id));
  const activeDays = () => Object.keys(S.reviewLog).filter((d) => S.reviewLog[d] > 0);
  const actDays = () => C.activityByDay(S.path, S.progress, S.reviewLog);
  const streakNow = () => C.streakInfo(S.progress, C.todayKey(), activeDays());

  // Fechas y cifras en castellano.
  const dayDate = (k) => new Date(k + 'T12:00:00Z');
  const fmtDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const fmtShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fmtMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const weekday = (k) => (dayDate(k).getUTCDay() + 6) % 7; // 0 = lunes
  // Son estimaciones: a partir de una hora se redondea a 5 min, y a partir de 10 h, a la hora.
  function fmtMins(m) {
    let r = Math.round(m);
    if (r < 60) return `${r} min`;
    if (r >= 600) return `${Math.round(r / 60)} h`;
    r = Math.round(r / 5) * 5;
    const h = Math.floor(r / 60);
    const rest = r % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }
  async function loadUnit(id) {
    if (!S.units[id]) S.units[id] = await getJSON(`./data/units/${id}.json`);
    return S.units[id];
  }
  async function loadUnits(ids) {
    const out = await Promise.all(ids.map((id) => loadUnit(id).catch(() => null)));
    return out.filter(Boolean);
  }

  // ---------- storage (in this iPhone) ----------
  const timers = {};
  function persist(key) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => { delete timers[key]; C.idbSet(key, S[key]).catch(() => toast('No se ha podido guardar')); }, 250);
  }
  function flush() {
    for (const key of Object.keys(timers)) {
      clearTimeout(timers[key]);
      delete timers[key];
      C.idbSet(key, S[key]).catch(() => {});
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  function saveProgress(id, patch) {
    const prev = S.progress[id] || { unitId: id, status: 'started', startedAt: new Date().toISOString() };
    S.progress[id] = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    persist('progress');
  }
  function saveNote(unitId, stepId, text) {
    const p = S.progress[unitId] || { unitId, status: 'started', startedAt: new Date().toISOString() };
    S.progress[unitId] = { ...p, notes: { ...(p.notes || {}), [stepId]: text } };
    persist('progress');
  }

  // ---------- small helpers ----------
  let toastTimer = null;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  function openExternal(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Opens Claude with a prompt already written (and copies it, in case the app drops the text).
  async function openClaude(prompt, note) {
    await copyText(prompt);
    openExternal('https://claude.ai/new?q=' + encodeURIComponent(prompt));
    toast(note || 'Abriendo Claude… (el texto también está copiado)');
  }
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- diagram ----------
  function diagram(d, tag) {
    if (!d || !Array.isArray(d.layers) || !d.layers.length) return '';
    const layers = d.layers.map((L) => {
      const nodes = (L.nodes || []).map((n) => {
        const kind = NODE_ICON[n.kind] ? n.kind : 'service';
        return `<div class="node k-${kind}"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${NODE_ICON[kind]}</svg><span><span class="nl">${esc(n.label)}</span>${n.note ? `<span class="nn">${esc(n.note)}</span>` : ''}</span></div>`;
      }).join('');
      return `<div class="layer">${L.label ? `<span class="layer-label">${esc(L.label)}</span>` : ''}<div class="nodes">${nodes}</div></div>`;
    }).join('<div class="arrow" aria-hidden="true"></div>');
    const label = d.layers.map((L) => (L.nodes || []).map((n) => n.label).join(' y ')).join(', luego ');
    const flow = Array.isArray(d.flow) && d.flow.length ? `<ol class="flow">${d.flow.map((f) => `<li>${inline(f)}</li>`).join('')}</ol>` : '';
    return `<figure class="plan" role="img" aria-label="${esc((d.title ? d.title + ': ' : '') + label)}"><div class="plan-head"><span>Plano${tag ? ' · ' + esc(tag) : ''}</span><span>${esc(d.title || '')}</span></div>${layers}${flow}</figure>`;
  }
  const callout = (c) => (c && c.text ? `<div class="callout ${esc(c.type)}"><span class="mono-label">${esc(CALLOUT_LABEL[c.type] || 'Nota')}</span><div class="prose">${md(c.text)}</div></div>` : '');

  // ---------- spaced review ----------
  const doneIds = () => outline().filter((u) => isDone(u.id) && isReady(u.id)).map((u) => u.id);
  async function refreshReview() {
    const units = await loadUnits(doneIds());
    const q = C.reviewQueue(units, S.progress, S.cards);
    S.reviewInfo = { due: q.total, doneToday: S.reviewLog[C.todayKey()] || 0 };
    renderIfHome();
    return q;
  }
  async function startReview() {
    ttsStop();
    const q = await refreshReview();
    if (!q.items.length) { toast('No te toca repasar nada ahora mismo'); return; }
    S.rev = { items: q.items, i: 0, shown: false, chosen: null, results: [], before: streakNow() };
    S.view = { name: 'review' };
    render();
    window.scrollTo(0, 0);
  }
  function gradeLabelDays(card, g) {
    const due = C.gradeCard(S.cards[card.id], g).due;
    const days = Math.round((new Date(due + 'T12:00:00Z') - new Date(C.todayKey() + 'T12:00:00Z')) / 86400000);
    return days === 1 ? 'mañana' : `en ${days} días`;
  }
  function gradeCurrent(g) {
    const r = S.rev;
    const card = r.items[r.i];
    S.cards[card.id] = C.gradeCard(S.cards[card.id], g);
    const today = C.todayKey();
    S.reviewLog[today] = (S.reviewLog[today] || 0) + 1;
    persist('cards');
    persist('reviewLog');
    r.results.push(g);
    r.i++;
    if (r.i >= r.items.length) r.celebrate = celebrationFor(r.before);
    r.shown = false;
    r.chosen = null;
    render();
    window.scrollTo(0, 0);
  }
  function reviewPage() {
    const r = S.rev;
    const n = r.items.length;
    const top = `<button class="back" data-act="home">${ICON.back}La ruta</button>`;
    if (r.i >= n) {
      const again = r.results.filter((x) => x === 'again').length;
      return top + `<section class="card rev-end"><h1>Repaso hecho</h1><p class="lead">${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}` +
        (again ? ` · ${again} ${again === 1 ? 'vuelve' : 'vuelven'} mañana para afianzar` : ' · todo en su sitio') + '.</p>' +
        '<p class="muted">Cada tarjeta vuelve cuando está a punto de olvidarse: primero al día siguiente, luego a los 3, 7, 16… días.</p>' + celebrateBox(r.celebrate) +
        '<div class="row-actions"><button class="btn" data-act="home">Volver a la ruta</button></div></section>';
    }
    const card = r.items[r.i];
    let front = `<div class="flash-meta"><span class="mono-label">${CARD_LABEL[card.type]}</span><button class="link small-link" data-open-from="${esc(card.unitId)}">${esc(unitTitle(card.unitId))}</button></div>`;
    front += card.type === 'term' ? `<p class="flash-term">${esc(card.front)}</p><p class="muted">¿Qué significa? Piénsalo y mira la respuesta.</p>` : `<p class="flash-q">${inline(card.front)}</p>`;
    let body = '';
    let actions = '';
    const grades = (opts) => '<div class="grade-btns">' + opts.map((g) => `<button data-act="rev-grade" data-g="${g}" class="g-${g}">${{ again: 'Otra vez', good: 'Bien', easy: 'Fácil' }[g]}<small>${gradeLabelDays(card, g)}</small></button>`).join('') + '</div>';
    if (card.type === 'mcq') {
      const answered = Number.isInteger(r.chosen);
      body = card.options.map((o, k) => {
        let cls = 'opt';
        if (answered && k === card.answer) cls += ' right';
        else if (answered && k === r.chosen) cls += ' wrong';
        return `<button class="${cls}" data-act="rev-choose" data-k="${k}" ${answered ? 'disabled' : ''}><span class="k">${'ABCD'[k]}</span><span>${inline(o)}</span></button>`;
      }).join('');
      if (answered) {
        const ok = r.chosen === card.answer;
        body += `<div class="explain prose">${ok ? '<p><strong>Eso es.</strong></p>' : '<p><strong>Casi.</strong> La buena es la marcada en verde.</p>'}${md(card.back)}</div>`;
        actions = ok ? grades(['good', 'easy']) : grades(['again']);
      }
    } else if (!r.shown) {
      actions = '<div class="row-actions"><button class="btn" data-act="rev-show">Mostrar respuesta</button></div>';
    } else {
      body = `<div class="flash-back prose">${md(card.back)}</div>`;
      actions = grades(['again', 'good', 'easy']);
    }
    return top + `<header class="unit-head"><div class="unit-tag"><span class="badge lesson">Repaso</span><span class="badge">${r.i + 1} / ${n}</span></div><h1>Repaso</h1></header>` +
      `<div class="meter rev-meter" aria-hidden="true"><span style="width:${(r.i / n) * 100}%"></span></div>` +
      `<section class="card flash">${front}${body ? `<div class="flash-body">${body}</div>` : ''}${actions}</section>`;
  }

  // ---------- listening (speech synthesis) ----------
  const TTS = { state: 'idle', queue: [], i: 0, rate: 1, current: null };
  const ttsSupported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function splitChunks(text) {
    const out = [];
    for (const para of String(text).split(/\n+/)) {
      const p = para.trim();
      if (!p) continue;
      if (p.length <= 260) { out.push(p); continue; }
      let buf = '';
      for (const sentence of p.match(/[^.!?;:]+[.!?;:]*\s*/g) || [p]) {
        if ((buf + sentence).length > 260 && buf) { out.push(buf.trim()); buf = ''; }
        buf += sentence;
      }
      if (buf.trim()) out.push(buf.trim());
    }
    return out;
  }
  function ttsChunks(u) {
    const parts = [u.title];
    if (u.kind === 'lesson') {
      parts.push(plain(u.hook));
      for (const s of u.sections) {
        parts.push(s.heading + '.', plain(s.body));
        if (s.callout?.text) parts.push(`${CALLOUT_LABEL[s.callout.type] || 'Nota'}: ${plain(s.callout.text)}`);
      }
      parts.push('Lo que te llevas.', ...u.keyIdeas.map(plain));
    } else {
      const st = problemState(u);
      parts.push('El encargo. ' + plain(u.story));
      u.steps.forEach((s, i) => {
        if (i > st.at && !st.all) return;
        parts.push(`Paso ${i + 1}. ${s.title}.`, 'Piénsalo antes de seguir. ' + plain(s.think));
        if (st.seen.has(s.id) || st.all) parts.push(plain(s.body));
      });
      if (st.at >= u.steps.length || st.all) parts.push('El plano completo.', ...u.final.summary.map(plain));
    }
    return parts.flatMap(splitChunks);
  }
  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang === 'es-ES') || voices.find((v) => (v.lang || '').toLowerCase().startsWith('es')) || null;
  }
  function ttsSpeak() {
    if (TTS.i >= TTS.queue.length) { ttsStop(); return; }
    const ut = new SpeechSynthesisUtterance(TTS.queue[TTS.i]);
    ut.lang = 'es-ES';
    const v = pickVoice();
    if (v) ut.voice = v;
    ut.rate = TTS.rate;
    const next = () => { if (TTS.state === 'playing' && TTS.current === ut) { TTS.i++; ttsSpeak(); } };
    ut.onend = next;
    ut.onerror = (e) => { if (!['interrupted', 'canceled'].includes(e.error)) next(); };
    TTS.current = ut;
    window.speechSynthesis.speak(ut);
    updateTts();
  }
  function ttsPlay(u) {
    window.speechSynthesis.cancel();
    TTS.queue = ttsChunks(u);
    TTS.i = 0;
    TTS.state = 'playing';
    ttsSpeak();
  }
  function ttsPause() { TTS.state = 'paused'; TTS.current = null; window.speechSynthesis.cancel(); updateTts(); }
  function ttsResume() { TTS.state = 'playing'; window.speechSynthesis.cancel(); ttsSpeak(); }
  function ttsStop() {
    if (TTS.state === 'idle') return;
    TTS.state = 'idle';
    TTS.current = null;
    TTS.i = 0;
    if (ttsSupported()) window.speechSynthesis.cancel();
    updateTts();
  }
  function ttsRate() {
    TTS.rate = TTS_RATES[(TTS_RATES.indexOf(TTS.rate) + 1) % TTS_RATES.length];
    if (TTS.state === 'playing') ttsResume();
    else updateTts();
  }
  const rateLabel = () => `${String(TTS.rate).replace('.', ',')}×`;
  function ttsBar() {
    if (!ttsSupported()) return '';
    if (TTS.state === 'idle') return `<button class="btn alt small" data-act="tts-play">${ICON.play}Escuchar</button>`;
    const pos = `<span class="tts-pos">${Math.min(TTS.i + 1, TTS.queue.length)} / ${TTS.queue.length}</span>`;
    return (TTS.state === 'playing'
      ? `<button class="btn small" data-act="tts-pause">${ICON.pause}Pausa</button>`
      : `<button class="btn small" data-act="tts-resume">${ICON.play}Seguir</button>`) +
      `<button class="btn alt small" data-act="tts-stop" aria-label="Parar">${ICON.stop}</button><button class="btn alt small" data-act="tts-rate" aria-label="Velocidad de lectura">${rateLabel()}</button>${pos}`;
  }
  function updateTts() {
    const el = document.getElementById('tts');
    if (el) el.innerHTML = ttsBar();
  }

  // ---------- interview practice ----------
  function interviewPrompt(u, lang) {
    const topics = (u.considerations || []).map((c) => '- ' + plain(c.q)).join('\n');
    if (lang === 'en') {
      return `I want to practise a system design interview. Act as the interviewer at a tech company. The problem is: "${u.original}".\n\nRules:\n- Start with a short, deliberately vague prompt, as in a real interview, and let me ask the clarifying questions.\n- Ask one question at a time and wait for my answer.\n- Don't give me the solution. If I get stuck, give me a small hint.\n- Push back on trade-offs, bottlenecks and failure modes.\n- Topics that should come up at some point (they are in Spanish; ask about them in English):\n${topics}\n\nWhen I write "end" (or after about 35 minutes of conversation), give me feedback: what I did well, what was missing, how an interviewer would rate it (hire / lean hire / no hire) and 3 concrete things to improve. Keep the conversation in English.`;
    }
    return `Quiero practicar una entrevista de system design. Haz de entrevistador o entrevistadora en una empresa tecnológica. El problema es: «${u.original}» (${u.title}).\n\nReglas:\n- Empieza con un enunciado corto y ambiguo, como en una entrevista real, y deja que yo haga las preguntas para aclarar los requisitos.\n- Hazme una pregunta cada vez y espera mi respuesta.\n- No me des la solución. Si me atasco, dame una pista pequeña.\n- Repregunta por los trade-offs, los cuellos de botella y los fallos.\n- Temas que deberían salir en algún momento:\n${topics}\n\nCuando escriba «fin» (o tras unos 35 minutos de conversación), dame feedback: qué hice bien, qué faltó, cómo lo valoraría un entrevistador (contratar / dudoso / no contratar) y 3 cosas concretas para mejorar. Habla en español, con los términos técnicos en inglés.`;
  }
  function interviewCard() {
    return '<section class="card"><div class="sec-head"><h2>Simulacro de entrevista</h2><span class="muted">Claude hace de entrevistador</span></div>' +
      '<p>Resuélvelo hablando, como en una entrevista de verdad: Claude te da el enunciado, te repregunta y al final te da feedback. Puedes hacerlo antes de leer los pasos o después, para afianzar.</p>' +
      `<div class="row-actions"><button class="btn" data-act="interview" data-lang="es">${ICON.mic}Practicar en español</button><button class="btn alt" data-act="interview" data-lang="en">Practice in English</button></div></section>`;
  }

  // ---------- glossary and search ----------
  async function openSearch() {
    ttsStop();
    S.view = { name: 'search' };
    render();
    window.scrollTo(0, 0);
    if (!S.search.ready) {
      const units = await loadUnits([...S.ready]);
      const terms = [];
      const docs = [];
      for (const u of units) {
        if (u.kind === 'lesson') for (const g of u.glossary || []) terms.push({ term: g.term, def: g.def, unitId: u.id, key: fold(`${g.term} ${plain(g.def)}`) });
        const text = u.kind === 'lesson'
          ? [u.hook, ...u.sections.map((s) => `${s.heading}. ${s.body} ${s.callout?.text || ''}`), ...(u.glossary || []).map((g) => `${g.term}: ${g.def}`), ...u.keyIdeas].join('\n')
          : [u.original, u.story, ...u.steps.map((s) => `${s.title}. ${s.think} ${s.body}`), ...u.considerations.map((c) => `${c.q} ${c.a}`), ...u.final.summary].join('\n');
        const flat = plain(text).replace(/\s+/g, ' ');
        docs.push({ id: u.id, title: u.title, text: flat, key: fold(flat), titleKey: fold(u.title) });
      }
      terms.sort((a, b) => a.term.localeCompare(b.term, 'es', { sensitivity: 'base' }));
      docs.sort((a, b) => (meta(a.id)?.order || 0) - (meta(b.id)?.order || 0));
      S.search = { ...S.search, ready: true, terms, docs };
      if (S.view.name === 'search') renderSearchResults();
    }
    document.getElementById('search-in')?.focus({ preventScroll: true });
  }
  // Escapes `text` and wraps each occurrence of the (folded) words in <mark>.
  function highlight(text, words) {
    const ws = words.filter((w) => w.length >= 2);
    if (!ws.length) return esc(text);
    const key = fold(text);
    const marks = new Array(text.length).fill(false);
    for (const w of ws) {
      let i = key.indexOf(w);
      while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = key.indexOf(w, i + w.length); }
    }
    let out = '';
    let open = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; }
      if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += esc(text[i]);
    }
    return out + (open ? '</mark>' : '');
  }
  function searchResults() {
    if (!S.search.ready) return '<div class="card" aria-busy="true"><div class="sk h"></div><div class="sk" style="margin-top:10px"></div><p class="muted" style="margin-top:12px">Preparando el índice…</p></div>';
    const q = fold(S.search.q.trim());
    const words = q.split(/\s+/).filter(Boolean);
    const terms = words.length ? S.search.terms.filter((t) => words.every((w) => t.key.includes(w))) : S.search.terms;
    const termsHtml = terms.length
      ? `<dl class="gloss gloss-all">${terms.map((t) => `<dt>${highlight(t.term, words)}</dt><dd>${inline(t.def)} <button class="link small-link" data-open-from="${esc(t.unitId)}">${esc(unitTitle(t.unitId))}</button></dd>`).join('')}</dl>`
      : '<p class="muted">Ningún término coincide.</p>';
    let docsHtml = '';
    if (q.length >= 2) {
      const hits = S.search.docs
        .map((d) => ({ d, score: words.every((w) => d.key.includes(w)) ? (words.every((w) => d.titleKey.includes(w)) ? 2 : 1) : 0 }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      docsHtml = `<section class="card"><div class="sec-head"><h2>En las unidades</h2><span class="muted">${hits.length}${hits.length === 20 ? '+' : ''}</span></div>` +
        (hits.length
          ? '<ul class="hits">' + hits.map(({ d }) => {
            const i = Math.max(0, d.key.indexOf(words[0]));
            const start = Math.max(0, i - 70);
            const end = Math.min(d.text.length, i + 130);
            const snippet = (start > 0 ? '…' : '') + d.text.slice(start, end) + (end < d.text.length ? '…' : '');
            const m = meta(d.id);
            return `<li><button data-open-from="${esc(d.id)}"><span class="kind ${m?.kind}">${kindLabel(m?.kind)}</span><b>${highlight(d.title, words)}</b><span class="snip">${highlight(snippet, words)}</span></button></li>`;
          }).join('') + '</ul>'
          : '<p class="muted">No aparece en ninguna unidad.</p>') + '</section>';
    }
    return docsHtml + `<section class="card"><div class="sec-head"><h2>Glosario</h2><span class="muted">${terms.length} ${terms.length === 1 ? 'término' : 'términos'}</span></div>${termsHtml}</section>`;
  }
  function renderSearchResults() {
    const el = document.getElementById('search-results');
    if (el) el.innerHTML = searchResults();
  }
  function searchPage() {
    return `<button class="back" data-act="home">${ICON.back}La ruta</button><header class="unit-head"><h1>Glosario y búsqueda</h1><p class="orig">Todos los términos de las lecciones y todo el contenido de la ruta, sin importar las tildes.</p></header>` +
      `<div class="search-box">${ICON.search}<label class="sr" for="search-in">Buscar</label><input id="search-in" data-fk="search" type="search" placeholder="Por ejemplo: sharding, cola, quorum…" value="${esc(S.search.q)}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>` +
      `<div id="search-results">${searchResults()}</div>`;
  }

  // ---------- progress: streak, calendar and achievements ----------
  const badgeList = () => C.badges(S.path, S.progress, S.reviewLog);
  // Logros nuevos desde la última vez: se celebran una sola vez.
  function checkBadges() {
    if (!Array.isArray(S.seenBadges)) return [];
    const seen = new Set(S.seenBadges);
    const fresh = badgeList().filter((b) => b.done && !seen.has(b.id));
    if (fresh.length) { S.seenBadges = [...seen, ...fresh.map((b) => b.id)]; persist('seenBadges'); }
    return fresh;
  }
  // Los logros que ya hay cuentan como vistos (al estrenar esta versión o al restaurar una copia).
  function quietBadges() {
    S.seenBadges = badgeList().filter((b) => b.done).map((b) => b.id);
    persist('seenBadges');
  }
  function toastBadges(list) {
    if (list.length) toast(list.length === 1 ? `Nuevo logro: ${list[0].title}` : `${list.length} logros nuevos`);
  }
  // Lo que se celebra al terminar algo: el día que suma a la racha y los logros nuevos.
  function celebrationFor(before) {
    const after = streakNow();
    const today = C.todayKey();
    const streak = before && !before.todayDone && after.todayDone
      ? { current: after.current, best: after.best, record: after.best > before.best && after.activeCount > after.current, earned: after.restEarned.includes(today) }
      : null;
    return { streak, badges: checkBadges() };
  }
  function celebrateBox(c) {
    if (!c || (!c.streak && !c.badges.length)) return '';
    let h = '';
    if (c.streak) {
      const s = c.streak;
      const title = s.current === 1 ? 'Empiezas tu racha' : `${s.current} días seguidos`;
      const sub = s.earned ? `Has ganado un día de descanso: si un día no puedes, tu racha aguanta.`
        : s.record ? '¡Nuevo récord!'
        : s.current === 1 ? 'Hoy ya cuenta. Mañana, otra unidad o el repaso, y ya son dos.'
        : 'Hoy ya cuenta para tu racha.';
      h += `<div class="cel-row"><span class="cel-ico">${ICON.flame}</span><div><b>${title}</b><span>${sub}</span></div></div>`;
    }
    for (const b of c.badges) h += `<div class="cel-row"><span class="cel-ico medal">${ICON.medal}</span><div><b>Nuevo logro: ${esc(b.title)}</b><span>${esc(b.desc)}</span></div></div>`;
    return `<div class="celebrate" role="status">${h}<button class="link small-link" data-act="progress">Ver tu progreso${ICON.chev}</button></div>`;
  }

  function weekStrip(today, act, st) {
    const rest = new Set(st.restDays);
    const start = C.addDays(today, -weekday(today));
    let out = '';
    for (let i = 0; i < 7; i++) {
      const k = C.addDays(start, i);
      let cls = 'wk-day';
      let mark = '';
      let what;
      if (k > today) { cls += ' future'; what = 'aún no ha llegado'; }
      else if (act[k]) { cls += ' on'; mark = ICON.check; what = 'aprendiste algo'; }
      else if (rest.has(k)) { cls += ' rest'; mark = ICON.rest; what = 'día de descanso'; }
      else what = k === today ? 'todavía nada' : 'sin actividad';
      if (k === today) cls += ' today';
      out += `<li class="${cls}" aria-label="${esc(cap(fmtDay.format(dayDate(k))))}: ${what}"><span class="wk-l" aria-hidden="true">${'LMXJVSD'[i]}</span><span class="wk-dot" aria-hidden="true">${mark}</span></li>`;
    }
    return `<ol class="week">${out}</ol>`;
  }

  function streakHomeCard() {
    if (!outline().length) return '';
    const st = streakNow();
    const today = C.todayKey();
    const title = st.current ? plural(st.current, 'día seguido', 'días seguidos') : 'Tu racha';
    const parts = [];
    if (!st.activeCount) parts.push('Empieza con tu primera unidad: cada día que aprendas, suma');
    else if (st.todayDone) parts.push('Hoy ya cuenta');
    else if (st.current) parts.push('Hoy aún no cuenta: termina una unidad o haz el repaso');
    else parts.push('Empieza hoy una racha nueva: una unidad o el repaso');
    if (st.best > st.current) parts.push(`récord: ${plural(st.best, 'día', 'días')}`);
    if (st.rest) parts.push(plural(st.rest, 'descanso guardado', 'descansos guardados'));
    const sub = parts.join(' · ');
    return `<section class="card streak-card-home" data-act="progress"><button class="streak-home" data-act="progress"><span class="st-row"><span class="st-ico ${st.current ? '' : 'off'}">${ICON.flame}</span><span class="st-txt"><b>${title}</b><span class="muted">${sub}</span></span><span class="st-chev">${ICON.chev}</span></span><span class="sr">Ver tu progreso</span></button>${weekStrip(today, actDays(), st)}</section>`;
  }

  function openProgress(from) {
    ttsStop();
    const today = C.todayKey();
    if (!S.cal) S.cal = { month: today.slice(0, 7), day: today };
    S.view = { name: 'progress', from: from || null };
    render();
    window.scrollTo(0, 0);
  }
  const monthAdd = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const level = (min) => (!min ? 0 : min < 15 ? 1 : min < 30 ? 2 : min < 45 ? 3 : 4);
  function daySummary(a) {
    const parts = [];
    if (a.units.length) parts.push(plural(a.units.length, 'unidad', 'unidades'));
    if (a.cards) parts.push(plural(a.cards, 'tarjeta repasada', 'tarjetas repasadas'));
    parts.push(`unos ${fmtMins(a.minutes)}`);
    return parts.join(', ');
  }

  function streakSection(st) {
    const slots = Array.from({ length: C.REST_MAX }, (_, i) => `<span class="rest-slot ${i < st.rest ? 'full' : ''}">${ICON.rest}</span>`).join('');
    const toNext = C.REST_EVERY - (st.current % C.REST_EVERY);
    let status;
    if (!st.activeCount) status = '<p class="muted">Tu racha empieza el día que termines tu primera unidad.</p>';
    else if (st.todayDone) status = `<p class="status-line ok">${ICON.check}Hoy ya cuenta</p>`;
    else if (st.current) status = '<p class="muted">Hoy aún no cuenta: termina una unidad o haz el repaso y sigue sumando.</p>';
    else status = '<p class="muted">Hoy puedes empezar una racha nueva.</p>';
    const restTitle = st.rest ? plural(st.rest, 'día de descanso guardado', 'días de descanso guardados') : 'Días de descanso';
    const restNext = st.rest < C.REST_MAX && st.current ? ` El próximo, en ${plural(toNext, 'día', 'días')} de racha.` : '';
    return `<section class="card streak-card" aria-labelledby="sc-h"><h2 id="sc-h" class="sr">Racha</h2>` +
      `<div class="sc-main"><span class="sc-flame ${st.current ? '' : 'off'}">${ICON.flame}</span><div><div class="sc-num">${st.current}</div><div class="sc-lbl">${st.current === 1 ? 'día seguido' : 'días seguidos'}</div></div>` +
      `<dl class="sc-side"><div><dt>Récord</dt><dd>${plural(st.best, 'día', 'días')}</dd></div><div><dt>Días aprendiendo</dt><dd>${st.activeCount}</dd></div></dl></div>` +
      status +
      `<div class="rest-box"><div class="rest-slots" aria-hidden="true">${slots}</div><div><b>${restTitle}</b><span class="muted">Cuenta cada día que terminas una unidad o haces el repaso. Cada ${C.REST_EVERY} días seguidos ganas un día de descanso (máximo ${C.REST_MAX}): si un día no puedes, se usa solo y tu racha sigue.${restNext}</span></div></div></section>`;
  }

  function weekSection(st, act, today) {
    const start = C.addDays(today, -weekday(today));
    let days = 0;
    let units = 0;
    let cards = 0;
    let mins = 0;
    for (let i = 0; i < 7; i++) {
      const a = act[C.addDays(start, i)];
      if (!a) continue;
      days++; units += a.units.length; cards += a.cards; mins += a.minutes;
    }
    const parts = days ? [plural(days, 'día', 'días'), plural(units, 'unidad', 'unidades')].concat(cards ? [plural(cards, 'tarjeta', 'tarjetas')] : [], [`unos ${fmtMins(mins)}`]).join(' · ') : 'Aún nada esta semana';
    return `<section class="card" aria-labelledby="wk-h"><div class="sec-head"><h2 id="wk-h">Esta semana</h2><span class="muted">${parts}</span></div>${weekStrip(today, act, st)}</section>`;
  }

  function calendarSection(st, act, today) {
    const keys = Object.keys(act).sort();
    const minMonth = (keys[0] || today).slice(0, 7);
    const maxMonth = today.slice(0, 7);
    let month = S.cal.month;
    if (month < minMonth) month = minMonth;
    if (month > maxMonth) month = maxMonth;
    S.cal.month = month;
    const rest = new Set(st.restDays);
    const [y, mo] = month.split('-').map(Number);
    const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    let cells = '<span aria-hidden="true"></span>'.repeat(weekday(month + '-01'));
    for (let d = 1; d <= n; d++) {
      const k = `${month}-${String(d).padStart(2, '0')}`;
      const a = act[k];
      const isRest = !a && rest.has(k);
      const cls = ['cal-cell', `lv-${level(a?.minutes)}`];
      if (k === today) cls.push('today');
      const what = a ? daySummary(a) : isRest ? 'día de descanso' : k > today ? '' : 'sin actividad';
      const label = `${cap(fmtDay.format(dayDate(k)))}${k === today ? ' (hoy)' : ''}${what ? ': ' + what : ''}`;
      cells += `<button class="${cls.join(' ')}" data-act="cal-day" data-day="${k}" aria-label="${esc(label)}" aria-pressed="${S.cal.day === k}" ${k > today ? 'disabled' : ''}>${d}${isRest ? `<span class="cal-rest">${ICON.rest}</span>` : ''}</button>`;
    }
    const legend = '<div class="cal-legend"><span class="ramp">Menos <span class="sw"></span><span class="sw lv-1"></span><span class="sw lv-2"></span><span class="sw lv-3"></span><span class="sw lv-4"></span> Más</span>' +
      `<span class="lg">${ICON.rest}Descanso</span><span class="lg">Color: minutos aprendiendo</span></div>`;
    return `<section class="card" aria-labelledby="cal-h"><div class="cal-nav"><button class="icon-btn" data-act="cal-prev" aria-label="Mes anterior" ${month <= minMonth ? 'disabled' : ''}>${ICON.back}</button>` +
      `<h2 id="cal-h">${cap(fmtMonth.format(dayDate(month + '-15')))}</h2><button class="icon-btn" data-act="cal-next" aria-label="Mes siguiente" ${month >= maxMonth ? 'disabled' : ''}>${ICON.chev}</button></div>` +
      `<div class="cal-head" aria-hidden="true">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div>${legend}${dayDetail(S.cal.day, act, rest, today)}</section>`;
  }

  function dayDetail(k, act, rest, today) {
    if (!k || k > today) return '';
    const a = act[k];
    const head = `<h3>${k === today ? 'Hoy · ' : ''}${cap(fmtDay.format(dayDate(k)))}</h3>`;
    let body;
    if (a) {
      const items = a.units.map((id) => {
        const m = meta(id);
        return `<li><button data-open-from="${esc(id)}"><span class="kind ${m?.kind || 'lesson'}">${kindLabel(m?.kind)}</span><b>${esc(unitTitle(id))}</b></button></li>`;
      });
      if (a.cards) items.push(`<li class="day-rev">${ICON.cards}Repaso: ${plural(a.cards, 'tarjeta', 'tarjetas')}</li>`);
      body = `<ul class="day-list">${items.join('')}</ul><p class="muted">Unos ${fmtMins(a.minutes)} aprendiendo.</p>`;
    } else if (rest.has(k)) body = '<p class="muted">Día de descanso: no hiciste nada y tu racha siguió.</p>';
    else if (k === today) body = '<p class="muted">Todavía nada. Una unidad o el repaso, y el día cuenta.</p>';
    else body = '<p class="muted">Sin actividad este día.</p>';
    return `<div class="cal-detail" aria-live="polite">${head}${body}</div>`;
  }

  function totalsSection(st, act) {
    const list = outline();
    const done = list.filter((u) => isDone(u.id));
    const lessons = list.filter((u) => u.kind === 'lesson');
    const problems = list.filter((u) => u.kind !== 'lesson');
    const doneL = done.filter((u) => u.kind === 'lesson').length;
    const mins = Object.values(act).reduce((sum, a) => sum + a.minutes, 0);
    const cards = Object.values(S.reviewLog).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
    const left = list.filter((u) => !isDone(u.id));
    const leftMins = left.reduce((sum, u) => sum + (u.minutes || 10), 0);
    let pace = 'Unas dos unidades al día, a tu ritmo.';
    if (done.length >= 3 && st.activeCount) {
      const perDay = done.length / st.activeCount;
      pace = left.length ? `A tu ritmo, unos ${plural(Math.ceil(left.length / perDay), 'día', 'días')} de estudio más.` : 'Ruta terminada.';
    }
    const tile = (big, label, sub, meter) => `<div class="tile"><span class="mono-label">${label}</span><span class="big">${big}</span>${sub ? `<span class="muted">${sub}</span>` : ''}${meter != null ? `<div class="meter" aria-hidden="true"><span style="width:${meter}%"></span></div>` : ''}</div>`;
    return `<section class="card" aria-labelledby="tot-h"><div class="sec-head"><h2 id="tot-h">En total</h2></div><div class="tiles">` +
      tile(`${done.length} / ${list.length}`, 'Unidades', `${doneL} de ${lessons.length} lecciones · ${done.length - doneL} de ${problems.length} problemas`, list.length ? (done.length / list.length) * 100 : 0) +
      tile(mins ? `≈ ${fmtMins(mins)}` : '0 min', 'Aprendiendo', 'Según lo que dura cada unidad y cada tarjeta.') +
      tile(String(cards), 'Tarjetas repasadas', cards ? 'Cada una vuelve justo antes de olvidarse.' : 'Salen de las unidades que terminas.') +
      tile(left.length ? `≈ ${fmtMins(leftMins)}` : '¡Hecho!', 'Te queda', pace) +
      '</div></section>';
  }

  function badgesSection() {
    const all = badgeList();
    const got = all.filter((b) => b.done).length;
    const groups = [['streak', 'Constancia', ICON.flame], ['route', 'La ruta', ICON.route], ['review', 'Repaso', ICON.cards], ['module', 'Módulos', null]];
    const html = groups.map(([g, label, icon]) => {
      const items = all.filter((b) => b.group === g);
      if (!items.length) return '';
      const tiles = items.map((b) => {
        const title = b.group === 'module' ? b.name : b.title;
        const status = b.done ? `Conseguido el ${fmtShort.format(dayDate(b.on))}` : b.target > 1 ? `${b.value} / ${b.target}` : esc(b.desc);
        const meter = !b.done && b.target > 1 ? `<div class="meter" aria-hidden="true"><span style="width:${(b.value / b.target) * 100}%"></span></div>` : '';
        return `<li class="bdg ${b.done ? 'on' : ''}" aria-label="${esc(b.title)}: ${b.done ? 'conseguido' : esc(b.desc) + (b.target > 1 ? `, ${b.value} de ${b.target}` : '')}"><span class="bdg-ico" aria-hidden="true">${icon || esc(b.mark || '')}</span><b aria-hidden="true">${esc(title)}</b><span class="muted" aria-hidden="true">${status}</span>${meter}</li>`;
      }).join('');
      return `<div class="bdg-group"><h3>${label}</h3><ul class="bdg-grid">${tiles}</ul></div>`;
    }).join('');
    return `<section class="card" aria-labelledby="bdg-h"><div class="sec-head"><h2 id="bdg-h">Logros</h2><span class="muted">${got} de ${all.length}</span></div>${html}</section>`;
  }

  function progressPage() {
    const today = C.todayKey();
    const st = streakNow();
    const act = actDays();
    const from = S.view.from;
    const back = from === '@review' ? 'Volver al repaso' : from === '@search' ? 'Volver a la búsqueda' : from && content(from) ? `Volver a «${esc(unitTitle(from))}»` : 'La ruta';
    return `<div class="topbar"><button class="back" data-act="back">${ICON.back}${back}</button></div>` +
      '<header class="unit-head"><h1>Tu progreso</h1><p class="orig">Lo que has ido aprendiendo, día a día. Todo se guarda en este iPhone.</p></header>' +
      streakSection(st) + weekSection(st, act, today) + calendarSection(st, act, today) + totalsSection(st, act) + badgesSection();
  }

  // ---------- home ----------
  function header() {
    const total = outline().length;
    const done = outline().filter((u) => isDone(u.id)).length;
    const st = C.streak(S.progress, C.todayKey(), activeDays());
    return `<header class="top"><div class="brand">${ICON.mark}<div><b>Planos</b><span>System design, paso a paso</span></div></div>` +
      `<div class="stats"><button class="pill pill-btn" data-act="progress" aria-label="Tu progreso: ${plural(st, 'día seguido', 'días seguidos')}"><span class="flame-ico">${ICON.flame}</span>${plural(st, 'día', 'días')}</button><button class="pill pill-btn" data-act="progress" aria-label="Tu progreso: ${done} de ${total} unidades">${ICON.route}${done} / ${total}</button>` +
      `<button class="pill pill-btn" data-act="search" aria-label="Glosario y búsqueda">${ICON.search}Buscar</button></div></header>`;
  }

  function setupCard() {
    if (!isStandalone()) {
      if (!isIOS()) return '';
      return `<section class="card setup" aria-labelledby="install-h"><h2 id="install-h">Instálala en tu iPhone</h2>` +
        '<ol class="steps-ol">' +
        `<li>Pulsa <b>Compartir</b> ${ICON.share} en la barra de Safari.</li>` +
        '<li>Elige <b>«Añadir a pantalla de inicio»</b> y pulsa <b>Añadir</b>.</li>' +
        '<li>Abre <b>Planos</b> desde el icono nuevo. Desde ahí activas el aviso de cada mañana.</li>' +
        '</ol><p class="muted">Usa siempre la app del icono: tu progreso se guarda en ella, no en Safari.</p></section>';
    }
    const p = S.push;
    if (!p.supported) {
      return `<section class="card setup"><p class="status-line warn">${ICON.warn}Los avisos necesitan iOS 16.4 o posterior.</p><p class="muted">La app funciona igual; solo no podrá avisarte.</p></section>`;
    }
    if (p.permission === 'denied') {
      return `<section class="card setup"><p class="status-line warn">${ICON.warn}Los avisos están bloqueados</p><p class="muted">Actívalos en <b>Ajustes → Notificaciones → Planos</b> y vuelve a abrir la app.</p></section>`;
    }
    if (!p.subscribed) {
      return `<section class="card setup" aria-labelledby="push-h"><h2 id="push-h">Activa el aviso de cada mañana</h2>` +
        `<p>Cada día a las ${REMINDER_TIME} te llega un aviso con lo que te toca, calculado con tu progreso.</p>` +
        `<div class="row-actions"><button class="btn" data-act="push-on" ${p.busy ? 'disabled' : ''}>${ICON.bell.replace('<svg', '<svg width="18" height="18"')}${p.busy ? 'Activando…' : 'Activar avisos'}</button></div></section>`;
    }
    if (!p.sent) {
      return `<section class="card setup" aria-labelledby="code-h"><h2 id="code-h">Último paso: manda este código a Claude</h2>` +
        `<p>Pégalo en tu conversación con Claude. Lo usará para enviarte el aviso de las ${REMINDER_TIME}; solo sirve para mandar avisos a este iPhone.</p>` +
        `<div class="code-box">${esc(p.code)}</div>` +
        '<div class="row-actions"><button class="btn" data-act="copy-code">Copiar código</button><button class="link" data-act="code-sent">Ya se lo he mandado</button></div></section>';
    }
    return '';
  }

  function planItem(u, i) {
    const done = isDone(u.id);
    const ready = isReady(u.id);
    return `<li><button class="plan-item ${done ? 'done' : ''}" data-open="${esc(u.id)}" ${ready ? '' : 'disabled'}>` +
      `<span class="num">${done ? ICON.check : String(i + 1).padStart(2, '0')}</span>` +
      `<span class="t"><span class="kind ${u.kind}">${kindLabel(u.kind)}${u.kind === 'problem' && u.difficulty ? ' · ' + esc(u.difficulty) : ''}</span><b>${esc(u.title)}</b>${ready ? '' : '<small>Se está preparando</small>'}</span>` +
      `<span class="mins">${u.minutes || 10} min</span></button></li>`;
  }

  function todayCard() {
    const { plan, mins } = todayPlan();
    const pending = plan.filter((u) => !isDone(u.id));
    const next = nextUndone();
    if (!outline().length) return '';
    if (!next) {
      return '<section class="card today"><h2>Ruta completa</h2><p class="sub">Has terminado todas las unidades. Sigue con el repaso, o vuelve a cualquier problema y haz su simulacro de entrevista.</p></section>';
    }
    let body = `<ol class="plan-list">${plan.map(planItem).join('')}</ol>`;
    let cta = '';
    const first = pending.find((u) => isReady(u.id));
    if (pending.length && first) {
      const started = prog(first.id)?.status === 'started';
      cta = `<div class="row-actions"><button class="btn" data-open="${esc(first.id)}">${started ? 'Continuar' : 'Empezar'}: ${esc(first.title)}</button></div>`;
    } else if (!pending.length) {
      body += `<div class="done-note">${ICON.check}<div><b>Lo de hoy ya está.</b> Mañana sigues con «${esc(next.title)}». Si te apetece, puedes adelantarlo.</div></div>`;
      cta = isReady(next.id) ? `<div class="row-actions"><button class="btn alt" data-open="${esc(next.id)}">Seguir un poco más</button></div>` : '';
    } else {
      body += '<p class="muted">La siguiente unidad todavía se está preparando.</p>';
    }
    const doneCount = plan.length - pending.length;
    const sub = doneCount ? `${doneCount} de ${plan.length} hechas · unos ${mins} min en total` : `Unos ${mins} min · ${plan.length === 1 ? 'una unidad' : plan.length + ' unidades'}`;
    return `<section class="card today" aria-labelledby="today-h"><h2 id="today-h">Hoy</h2><p class="sub">${sub}</p>${body}${cta}</section>`;
  }

  function reviewHomeCard() {
    const r = S.reviewInfo;
    if (!r) return '';
    if (r.due > 0) {
      const n = Math.min(r.due, C.REVIEW_LIMIT);
      return `<section class="card rev-home" aria-labelledby="rev-h"><div class="rev-row"><span class="rev-ico">${ICON.cards}</span><div class="rev-txt"><h2 id="rev-h">Repaso</h2><p class="muted">${n} ${n === 1 ? 'tarjeta' : 'tarjetas'} · unos ${Math.max(2, Math.round(n * 0.35))} min</p></div><button class="btn" data-act="review-start">Repasar</button></div></section>`;
    }
    if (r.doneToday > 0) return `<section class="card rev-home"><p class="status-line ok">${ICON.check}Repaso de hoy hecho · ${r.doneToday} ${r.doneToday === 1 ? 'tarjeta' : 'tarjetas'}</p></section>`;
    return '';
  }

  function markedCard() {
    const items = outline().filter((u) => isDone(u.id) && ['review', 'meh'].includes(prog(u.id)?.feel) && isReady(u.id))
      .sort((a, b) => (prog(a.id).feel === 'review' ? -1 : 0) - (prog(b.id).feel === 'review' ? -1 : 0));
    if (!items.length) return '';
    return `<section class="card"><div class="sec-head"><h2>Marcadas para repasar</h2><span class="muted">${items.length}</span></div><ul class="rev-list">` +
      items.map((u) => `<li><button data-open="${esc(u.id)}"><span class="tag">${prog(u.id).feel === 'review' ? 'Repasar' : 'Más o menos'}</span><span>${esc(u.title)}</span></button></li>`).join('') +
      '</ul></section>';
  }

  function routeCard() {
    const list = outline();
    const next = nextUndone();
    const blocks = modules().map((m, mi) => {
      const units = list.filter((u) => u.module === m.id);
      if (!units.length) return '';
      const done = units.filter((u) => isDone(u.id)).length;
      const open = units.some((u) => u === next) || (mi === 0 && !next);
      const rows = units.map((u) => {
        const ready = isReady(u.id);
        const cls = isDone(u.id) ? 'done' : u === next ? 'next' : '';
        const right = isDone(u.id) ? 'Hecho' : ready ? `${u.minutes || 10} min` : '<span class="soon">En preparación</span>';
        return `<li><button class="unit-row ${cls}" data-open="${esc(u.id)}" ${ready ? '' : 'disabled'}><span class="dot">${isDone(u.id) ? ICON.check : ''}</span><span class="ut"><span class="kind ${u.kind}">${kindLabel(u.kind)}</span>${esc(u.title)}</span><span class="ur">${right}</span></button></li>`;
      }).join('');
      return `<details class="module" ${open ? 'open' : ''}><summary><span class="mnum">M${mi + 1}</span><span class="mtitle">${esc(m.title)}${m.subtitle ? `<small>${esc(m.subtitle)}</small>` : ''}</span><span class="meter" aria-hidden="true"><span style="width:${(done / units.length) * 100}%"></span></span><span class="count">${done}/${units.length}</span></summary><ol class="units">${rows}</ol></details>`;
    }).join('');
    return `<section class="card" aria-labelledby="route-h"><div class="sec-head"><h2 id="route-h">La ruta</h2><span class="muted">${list.length} unidades · ${modules().length} módulos</span></div>${blocks}</section>`;
  }

  function settingsCard() {
    const p = S.push;
    let notif;
    if (!isStandalone()) notif = '<p class="muted">Los avisos se activan desde la app instalada en la pantalla de inicio.</p>';
    else if (!p.supported) notif = '<p class="muted">Este dispositivo no admite avisos web.</p>';
    else if (p.permission === 'denied') notif = `<p class="status-line warn">${ICON.warn}Bloqueados en Ajustes del iPhone</p>`;
    else if (!p.subscribed) notif = '<p class="muted">Desactivados.</p><div class="row-actions"><button class="btn small" data-act="push-on">Activar avisos</button></div>';
    else {
      notif = `<p class="status-line ok">${ICON.check}Activados en este iPhone · ${REMINDER_TIME}</p>` +
        '<div class="row-actions"><button class="btn alt small" data-act="push-test">Probar el aviso</button><button class="btn alt small" data-act="toggle-code">' + (S.settings.showCode ? 'Ocultar código' : 'Código para Claude') + '</button><button class="link" data-act="push-off">Desactivar</button></div>' +
        (S.settings.showCode ? `<div class="code-box">${esc(p.code)}</div><div class="row-actions"><button class="btn small" data-act="copy-code">Copiar código</button></div>` : '');
    }
    const restore = S.settings.restore
      ? `<label class="sr" for="restore-in">Copia de seguridad</label><textarea id="restore-in" data-fk="restore" placeholder="Pega aquí la copia de tu progreso">${esc(S.settings.restoreText)}</textarea>` +
        (S.settings.restoreError ? `<p class="status-line warn">${ICON.warn}${esc(S.settings.restoreError)}</p>` : '') +
        '<p class="muted">Sustituye tu progreso actual por el de la copia.</p><div class="row-actions"><button class="btn small" data-act="restore-apply">Restaurar progreso</button><button class="link" data-act="restore-cancel">Cancelar</button></div>'
      : '<div class="row-actions"><button class="btn alt small" data-act="backup">Copiar mi progreso</button><button class="btn alt small" data-act="restore-open">Restaurar una copia</button></div>';
    return `<section class="card settings" aria-labelledby="settings-h"><h2 id="settings-h">Ajustes</h2>` +
      `<div class="row"><h3>Aviso de cada mañana</h3>${notif}</div>` +
      `<div class="row"><h3>Copia de seguridad</h3><p class="muted">Tu progreso, tus notas y tus tarjetas de repaso viven en este iPhone. Cópialos y guárdalos en Notas de vez en cuando.</p>${restore}</div></section>`;
  }

  function renderHome() {
    if (S.status === 'loading') {
      app.innerHTML = header() + '<section class="card today" aria-busy="true"><h2>Hoy</h2><p class="sub">Cargando tu ruta…</p><div class="sk h" style="margin-top:16px"></div><div class="sk" style="margin-top:10px"></div></section>';
      return;
    }
    if (S.status === 'error') {
      app.innerHTML = header() + '<section class="card empty"><h1>No se ha podido cargar la ruta</h1><p class="muted">Comprueba la conexión y vuelve a abrir la app.</p></section>';
      return;
    }
    app.innerHTML = header() + setupCard() + todayCard() + reviewHomeCard() + streakHomeCard() + markedCard() + routeCard() + settingsCard() + `<p class="foot">Planos · ${esc(S.version)}</p>`;
  }

  // ---------- unit pages ----------
  async function openUnit(id, from) {
    if (!isReady(id)) return;
    ttsStop();
    try { await loadUnit(id); } catch (e) { toast('No se ha podido abrir. Revisa la conexión.'); return; }
    S.view = { name: 'unit', id, from: from || null };
    S.ui = { checks: {}, hints: {}, ask: '' };
    if (!prog(id)) saveProgress(id, { status: 'started' });
    render();
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* not important */ }
  }
  function goHome() {
    ttsStop();
    const from = S.view.from;
    if (from === '@search') { openSearch(); return; }
    if (from === '@progress') { openProgress(null); return; }
    if (from === '@review' && S.rev) { S.view = { name: 'review' }; render(); window.scrollTo(0, 0); return; }
    if (from && content(from)) { S.view = { name: 'unit', id: from, from: null }; S.ui = { checks: {}, hints: {}, ask: '' }; render(); window.scrollTo(0, 0); return; }
    S.view = { name: 'home' };
    S.rev = null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* not important */ }
    if (S.pendingReload) { location.reload(); return; }
    render();
    window.scrollTo(0, 0);
    refreshReview();
    toastBadges(checkBadges());
  }

  function unitHead(u) {
    const m = meta(u.id);
    const mod = modules().find((x) => x.id === (m?.module || u.module));
    const from = S.view.from;
    const back = from === '@search' ? 'Volver a la búsqueda' : from === '@review' ? 'Volver al repaso' : from ? `Volver a «${esc(unitTitle(from))}»` : 'La ruta';
    const badges = [`<span class="badge ${u.kind}">${kindLabel(u.kind)}</span>`];
    if (mod) badges.push(`<span class="badge">${esc(mod.title)}</span>`);
    if (u.kind === 'problem') badges.push(`<span class="badge">${esc(u.difficulty)}</span>`);
    badges.push(`<span class="badge">${u.minutes} min</span>`);
    return `<div class="topbar"><button class="back" data-act="back">${ICON.back}${back}</button><button class="icon-btn" data-act="search" aria-label="Glosario y búsqueda">${ICON.search}</button></div>` +
      `<header class="unit-head"><div class="unit-tag">${badges.join('')}</div><h1>${esc(u.title)}</h1>` +
      (u.kind === 'problem' ? `<p class="orig">${esc(u.original)} · <a href="${esc(u.url)}" target="_blank" rel="noopener">systemdesign.io #${esc(u.n)}</a></p>` : '') +
      (ttsSupported() ? `<div class="tts" id="tts">${ttsBar()}</div>` : '') + '</header>';
  }

  function checksBlock(u) {
    if (!Array.isArray(u.checks) || !u.checks.length) return '';
    const items = u.checks.map((c, i) => {
      const chosen = S.ui.checks[i];
      const answered = Number.isInteger(chosen);
      const opts = c.options.map((o, k) => {
        let cls = 'opt';
        if (answered && k === c.answer) cls += ' right';
        else if (answered && k === chosen) cls += ' wrong';
        return `<button class="${cls}" data-act="check" data-i="${i}" data-k="${k}" ${answered ? 'disabled' : ''}><span class="k">${'ABCD'[k]}</span><span>${inline(o)}</span></button>`;
      }).join('');
      const fb = answered ? `<div class="explain prose">${chosen === c.answer ? '<p><strong>Eso es.</strong></p>' : '<p><strong>Casi.</strong> La buena es la marcada en verde.</p>'}${md(c.explain)}</div>` : '';
      return `<div class="check"><p class="q">${inline(c.q)}</p>${opts}${fb}</div>`;
    }).join('');
    return `<section class="card"><div class="sec-head"><h2>Comprueba que lo tienes</h2><span class="muted">Sin nota: solo para ti</span></div><div class="checks">${items}</div></section>`;
  }

  function feelBlock(u) {
    const p = prog(u.id);
    const pressed = p?.status === 'done' ? p.feel : null;
    const btns = FEEL.map((f) => `<button data-act="feel" data-feel="${f.id}" aria-pressed="${pressed === f.id}">${f.label}</button>`).join('');
    let next = '';
    if (p?.status === 'done') {
      const list = outline();
      const idx = list.findIndex((x) => x.id === u.id);
      const after = list.slice(idx + 1).find((x) => !isDone(x.id)) || nextUndone();
      const { plan } = todayPlan();
      const moreToday = after && plan.includes(after) && !isDone(after.id);
      const cards = C.cardsOf(u).length;
      next = celebrateBox(S.ui.celebrate) + `<div class="next-box"><b>${pressed === 'review' ? 'Hecho. Lo tienes en «Marcadas para repasar».' : 'Hecho.'}</b>` +
        (cards ? `<span class="muted">${cards} ${cards === 1 ? 'tarjeta pasa' : 'tarjetas pasan'} a tu repaso${pressed === 'ok' ? ' dentro de dos días' : ' mañana'}.</span>` : '') +
        (after && isReady(after.id)
          ? `<div class="row-actions"><button class="btn${moreToday ? '' : ' alt'}" data-open="${esc(after.id)}">${moreToday ? 'Siguiente' : 'Adelantar'}: ${esc(after.title)}</button><button class="link" data-act="home">Volver a la ruta</button></div>`
          : '<div class="row-actions"><button class="btn alt" data-act="home">Volver a la ruta</button></div>') + '</div>';
    }
    return `<section class="card feel"><h2>¿Cómo lo llevas?</h2><p class="muted">Lo marcas como hecho y, si quieres, lo dejas para repasar.</p><div class="feel-btns" role="group" aria-label="Cómo lo llevas">${btns}</div>${next}</section>`;
  }

  function askBlock() {
    return '<section class="card ask"><div class="sec-head"><h2>¿Te ha quedado alguna duda?</h2><span class="muted">Se abre Claude con tu pregunta</span></div>' +
      `<label class="sr" for="ask-in">Tu pregunta</label><textarea id="ask-in" data-fk="ask" placeholder="Por ejemplo: ¿por qué aquí una cola y no llamar al servicio directamente?">${esc(S.ui.ask || '')}</textarea>` +
      '<button class="btn small" data-act="ask">Preguntar en Claude</button></section>';
  }

  function lessonPage(u) {
    const used = outline().filter((x) => x.kind === 'problem' && Array.isArray(x.prereqs) && x.prereqs.includes(u.id));
    const sections = u.sections.map((s) => `<section class="section"><h2>${esc(s.heading)}</h2><div class="prose">${md(s.body)}</div>${diagram(s.diagram, u.id)}${callout(s.callout)}</section>`).join('');
    const gloss = Array.isArray(u.glossary) && u.glossary.length
      ? `<section class="card"><div class="sec-head"><h2>Vocabulario</h2><span class="muted">Los términos que oirás en inglés</span></div><dl class="gloss">${u.glossary.map((g) => `<dt>${esc(g.term)}</dt><dd>${inline(g.def)}</dd>`).join('')}</dl></section>` : '';
    const ideas = `<section class="card"><div class="sec-head"><h2>Lo que te llevas</h2></div><ul class="ideas">${u.keyIdeas.map((k) => `<li>${inline(k)}</li>`).join('')}</ul>` +
      (used.length ? `<p class="muted" style="margin-top:12px">Lo usarás en: ${used.map((x) => esc(x.title)).join(' · ')}</p>` : '') + '</section>';
    const res = Array.isArray(u.resources) && u.resources.length
      ? `<section class="card"><div class="sec-head"><h2>Para profundizar</h2><span class="muted">Opcional</span></div><ul class="res">${u.resources.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title || r.url)}</a></li>`).join('')}</ul></section>` : '';
    return unitHead(u) + `<p class="lead">${inline(u.hook)}</p>` + sections + gloss + checksBlock(u) + ideas + res + feelBlock(u) + askBlock();
  }

  function problemState(u) {
    const p = prog(u.id) || {};
    const seen = new Set(Array.isArray(p.seen) ? p.seen : []);
    let at = Number.isInteger(p.at) ? Math.min(p.at, u.steps.length) : 0;
    if (p.status === 'done') at = u.steps.length;
    return { seen, at, all: !!S.ui.all, notes: p.notes || {} };
  }

  function problemPage(u) {
    const st = problemState(u);
    const pre = (u.prereqs || []).filter((id) => meta(id));
    const prereq = pre.length
      ? `<section class="card"><div class="sec-head"><h2>Antes conviene saber</h2><span class="muted">Si alguno no lo tienes claro, ábrelo</span></div><div class="prereqs">${pre.map((id) => `<button class="chip ${isDone(id) ? 'ok' : ''}" data-open-from="${esc(id)}" ${isReady(id) ? '' : 'disabled'}>${isDone(id) ? ICON.check : ''}${esc(unitTitle(id))}</button>`).join('')}</div></section>` : '';
    const steps = u.steps.map((s, i) => {
      const seen = st.seen.has(s.id) || st.all;
      const current = i === st.at && !st.all;
      const open = seen || current || i < st.at;
      const cls = seen ? 'seen' : current ? 'current' : i < st.at ? 'seen' : 'future';
      let body = '';
      if (open) {
        const hintsShown = S.ui.hints[s.id] || 0;
        const hints = (s.hints || []).slice(0, hintsShown).map((h, k) => `<div class="hint"><b>Pista ${k + 1}</b>${inline(h)}</div>`).join('');
        const moreHints = !seen && (s.hints || []).length > hintsShown ? `<button class="btn alt small" data-act="hint" data-step="${esc(s.id)}">Dame una pista</button>` : '';
        const note = st.notes[s.id] || '';
        const think = `<div class="think"><span class="mono-label">Piénsalo antes de seguir</span><div class="prose">${md(s.think)}</div>` +
          (!seen || note ? `<label class="sr" for="n-${esc(s.id)}">Tus notas</label><textarea class="notes" id="n-${esc(s.id)}" data-fk="n-${esc(s.id)}" data-note="${esc(s.id)}" placeholder="Apunta tus ideas (opcional, solo para ti)">${esc(note)}</textarea>` : '') +
          hints + (!seen ? `<div class="row-actions">${moreHints}<button class="btn small" data-act="reveal" data-step="${esc(s.id)}">Ver cómo se hace</button></div>` : '') + '</div>';
        const reveal = seen
          ? `<div class="reveal"><div class="prose">${md(s.body)}</div>${diagram(s.diagram, u.id)}</div>` +
            (i === st.at && !st.all ? `<div class="row-actions"><button class="btn small" data-act="advance">${i === u.steps.length - 1 ? 'Ver el plano completo' : 'Siguiente paso'}</button></div>` : '')
          : '';
        body = `<div class="sb">${think}${reveal}</div>`;
      }
      return `<li class="step ${cls}" id="step-${esc(s.id)}"><span class="sn">${seen ? ICON.check.replace('<svg', '<svg width="16" height="16"') : i + 1}</span><div class="sh"><h3>${esc(s.title)}</h3></div>${body}</li>`;
    }).join('');
    const finished = st.at >= u.steps.length || st.all;
    const toggle = !finished ? '<button class="link" data-act="all">Prefiero leerlo todo seguido</button>' : '';
    const final = finished
      ? `<section class="card"><div class="sec-head"><h2>El plano completo</h2></div>${diagram(u.final.diagram, u.id)}<ul class="ideas" style="margin-top:14px">${u.final.summary.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></section>` +
        `<section class="card"><div class="sec-head"><h2>Las preguntas de la web</h2><span class="muted">Lo que conviene saber de este problema</span></div>${u.considerations.map((c) => `<details class="qa"><summary><span>${inline(c.q)}</span>${ICON.chev}</summary><div class="prose">${md(c.a)}</div></details>`).join('')}</section>` +
        `<section class="card"><div class="sec-head"><h2>En la entrevista</h2></div><ul class="ideas">${u.interview.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></section>` +
        (u.resources.length ? `<section class="card"><div class="sec-head"><h2>Para profundizar</h2><span class="muted">Las soluciones que recomienda systemdesign.io</span></div><ul class="res">${u.resources.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title || r.url)}</a>${r.label ? ` <small>· ${esc(r.label)}</small>` : ''}</li>`).join('')}</ul></section>` : '') +
        feelBlock(u)
      : '';
    return unitHead(u) + `<div class="story"><span class="mono-label">El encargo</span><div class="prose" style="margin-top:6px">${md(u.story)}</div></div>` + prereq +
      `<section class="card"><div class="sec-head"><h2>Paso a paso</h2>${toggle}</div><ol class="steps">${steps}</ol></section>` + interviewCard() + final + askBlock();
  }

  function render() {
    const fk = document.activeElement?.dataset?.fk;
    const caret = document.activeElement?.selectionStart;
    if (S.view.name === 'unit') {
      const u = content(S.view.id);
      if (!u) { S.view = { name: 'home' }; renderHome(); return; }
      const y = window.scrollY;
      app.innerHTML = u.kind === 'problem' ? problemPage(u) : lessonPage(u);
      window.scrollTo(0, y);
    } else if (S.view.name === 'review' && S.rev) {
      app.innerHTML = reviewPage();
    } else if (S.view.name === 'search') {
      app.innerHTML = searchPage();
    } else if (S.view.name === 'progress') {
      app.innerHTML = progressPage();
    } else {
      S.view = { name: 'home' };
      renderHome();
    }
    if (fk) {
      const el = app.querySelector(`[data-fk="${fk}"]`);
      if (el) { el.focus({ preventScroll: true }); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* not a text field */ } }
    }
  }
  const renderIfHome = () => { if (S.view.name === 'home') render(); };

  // ---------- actions ----------
  function scrollToStep(id) {
    const el = document.getElementById('step-' + id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function reveal(u, stepId) {
    const p = prog(u.id) || {};
    const seen = new Set(Array.isArray(p.seen) ? p.seen : []);
    seen.add(stepId);
    saveProgress(u.id, { seen: [...seen] });
    render();
  }
  function advance(u) {
    const st = problemState(u);
    const at = Math.min(st.at + 1, u.steps.length);
    saveProgress(u.id, { at });
    render();
    if (at < u.steps.length) scrollToStep(u.steps[at].id);
  }
  function markFeel(u, feel) {
    const p = prog(u.id);
    const before = p?.status === 'done' ? null : streakNow();
    const patch = { status: 'done', feel, doneAt: p?.doneAt || new Date().toISOString(), doneOn: p?.doneOn || C.todayKey() };
    if (u.kind === 'problem') patch.at = u.steps.length;
    saveProgress(u.id, patch);
    if (before) S.ui.celebrate = celebrationFor(before);
    render();
  }

  // Dudas: se abre Claude con la pregunta y el contexto de la unidad.
  function ask(u) {
    const q = (document.getElementById('ask-in')?.value || '').trim();
    if (!q) { toast('Escribe tu duda primero'); return; }
    let ctx;
    if (u.kind === 'lesson') ctx = u.sections.map((s) => s.heading).join(' · ');
    else {
      const st = problemState(u);
      const current = u.steps[Math.min(st.at, u.steps.length - 1)];
      ctx = `Encargo: ${plain(u.story)}\nPaso en el que estoy: ${current.title}. ${plain(current.think)}`;
    }
    const prompt = `Estoy aprendiendo system design desde lo básico con una app (en español, con los términos técnicos en inglés). Unidad: «${u.title}».\n\n${ctx.slice(0, 1200)}\n\nMi duda: ${q}\n\nExplícamelo claro, con un ejemplo o una analogía, en menos de 250 palabras.`;
    openClaude(prompt, 'Abriendo Claude… (la pregunta también está copiada)');
  }

  // ---------- notifications ----------
  function urlB64ToUint8Array(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  async function refreshPush() {
    const p = S.push;
    p.supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!p.supported || !S.reg) { renderIfHome(); return; }
    p.permission = Notification.permission;
    const sub = await S.reg.pushManager.getSubscription().catch(() => null);
    p.subscribed = !!sub && p.permission === 'granted';
    p.code = sub ? JSON.stringify(sub.toJSON()) : null;
    const sentFor = await C.idbGet('subSentFor').catch(() => null);
    p.sent = !!p.code && sentFor === sub.endpoint;
    renderIfHome();
  }
  async function pushOn() {
    const p = S.push;
    if (!S.reg) { toast('Espera un momento y vuelve a intentarlo'); return; }
    p.busy = true;
    renderIfHome();
    try {
      const perm = await Notification.requestPermission();
      p.permission = perm;
      if (perm === 'granted') {
        const existing = await S.reg.pushManager.getSubscription();
        if (!existing) await S.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC) });
      }
    } catch (e) {
      toast('No se han podido activar los avisos');
    }
    p.busy = false;
    await refreshPush();
  }
  async function pushOff() {
    try { const sub = await S.reg?.pushManager.getSubscription(); await sub?.unsubscribe(); } catch (e) { /* already gone */ }
    await C.idbSet('subSentFor', null).catch(() => {});
    S.settings.showCode = false;
    toast('Avisos desactivados');
    await refreshPush();
  }
  async function pushTest() {
    const due = S.reviewInfo?.due || 0;
    const msg = C.dailyMessage(S.path, S.progress, C.todayKey(), due, activeDays());
    try {
      await S.reg.showNotification(msg.title, { body: msg.body, icon: './icons/icon-192.png', tag: 'planos-test' });
      toast('Así te llegará cada mañana');
    } catch (e) {
      toast('No se ha podido mostrar el aviso');
    }
  }

  // ---------- backup ----------
  async function backup() {
    const text = JSON.stringify({ app: 'planos', savedAt: new Date().toISOString(), progress: S.progress, cards: S.cards, reviewLog: S.reviewLog });
    toast((await copyText(text)) ? 'Progreso copiado. Pégalo en Notas para guardarlo.' : 'No se ha podido copiar');
  }
  function restoreApply() {
    try {
      const data = JSON.parse(S.settings.restoreText);
      if (data?.app !== 'planos' || typeof data.progress !== 'object' || !data.progress) throw new Error('shape');
      S.progress = data.progress;
      S.cards = data.cards && typeof data.cards === 'object' ? data.cards : {};
      S.reviewLog = data.reviewLog && typeof data.reviewLog === 'object' ? data.reviewLog : {};
      C.idbSet('progress', S.progress);
      C.idbSet('cards', S.cards);
      C.idbSet('reviewLog', S.reviewLog);
      S.settings = { ...S.settings, restore: false, restoreText: '', restoreError: '' };
      quietBadges();
      toast('Progreso restaurado');
      render();
      refreshReview();
    } catch (e) {
      S.settings.restoreError = 'Eso no parece una copia de Planos. Pégala entera, tal como la copiaste.';
      render();
    }
  }

  // ---------- events ----------
  const fromHere = () => (S.view.name === 'unit' ? S.view.id : S.view.name === 'search' ? '@search' : S.view.name === 'review' ? '@review' : S.view.name === 'progress' ? '@progress' : null);
  app.addEventListener('click', (ev) => {
    const from = ev.target.closest('[data-open-from]');
    if (from) { openUnit(from.dataset.openFrom, fromHere()); return; }
    const opener = ev.target.closest('[data-open]');
    if (opener) { openUnit(opener.dataset.open, null); return; }
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const u = S.view.name === 'unit' ? content(S.view.id) : null;
    switch (t.dataset.act) {
      case 'back': goHome(); break;
      case 'home': S.view.from = null; S.rev = null; goHome(); break;
      case 'check': if (u) { S.ui.checks[Number(t.dataset.i)] = Number(t.dataset.k); render(); } break;
      case 'hint': if (u) { const id = t.dataset.step; S.ui.hints[id] = (S.ui.hints[id] || 0) + 1; render(); } break;
      case 'reveal': if (u) reveal(u, t.dataset.step); break;
      case 'advance': if (u) advance(u); break;
      case 'all': if (u) { S.ui.all = true; render(); } break;
      case 'feel': if (u) markFeel(u, t.dataset.feel); break;
      case 'ask': if (u) ask(u); break;
      case 'interview': if (u) openClaude(interviewPrompt(u, t.dataset.lang), t.dataset.lang === 'en' ? 'Opening Claude… (the prompt is also copied)' : 'Abriendo Claude como entrevistador… (también está copiado)'); break;
      case 'tts-play': if (u) ttsPlay(u); break;
      case 'tts-pause': ttsPause(); break;
      case 'tts-resume': ttsResume(); break;
      case 'tts-stop': ttsStop(); break;
      case 'tts-rate': ttsRate(); break;
      case 'search': openSearch(); break;
      case 'progress': if (S.view.name !== 'progress') openProgress(fromHere()); break;
      case 'cal-prev': if (S.cal) { S.cal.month = monthAdd(S.cal.month, -1); render(); } break;
      case 'cal-next': if (S.cal) { S.cal.month = monthAdd(S.cal.month, 1); render(); } break;
      case 'cal-day': if (S.cal) { S.cal.day = t.dataset.day; render(); } break;
      case 'review-start': startReview(); break;
      case 'rev-show': if (S.rev) { S.rev.shown = true; render(); } break;
      case 'rev-choose': if (S.rev && !Number.isInteger(S.rev.chosen)) { S.rev.chosen = Number(t.dataset.k); render(); } break;
      case 'rev-grade': if (S.rev) gradeCurrent(t.dataset.g); break;
      case 'push-on': pushOn(); break;
      case 'push-off': pushOff(); break;
      case 'push-test': pushTest(); break;
      case 'copy-code': copyText(S.push.code || '').then((ok) => toast(ok ? 'Código copiado' : 'No se ha podido copiar: mantén pulsado el código')); break;
      case 'code-sent': if (S.push.code) { C.idbSet('subSentFor', JSON.parse(S.push.code).endpoint).then(refreshPush); } break;
      case 'toggle-code': S.settings.showCode = !S.settings.showCode; render(); break;
      case 'backup': backup(); break;
      case 'restore-open': S.settings.restore = true; render(); break;
      case 'restore-cancel': S.settings = { ...S.settings, restore: false, restoreText: '', restoreError: '' }; render(); break;
      case 'restore-apply': restoreApply(); break;
    }
  });
  app.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset?.note && S.view.name === 'unit') saveNote(S.view.id, t.dataset.note, t.value.slice(0, 4000));
    if (t.id === 'ask-in') S.ui.ask = t.value;
    if (t.id === 'restore-in') S.settings.restoreText = t.value;
    if (t.id === 'search-in') { S.search.q = t.value; renderSearchResults(); }
  });

  // ---------- start ----------
  async function registerSW() {
    if (!('serviceWorker' in navigator)) { refreshPush(); return; }
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (S.view.name === 'home') location.reload();
      else S.pendingReload = true;
    });
    try {
      await navigator.serviceWorker.register('./sw.js');
      S.reg = await navigator.serviceWorker.ready;
      S.reg.update().catch(() => {});
    } catch (e) { /* offline or unsupported: the app still works */ }
    await refreshPush();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      S.reg?.update().catch(() => {});
      refreshPush();
      if (S.view.name === 'home') refreshReview();
    } else {
      ttsStop();
    }
  });

  async function init() {
    renderHome();
    try {
      const [path, index, progress, cards, reviewLog, seenBadges] = await Promise.all([
        getJSON('./data/path.json'), getJSON('./data/index.json'),
        C.idbGet('progress').catch(() => null), C.idbGet('cards').catch(() => null), C.idbGet('reviewLog').catch(() => null),
        C.idbGet('seenBadges').catch(() => null),
      ]);
      S.path = path;
      S.ready = new Set(index.units);
      S.version = index.version;
      S.progress = progress || {};
      S.cards = cards || {};
      S.reviewLog = reviewLog || {};
      S.status = 'ready';
      if (Array.isArray(seenBadges)) S.seenBadges = seenBadges;
      else quietBadges();
    } catch (e) {
      S.status = 'error';
    }
    const h = (location.hash || '').slice(1);
    if (S.status === 'ready' && /^[LP]\d{2}$/.test(h) && isReady(h)) await openUnit(h, null);
    else renderHome();
    if (S.status === 'ready') refreshReview();
    registerSW();
  }
  init();
})();
