// Empaqueta las unidades para la app: valida cada una, escribe data/ y pone la versión en sw.js.
//   node tools/build.mjs <carpeta con L01.json, P01.json…> <path.json>
// Una unidad que no valida no se publica (sale «En preparación» en la app).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [srcDir, pathFile] = process.argv.slice(2);
if (!srcDir || !pathFile) { console.error('Uso: node tools/build.mjs <carpeta de unidades> <path.json>'); process.exit(2); }

const path = JSON.parse(readFileSync(pathFile, 'utf8'));
const known = new Set(path.units.map((u) => u.id));
const dataDir = join(root, 'data');
rmSync(join(dataDir, 'units'), { recursive: true, force: true });
mkdirSync(join(dataDir, 'units'), { recursive: true });

const files = readdirSync(srcDir).filter((f) => /^[LP]\d{2}\.json$/.test(f) && known.has(f.slice(0, 3))).sort();
const ok = [];
const skipped = [];
for (const f of files) {
  try {
    execFileSync('node', [join(root, 'tools', 'validate.cjs'), join(srcDir, f)], { stdio: 'pipe' });
  } catch (e) {
    skipped.push(f);
    continue;
  }
  const unit = JSON.parse(readFileSync(join(srcDir, f), 'utf8'));
  writeFileSync(join(dataDir, 'units', f), JSON.stringify(unit));
  ok.push(unit.id);
}

const fonts = readdirSync(join(root, 'fonts')).filter((f) => f.endsWith('.woff2')).sort();
writeFileSync(join(dataDir, 'path.json'), JSON.stringify(path));

// Version = hash of everything the service worker caches, so any change ships a new cache.
const hash = createHash('sha256');
for (const f of ['index.html', 'app.js', 'core.js', 'fonts.css', 'manifest.webmanifest', 'data/path.json']) hash.update(readFileSync(join(root, f)));
for (const id of ok) hash.update(readFileSync(join(dataDir, 'units', id + '.json')));
const stamp = new Date().toISOString().slice(0, 10);
const version = `${stamp}-${hash.digest('hex').slice(0, 8)}`;
writeFileSync(join(dataDir, 'index.json'), JSON.stringify({ version, units: ok, fonts }));

const swFile = join(root, 'sw.js');
writeFileSync(swFile, readFileSync(swFile, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));

console.log(`versión ${version}: ${ok.length} unidades publicadas de ${path.units.length}` + (skipped.length ? `; no validan: ${skipped.join(', ')}` : ''));
