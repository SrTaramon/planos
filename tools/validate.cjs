// Valida unidades de Planos (lecciones y problemas): node validate.js unidad1.json [unidad2.json ...]
const fs = require('fs');
const KINDS = ['client', 'lb', 'service', 'cache', 'db', 'queue', 'storage', 'cdn', 'worker', 'external', 'stream', 'search'];
const CALLOUTS = ['tip', 'trap', 'interview', 'example'];
const DIFF = ['Muy fácil', 'Fácil', 'Media', 'Difícil', 'Muy difícil'];
let failed = 0;

function checkDiagram(d, where, bad) {
  if (!d) return;
  if (!Array.isArray(d.layers) || d.layers.length < 1 || d.layers.length > 7) { bad.push(where + ': diagram.layers (1-7)'); return; }
  d.layers.forEach((L, i) => {
    if (!Array.isArray(L.nodes) || !L.nodes.length || L.nodes.length > 4) bad.push(`${where}: layer ${i} nodes (1-4)`);
    (L.nodes || []).forEach((n, j) => {
      if (!n.label || n.label.length > 28) bad.push(`${where}: node ${i}.${j} label (1-28 chars)`);
      if (!KINDS.includes(n.kind)) bad.push(`${where}: node ${i}.${j} kind "${n.kind}"`);
      if (n.note && n.note.length > 40) bad.push(`${where}: node ${i}.${j} note (max 40 chars)`);
    });
  });
  if (d.flow && !Array.isArray(d.flow)) bad.push(where + ': flow must be an array');
}

for (const f of process.argv.slice(2)) {
  const bad = [];
  let u;
  try { u = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(f + ': INVALID JSON: ' + e.message); failed++; continue; }
  const str = (v, n, min = 1) => { if (typeof v !== 'string' || v.trim().length < min) bad.push(n); };
  str(u.id, 'id');
  str(u.title, 'title');
  if (!Number.isInteger(u.minutes) || u.minutes < 5 || u.minutes > 35) bad.push('minutes (5-35)');
  if (u.kind === 'lesson') {
    if (!/^L\d{2}$/.test(u.id)) bad.push('id must look like L07');
    str(u.concept, 'concept');
    str(u.hook, 'hook', 20);
    if (!Array.isArray(u.sections) || u.sections.length < 3 || u.sections.length > 6) bad.push('sections (3-6)');
    (u.sections || []).forEach((s, i) => {
      str(s.heading, `section ${i} heading`);
      str(s.body, `section ${i} body`, 40);
      checkDiagram(s.diagram, `section ${i}`, bad);
      if (s.callout && (!CALLOUTS.includes(s.callout.type) || !s.callout.text)) bad.push(`section ${i} callout`);
    });
    if (!Array.isArray(u.glossary) || u.glossary.length < 2) bad.push('glossary (2+)');
    (u.glossary || []).forEach((g, i) => { if (!g.term || !g.def) bad.push('glossary ' + i); });
    if (!Array.isArray(u.checks) || u.checks.length < 2 || u.checks.length > 4) bad.push('checks (2-4)');
    (u.checks || []).forEach((c, i) => {
      if (!c.q || !Array.isArray(c.options) || c.options.length < 2 || !Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.options.length || !c.explain) bad.push('check ' + i);
    });
    if (!Array.isArray(u.keyIdeas) || u.keyIdeas.length < 3) bad.push('keyIdeas (3+)');
  } else if (u.kind === 'problem') {
    if (!/^P\d{2}$/.test(u.id)) bad.push('id must look like P07');
    str(u.original, 'original');
    if (!/^https:\/\/systemdesign\.io\/question\/[a-z0-9-]+$/.test(u.url || '')) bad.push('url');
    if (!DIFF.includes(u.difficulty)) bad.push('difficulty');
    if (!Array.isArray(u.prereqs)) bad.push('prereqs');
    str(u.story, 'story', 30);
    if (!Array.isArray(u.steps) || u.steps.length < 5 || u.steps.length > 9) bad.push('steps (5-9)');
    const ids = new Set();
    (u.steps || []).forEach((s, i) => {
      if (!s.id || ids.has(s.id)) bad.push(`step ${i} id`);
      ids.add(s.id);
      str(s.title, `step ${i} title`);
      str(s.think, `step ${i} think`, 20);
      str(s.body, `step ${i} body`, 80);
      if (s.hints && !Array.isArray(s.hints)) bad.push(`step ${i} hints`);
      checkDiagram(s.diagram, `step ${i}`, bad);
    });
    if (!(u.steps || []).some((s) => s.diagram)) bad.push('at least one step needs a diagram');
    if (!u.final || !u.final.diagram || !Array.isArray(u.final.summary) || u.final.summary.length < 3) bad.push('final (diagram + 3+ summary points)');
    else checkDiagram(u.final.diagram, 'final', bad);
    if (!Array.isArray(u.considerations) || !u.considerations.length) bad.push('considerations');
    (u.considerations || []).forEach((c, i) => { if (!c.q || !c.a) bad.push('consideration ' + i); });
    if (!Array.isArray(u.interview) || u.interview.length < 2) bad.push('interview (2+)');
    if (!Array.isArray(u.resources)) bad.push('resources');
  } else {
    bad.push('kind must be "lesson" or "problem"');
  }
  (u.resources || []).forEach((r, i) => { if (!/^https:\/\//.test(r.url || '')) bad.push('resource ' + i + ' url'); });
  if (u.status !== 'ready') bad.push('status must be "ready"');
  console.log(f + ': ' + (bad.length ? 'INVALID: ' + bad.join('; ') : 'OK'));
  if (bad.length) failed++;
}
process.exit(failed ? 1 : 0);
