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

  // Días seguidos con actividad: una unidad terminada o un repaso hecho (activeDays).
  function streak(progress, today = todayKey(), activeDays = []) {
    const days = new Set([...Object.values(progress || {}).map((p) => p.doneOn).filter(Boolean), ...activeDays]);
    let d = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return n;
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

  root.PlanosCore = { TZ, SESSION_MIN, REVIEW_LIMIT, todayKey, addDays, outline, isDone, kindLabel, todayPlan, streak, cardsOf, reviewQueue, gradeCard, dailyMessage, idbGet, idbSet };
})(typeof self !== 'undefined' ? self : window);
