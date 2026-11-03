/* Planos: lógica compartida por la app y el service worker (qué toca hoy, racha, almacenamiento). */
(function (root) {
  'use strict';

  const TZ = 'Europe/Madrid';
  const SESSION_MIN = 25;
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayKey = (d = new Date()) => dayFmt.format(d);
  const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  const outline = (path) => (Array.isArray(path?.units) ? path.units.slice().sort((a, b) => a.order - b.order) : []);
  const isDone = (progress, id) => progress?.[id]?.status === 'done';
  const kindLabel = (k) => (k === 'problem' ? 'Problema' : 'Lección');

  // Lo de hoy: lo ya hecho hoy y, desde la primera unidad sin hacer, unidades en orden hasta ~25 min (máximo 3).
  function todayPlan(path, progress, today = todayKey()) {
    const list = outline(path);
    const plan = list.filter((u) => progress?.[u.id]?.doneOn === today);
    let mins = plan.reduce((s, u) => s + (u.minutes || 10), 0);
    for (const u of list) {
      if (isDone(progress, u.id) || plan.includes(u)) continue;
      if (plan.length >= 3 || (mins >= SESSION_MIN && plan.length >= 1)) break;
      plan.push(u);
      mins += u.minutes || 10;
    }
    return { plan, mins };
  }

  // La actividad de cada día: unidades terminadas ese día y tarjetas repasadas, con sus minutos aproximados.
  const CARD_MIN = 0.35;
  function activityByDay(path, progress, reviewLog) {
    const byId = new Map(outline(path).map((u) => [u.id, u]));
    const days = {};
    const day = (k) => days[k] || (days[k] = { units: [], cards: 0, minutes: 0 });
    const done = Object.entries(progress || {}).filter(([, p]) => p?.status === 'done' && p.doneOn)
      .sort((a, b) => String(a[1].doneAt || '').localeCompare(String(b[1].doneAt || '')));
    for (const [id, p] of done) {
      const d = day(p.doneOn);
      d.units.push(id);
      d.minutes += byId.get(id)?.minutes || 10;
    }
    for (const [k, n] of Object.entries(reviewLog || {})) {
      if (!(n > 0)) continue;
      const d = day(k);
      d.cards += n;
      d.minutes += n * CARD_MIN;
    }
    return days;
  }

  // La racha: días seguidos en los que terminas una unidad o repasas. Cada 7 días de racha se gana un día
  // de descanso (como mucho 2 guardados): si un día no haces nada, se gasta solo y la racha sigue.
  const REST_EVERY = 7;
  const REST_MAX = 2;
  function streakInfo(progress, today = todayKey(), activeDays = []) {
    const days = new Set([...Object.values(progress || {}).map((p) => (p?.status === 'done' ? p.doneOn : null)).filter(Boolean), ...activeDays]);
    const info = { current: 0, best: 0, rest: 0, restDays: [], restEarned: [], firstReach: {}, todayDone: days.has(today), activeCount: 0 };
    if (!days.size) return info;
    let d = [...days].sort()[0];
    let cur = 0;
    while (d <= today) {
      if (days.has(d)) {
        cur++;
        info.activeCount++;
        if (!info.firstReach[cur]) info.firstReach[cur] = d;
        if (cur % REST_EVERY === 0 && info.rest < REST_MAX) { info.rest++; info.restEarned.push(d); }
        if (cur > info.best) info.best = cur;
      } else if (d !== today) {
        if (info.rest > 0) { info.rest--; info.restDays.push(d); } else cur = 0;
      }
      d = addDays(d, 1);
    }
    info.current = cur;
    return info;
  }
  const streak = (progress, today = todayKey(), activeDays = []) => streakInfo(progress, today, activeDays).current;

  // Logros: se calculan con el progreso guardado, así que no se pierden ni hay que apuntarlos.
  const STREAK_BADGES = [[3, '3 días seguidos'], [7, 'Una semana seguida'], [14, 'Dos semanas seguidas'], [30, 'Un mes seguido'], [60, 'Dos meses seguidos']];
  const UNIT_BADGES = [10, 25, 50];
  const CARD_BADGES = [50, 200, 500];
  function badges(path, progress, reviewLog, today = todayKey()) {
    const list = outline(path);
    const done = list.filter((u) => isDone(progress, u.id)).map((u) => ({ u, on: progress[u.id].doneOn || today }))
      .sort((a, b) => a.on.localeCompare(b.on));
    const firstOf = (kind) => done.find((x) => x.u.kind === kind)?.on || null;
    const revDays = Object.keys(reviewLog || {}).filter((k) => reviewLog[k] > 0).sort();
    let cum = 0;
    const cardsReach = {};
    for (const k of revDays) {
      cum += reviewLog[k];
      for (const n of CARD_BADGES) if (cum >= n && !cardsReach[n]) cardsReach[n] = k;
    }
    const st = streakInfo(progress, today, revDays);
    const out = [];
    const add = (id, group, title, desc, on, value, target) => out.push({ id, group, title, desc, done: !!on, on: on || null, value: Math.min(value, target), target });
    add('first-lesson', 'route', 'Primer paso', 'Terminar tu primera lección', firstOf('lesson'), done.some((x) => x.u.kind === 'lesson') ? 1 : 0, 1);
    add('first-problem', 'route', 'Primer plano', 'Resolver tu primer problema', firstOf('problem'), done.some((x) => x.u.kind === 'problem') ? 1 : 0, 1);
    for (const n of UNIT_BADGES) if (n < list.length) add(`units-${n}`, 'route', `${n} unidades`, `Terminar ${n} unidades de la ruta`, done[n - 1]?.on, done.length, n);
    if (list.length) add('route-all', 'route', 'Ruta completa', `Terminar las ${list.length} unidades`, done.length === list.length ? done[done.length - 1].on : null, done.length, list.length);
    for (const [n, title] of STREAK_BADGES) add(`streak-${n}`, 'streak', title, `Aprender ${n} días seguidos`, st.firstReach[n], st.current, n);
    add('first-review', 'review', 'Primer repaso', 'Repasar tus primeras tarjetas', revDays[0], revDays.length ? 1 : 0, 1);
    for (const n of CARD_BADGES) add(`cards-${n}`, 'review', `${n} tarjetas`, `Repasar ${n} tarjetas en total`, cardsReach[n], cum, n);
    (Array.isArray(path?.modules) ? path.modules : []).forEach((m, i) => {
      const units = list.filter((u) => u.module === m.id);
      if (!units.length) return;
      const doneHere = done.filter((x) => x.u.module === m.id);
      add(`module-${m.id}`, 'module', `M${i + 1} · ${m.title}`, `Terminar las ${units.length} unidades del módulo`, doneHere.length === units.length ? doneHere[doneHere.length - 1].on : null, doneHere.length, units.length);
      out[out.length - 1].mark = `M${i + 1}`;
      out[out.length - 1].name = m.title;
    });
    return out;
  }

  // Repaso espaciado: tarjetas sacadas de las unidades hechas, en cajas que vuelven cada vez más tarde.
  const BOX_DAYS = [1, 3, 7, 16, 35, 75];
  const REVIEW_LIMIT = 10;
  function cardsOf(unit) {
    const out = [];
    if (!unit) return out;
    if (unit.kind === 'lesson') {
      (unit.glossary || []).forEach((g, i) => out.push({ id: `${unit.id}:g${i}`, unitId: unit.id, type: 'term', front: g.term, back: g.def }));
      (unit.checks || []).forEach((c, i) => out.push({ id: `${unit.id}:c${i}`, unitId: unit.id, type: 'mcq', front: c.q, options: c.options, answer: c.answer, back: c.explain }));
    } else {
      (unit.considerations || []).forEach((c, i) => out.push({ id: `${unit.id}:q${i}`, unitId: unit.id, type: 'qa', front: c.q, back: c.a }));
    }
    return out;
  }
  // A card first comes up the day after finishing its unit (two days if it went «Lo tengo»).
  const firstDue = (p) => addDays(p.doneOn || todayKey(), p.feel === 'ok' ? 2 : 1);
  function reviewQueue(units, progress, cards, today = todayKey(), limit = REVIEW_LIMIT) {
    const due = [];
    for (const u of units) {
      const p = progress?.[u.id];
      if (p?.status !== 'done') continue;
      const weight = p.feel === 'review' ? 0 : p.feel === 'meh' ? 1 : 2;
      for (const card of cardsOf(u)) {
        const st = cards?.[card.id];
        const dueOn = st ? st.due : firstDue(p);
        if (dueOn <= today) due.push({ card, dueOn, weight });
      }
    }
    due.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.weight - b.weight || a.card.id.localeCompare(b.card.id));
    return { total: due.length, items: due.slice(0, limit).map((d) => d.card) };
  }
  function gradeCard(st, result, today = todayKey()) {
    let box = st?.box ?? 0;
    box = result === 'again' ? 0 : Math.min(BOX_DAYS.length - 1, box + (result === 'easy' ? 2 : 1));
    return { box, due: addDays(today, result === 'again' ? 1 : BOX_DAYS[box]), reps: (st?.reps || 0) + 1, lapses: (st?.lapses || 0) + (result === 'again' ? 1 : 0), last: today };
  }

  // El texto del aviso de la mañana, calculado en el propio iPhone con su progreso.
  function dailyMessage(path, progress, today = todayKey(), reviewDue = 0, activeDays = []) {
    const list = outline(path);
    const next = list.find((u) => !isDone(progress, u.id));
    const review = reviewDue > 0 ? `Repaso: ${Math.min(reviewDue, REVIEW_LIMIT)} ${reviewDue === 1 ? 'tarjeta' : 'tarjetas'}` : '';
    if (!list.length) return { title: 'Planos', body: 'Tu ruta de system design te espera.' };
    if (!next) return { title: 'Planos', body: review ? `${review} de lo que ya has visto.` : 'Has terminado la ruta. Repasa lo que marcaste cuando quieras.' };
    const { plan } = todayPlan(path, progress, today);
    const pending = plan.filter((u) => !isDone(progress, u.id));
    if (!pending.length) return { title: 'Planos · Hoy ya está', body: (review ? review + ' · ' : '') + `Mañana sigues con «${next.title}».` };
    const st = streak(progress, today, activeDays);
    const mins = pending.reduce((s, u) => s + (u.minutes || 10), 0) + (review ? 3 : 0);
    const body = pending.map((u) => `${kindLabel(u.kind)}: ${u.title}`).concat(review ? [review] : []).join(' · ');
    const title = `Hoy en Planos · unos ${mins} min` + (st >= 2 ? ` · ${st} días seguidos` : '');
    return { title, body };
  }

  // IndexedDB: una tabla clave-valor (progress, subscription…), accesible también desde el service worker.
  let dbp = null;
  function idb() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('planos', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function idbGet(key) {
    const db = await idb();
    return new Promise((resolve, reject) => {
      const r = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function idbSet(key, value) {
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  root.PlanosCore = { TZ, SESSION_MIN, REVIEW_LIMIT, REST_EVERY, REST_MAX, CARD_MIN, todayKey, addDays, outline, isDone, kindLabel, todayPlan, activityByDay, streakInfo, streak, badges, cardsOf, reviewQueue, gradeCard, dailyMessage, idbGet, idbSet };
})(typeof self !== 'undefined' ? self : window);
