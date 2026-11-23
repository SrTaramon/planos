// Comprueba cómo se ven las escenas: dibuja cada paso con el CSS de la app en un iPhone (Chromium sin
// ventana) y avisa si se pisan textos o piezas, o si el plano queda demasiado pequeño para leerse.
//   node tools/check-scenes.mjs scenes/L11.json [más…] [--shots <carpeta>]
//   node tools/check-scenes.mjs data/units/L11.json   (los mini planos de sus preguntas)
// Necesita Playwright (en el contenedor de Claude ya está instalado).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = createRequire('/usr/lib/node_modules/')('playwright'); }
const args = process.argv.slice(2);
const shotsAt = args.indexOf('--shots');
const shots = shotsAt >= 0 ? args[shotsAt + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (shotsAt < 0 || i !== shotsAt + 1));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  try { const body = await readFile(join(root, normalize(p))); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await playwright.chromium.launch();
const ctx = await browser.newContext({ ...playwright.devices['iPhone 13'], serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.route('**/sw.js', (r) => r.fulfill({ status: 404, body: '' }));
await page.goto(base + 'index.html');
await page.waitForFunction(() => window.PlanosScene);
await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
let problems = 0;
for (const f of files) {
  let scene = JSON.parse(readFileSync(f, 'utf8'));
  // Una unidad (data/units/Lxx.json): se dibujan los mini planos de sus preguntas.
  if (scene.kind) scene = { steps: (scene.checks || []).filter((c) => c.scene).map((c) => c.scene) };
  if (!scene.steps.length) { console.log(`· ${basename(f)}: nada que dibujar`); continue; }
  const report = await page.evaluate(async (scene) => {
    const app = document.getElementById('app');
    const out = [];
    let minFont = Infinity;
    for (let i = 0; i < scene.steps.length; i++) {
      app.innerHTML = `<section class="card scene-card" style="margin:0"><div class="sc-stage" id="sc-stage">${PlanosScene.svg(scene, i, { still: true })}</div></section>`;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const svg = app.querySelector('svg');
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      minFont = Math.min(minFont, 12.5 * scale);
      const boxes = [];
      const add = (el, kind, owner) => { const r = el.getBoundingClientRect(); if (r.width && r.height) boxes.push({ kind, owner, r: { x0: r.left + 1, y0: r.top + 1, x1: r.right - 1, y1: r.bottom - 1 } }); };
      for (const n of svg.querySelectorAll('.node')) {
        const id = n.dataset.id;
        n.querySelectorAll(':scope > .label, :scope > .badge, :scope > .note, :scope > .items').forEach((el) => add(el, el.getAttribute('class'), id));
        const body = n.querySelector(':scope > .body');
        if (body) add(body, 'pieza', id);
      }
      svg.querySelectorAll('.links .link-label').forEach((el, k) => add(el, 'etiqueta de enlace', 'enlace ' + el.textContent));
      svg.querySelectorAll('.zone text').forEach((el) => add(el, 'zona', 'zona ' + el.textContent));
      svg.querySelectorAll('.ring .link-label').forEach((el) => add(el, 'etiqueta del anillo', 'anillo'));
      const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a]; const B = boxes[b];
        if (A.owner === B.owner) continue;
        if (A.kind === 'pieza' && B.kind === 'pieza') { if (hit(A.r, B.r)) out.push(`paso ${i + 1}: las piezas «${A.owner}» y «${B.owner}» se tocan`); continue; }
        if (hit(A.r, B.r)) out.push(`paso ${i + 1}: ${A.kind} de «${A.owner}» pisa ${B.kind} de «${B.owner}»`);
      }
      // Texts must stay inside the stage.
      const st = app.querySelector('.sc-stage').getBoundingClientRect();
      for (const B of boxes) if (B.r.x0 < st.left - 2 || B.r.x1 > st.right + 2) out.push(`paso ${i + 1}: ${B.kind} de «${B.owner}» se sale del plano`);
    }
    return { out, minFont: Math.round(minFont * 10) / 10 };
  }, scene);
  const warnFont = report.minFont < 9 ? [`las etiquetas se leen a ${report.minFont}px en un iPhone: demasiado pequeñas (usa menos columnas)`] : [];
  const all = [...new Set(report.out), ...warnFont];
  if (all.length) { problems++; console.log(`✗ ${basename(f)} (etiquetas a ${report.minFont}px)\n  - ${all.join('\n  - ')}`); } else console.log(`✓ ${basename(f)} (etiquetas a ${report.minFont}px en un iPhone)`);
  if (shots) {
    for (let i = 0; i < scene.steps.length; i++) {
      await page.evaluate(({ scene, i }) => { document.getElementById('app').innerHTML = `<section class="card scene-card"><div class="sc-stage" id="sc-stage">${PlanosScene.svg(scene, i, { still: true })}</div></section>`; }, { scene, i });
      await page.locator('.sc-stage').screenshot({ path: join(shots, `${basename(f, '.json')}-${i + 1}.png`) });
    }
  }
}
await browser.close();
server.close();
process.exit(problems ? 1 : 0);
