// Valida escenas de Planos («Míralo en acción»): node tools/validate-scene.cjs scenes/L11.json [...]
// La escena se dibuja en una cuadrícula: columnas 0-3 (como mucho 4 de ancho), filas 0-6.
const fs = require('fs');
global.self = global;
require('../scene.js');
const { KINDS, PACKETS } = self.PlanosScene;
const CHAPTERS = ['problem', 'technique', 'solution', 'case', 'recap'];
const CALLOUTS = ['insight', 'tip', 'warn'];
const STATES = ['ok', 'hot', 'down', 'dim'];

function len(s) { return [...String(s ?? '')].length; }
function check(file) {
  const bad = [];
  let sc;
  try { sc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`no es JSON: ${e.message}`]; }
  const id = (file.match(/([LP]\d{2})\.json$/) || [])[1];
  if (sc.id !== id) bad.push(`id "${sc.id}" no coincide con el fichero (${id})`);
  if (!sc.title || len(sc.title) > 60) bad.push('title (1-60)');
  const metrics = Array.isArray(sc.metrics) ? sc.metrics : [];
  if (metrics.length > 4) bad.push('metrics: como mucho 4');
  const mids = new Set();
  metrics.forEach((m, i) => {
    if (!m.id || mids.has(m.id)) bad.push(`metric ${i}: id único`);
    mids.add(m.id);
    if (!m.label || len(m.label) > 22) bad.push(`metric ${m.id}: label (1-22)`);
    if (m.better && !['low', 'high'].includes(m.better)) bad.push(`metric ${m.id}: better low|high`);
    if (m.unit && len(m.unit) > 8) bad.push(`metric ${m.id}: unit (max 8)`);
  });
  if (sc.legend && typeof sc.legend === 'object') for (const [k, v] of Object.entries(sc.legend)) { if (!PACKETS.includes(k)) bad.push(`legend: tipo "${k}"`); if (len(v) > 24) bad.push(`legend ${k}: max 24`); }
  const steps = Array.isArray(sc.steps) ? sc.steps : [];
  if (steps.length < 5 || steps.length > 10) bad.push('steps: 5-10');
  if (Array.isArray(sc.goals)) sc.goals.forEach((g, i) => { if (!g.text || len(g.text) > 70) bad.push(`goal ${i}: text (1-70)`); if (!(g.step >= 1 && g.step <= steps.length)) bad.push(`goal ${i}: step 1-${steps.length}`); });
  steps.forEach((st, i) => {
    const w = `paso ${i + 1}`;
    if (!st.short || len(st.short) > 14) bad.push(`${w}: short (1-14)`);
    if (!CHAPTERS.includes(st.chapter)) bad.push(`${w}: chapter ${CHAPTERS.join('|')}`);
    if (!st.title || len(st.title) > 64) bad.push(`${w}: title (1-64)`);
    if (!st.body || len(st.body) > 520) bad.push(`${w}: body (1-520, ahora ${len(st.body)})`);
    if (st.callout && (!CALLOUTS.includes(st.callout.type) || !st.callout.text || len(st.callout.text) > 220)) bad.push(`${w}: callout (type ${CALLOUTS.join('|')}, text 1-220)`);
    if (st.changes && (!Array.isArray(st.changes) || st.changes.length > 4 || st.changes.some((c) => !/^[+~−-] \S/.test(c) || len(c) > 70))) bad.push(`${w}: changes (max 4, «+ x», «~ x» o «− x», max 70)`);
    if (st.metrics) for (const k of Object.keys(st.metrics)) if (!mids.has(k)) bad.push(`${w}: metric desconocida "${k}"`);
    if (st.panel) {
      if (!Array.isArray(st.panel.rows) || !st.panel.rows.length || st.panel.rows.length > 5) bad.push(`${w}: panel.rows (1-5)`);
      else st.panel.rows.forEach((r, k) => { if (!r.text || len(r.text) > 60) bad.push(`${w}: panel row ${k} (1-60)`); if (r.tone && !['good', 'bad'].includes(r.tone)) bad.push(`${w}: panel row ${k} tone good|bad`); });
      if (st.panel.title && len(st.panel.title) > 40) bad.push(`${w}: panel.title (max 40)`);
    }
    if (st.predict) checkQuestion(st.predict, `${w}: predict`, bad);
    if (st.predict && i === steps.length - 1) bad.push(`${w}: predict no puede ir en el último paso (pregunta por lo que enseña el siguiente)`);
    checkPlan(st, w, bad);
  });
  return bad;
}

// Una pregunta de opción múltiple: la de predecir en una escena, o una comprobación de una unidad.
function checkQuestion(c, w, bad) {
  if (!c || !c.q || len(c.q) > 260) bad.push(`${w}: q (1-260)`);
  if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4 || c.options.some((o) => !o || len(o) > 150)) bad.push(`${w}: options (2-4, cada una 1-150)`);
  if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= (c.options || []).length) bad.push(`${w}: answer (índice de options)`);
  if (!c.explain || len(c.explain) > 420) bad.push(`${w}: explain (1-420)`);
}

// Lo que se dibuja: piezas, conexiones, flujos, zonas y anillo (de un paso o de un mini plano).
function checkPlan(st, w, bad) {
    const nodes = Array.isArray(st.nodes) ? st.nodes : [];
    if (!nodes.length || nodes.length > 9) bad.push(`${w}: nodes (1-9)`);
    const ids = new Set();
    const cells = new Set();
    for (const n of nodes) {
      const nw = `${w}, nodo ${n.id}`;
      if (!n.id || ids.has(n.id)) bad.push(`${nw}: id único`);
      ids.add(n.id);
      if (!KINDS.includes(n.kind)) bad.push(`${nw}: kind "${n.kind}" (${KINDS.join(', ')})`);
      if (!Array.isArray(n.at) || n.at.length !== 2 || !(n.at[0] >= 0 && n.at[0] <= 3) || !(n.at[1] >= 0 && n.at[1] <= 6)) bad.push(`${nw}: at [col 0-3, fila 0-6]`);
      else { const key = n.at.map((v) => Math.round(v * 4)).join(','); if (cells.has(key)) bad.push(`${nw}: misma posición que otro nodo`); cells.add(key); }
      if (!n.label || len(n.label) > 14) bad.push(`${nw}: label (1-14)`);
      if (n.note && len(n.note) > 18) bad.push(`${nw}: note (max 18)`);
      if (n.badge && len(n.badge) > 12) bad.push(`${nw}: badge (max 12)`);
      if (n.load != null && !(n.load >= 0 && n.load <= 1)) bad.push(`${nw}: load 0-1`);
      if (n.state && !STATES.includes(n.state)) bad.push(`${nw}: state ${STATES.join('|')}`);
      if (n.mark && !['good', 'bad'].includes(n.mark)) bad.push(`${nw}: mark good|bad`);
      if (n.items && (!Array.isArray(n.items) || n.items.length > 3 || n.items.some((t) => !t || len(t) > 7))) bad.push(`${nw}: items (max 3, cada uno max 7)`);
    }
    const links = Array.isArray(st.links) ? st.links : [];
    const lids = new Set();
    for (const l of links) {
      const lw = `${w}, enlace ${l.id}`;
      if (!l.id || lids.has(l.id)) bad.push(`${lw}: id único`);
      lids.add(l.id);
      if (!ids.has(l.from) || !ids.has(l.to) || l.from === l.to) bad.push(`${lw}: from/to deben ser nodos distintos de este paso`);
      if (l.label && len(l.label) > 16) bad.push(`${lw}: label (max 16)`);
      if (l.state && !STATES.includes(l.state)) bad.push(`${lw}: state`);
      if (l.bend != null && !(Math.abs(l.bend) <= 1)) bad.push(`${lw}: bend -1..1`);
    }
    const byId = Object.fromEntries(links.map((l) => [l.id, l]));
    (st.flows || []).forEach((f, k) => {
      const fw = `${w}, flujo ${k}`;
      if (!Array.isArray(f.via) || !f.via.length) { bad.push(`${fw}: via`); return; }
      if (f.kind && !PACKETS.includes(f.kind)) bad.push(`${fw}: kind (${PACKETS.join(', ')})`);
      if (f.back && !PACKETS.includes(f.back)) bad.push(`${fw}: back`);
      if (f.rate != null && !(f.rate > 0 && f.rate <= 8)) bad.push(`${fw}: rate 0-8`);
      if (f.failAt != null && !(f.failAt > 0 && f.failAt <= 1)) bad.push(`${fw}: failAt 0-1`);
      // Cada tramo tiene que tocar al anterior: el paquete no salta.
      let ends = null;
      for (const v of f.via) {
        const opts = Array.isArray(v) ? v : [v];
        if (!opts.length || opts.some((x) => !byId[x])) { bad.push(`${fw}: enlace desconocido en via (${JSON.stringify(v)})`); ends = null; break; }
        if (ends) {
          for (const x of opts) { const l = byId[x]; if (!ends.has(l.from) && !ends.has(l.to)) bad.push(`${fw}: «${x}» no empieza donde acaba el tramo anterior`); }
          const nx = new Set();
          for (const x of opts) { const l = byId[x]; if (ends.has(l.from)) nx.add(l.to); if (ends.has(l.to)) nx.add(l.from); }
          ends = nx;
        } else {
          ends = new Set(opts.flatMap((x) => [byId[x].from, byId[x].to]));
          if (opts.length > 1) { ends = new Set(opts.map((x) => byId[x].to)); }
        }
      }
    });
    if (st.zones) st.zones.forEach((z, k) => { if (!Array.isArray(z.from) || !Array.isArray(z.to) || !z.label || len(z.label) > 22) bad.push(`${w}: zone ${k} (from, to, label max 22)`); });
    if (st.ring && (!Array.isArray(st.ring.center) || !(st.ring.radius > 0 && st.ring.radius <= 2))) bad.push(`${w}: ring (center, radius 0-2)`);
}
// El mini plano de una pregunta: un solo paso sin textos de paso.
function checkMini(plan, w, bad) {
  if (!plan || typeof plan !== 'object') { bad.push(`${w}: scene`); return; }
  checkPlan(plan, w, bad);
}
module.exports = { check, checkQuestion, checkPlan, checkMini };
if (require.main !== module) return;
let failed = 0;
for (const f of process.argv.slice(2)) {
  const bad = check(f);
  if (bad.length) { failed++; console.log(`✗ ${f}\n  - ${bad.join('\n  - ')}`); } else console.log(`✓ ${f}`);
}
process.exit(failed ? 1 : 0);
