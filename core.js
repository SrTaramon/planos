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

  function streak(progress, today = todayKey()) {
    const days = new Set(Object.values(progress || {}).map((p) => p.doneOn).filter(Boolean));
    let d = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  // El texto del aviso de la mañana, calculado en el propio iPhone con su progreso.
  function dailyMessage(path, progress, today = todayKey()) {
    const list = outline(path);
    const next = list.find((u) => !isDone(progress, u.id));
    if (!list.length) return { title: 'Planos', body: 'Tu ruta de system design te espera.' };
    if (!next) return { title: 'Planos', body: 'Has terminado la ruta. Repasa lo que marcaste cuando quieras.' };
    const { plan } = todayPlan(path, progress, today);
    const pending = plan.filter((u) => !isDone(progress, u.id));
    if (!pending.length) return { title: 'Planos · Hoy ya está', body: `Mañana sigues con «${next.title}».` };
    const st = streak(progress, today);
    const mins = pending.reduce((s, u) => s + (u.minutes || 10), 0);
    const body = pending.map((u) => `${kindLabel(u.kind)}: ${u.title}`).join(' · ');
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

  root.PlanosCore = { TZ, SESSION_MIN, todayKey, addDays, outline, isDone, kindLabel, todayPlan, streak, dailyMessage, idbGet, idbSet };
})(typeof self !== 'undefined' ? self : window);
