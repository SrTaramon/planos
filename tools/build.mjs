// Empaqueta las unidades y las escenas para la app: valida cada una, escribe data/ y pone la versión en sw.js.
//   node tools/build.mjs                                  (deja data/units como está y rehace escenas e índice)
//   node tools/build.mjs <carpeta con L01.json…> <path.json>  (publica también unidades nuevas)
// Una unidad que no valida no se publica (sale «En preparación» en la app); una escena que no valida, tampoco.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [srcDir, pathFile] = process.argv.slice(2);
if (srcDir && !pathFile) { console.error('Uso: node tools/build.mjs [<carpeta de unidades> <path.json>]'); process.exit(2); }

const dataDir = join(root, 'data');
const path = JSON.parse(readFileSync(pathFile || join(dataDir, 'path.json'), 'utf8'));
const known = new Set(path.units.map((u) => u.id));
const ok = [];
const skipped = [];
if (srcDir) {
  rmSync(join(dataDir, 'units'), { recursive: true, force: true });
  mkdirSync(join(dataDir, 'units'), { recursive: true });
  const files = readdirSync(srcDir).filter((f) => /^[LP]\d{2}\.json$/.test(f) && known.has(f.slice(0, 3))).sort();
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
} else {
  for (const f of readdirSync(join(dataDir, 'units')).filter((x) => /^[LP]\d{2}\.json$/.test(x) && known.has(x.slice(0, 3))).sort()) ok.push(f.slice(0, 3));
}

// Escenas («Míralo en acción»): scenes/Lxx.json, solo las que validan y cuya unidad está publicada.
const scenes = [];
const badScenes = [];
rmSync(join(dataDir, 'scenes'), { recursive: true, force: true });
mkdirSync(join(dataDir, 'scenes'), { recursive: true });
const sceneDir = join(root, 'scenes');
if (existsSync(sceneDir)) {
  // PLANOS_SCENES=L11,L14 publica solo esas (para no publicar escenas a medio escribir).
  const only = process.env.PLANOS_SCENES ? new Set(process.env.PLANOS_SCENES.split(',').map((x) => x.trim())) : null;
  for (const f of readdirSync(sceneDir).filter((x) => /^[LP]\d{2}\.json$/.test(x)).sort()) {
    const id = f.slice(0, 3);
    if (!ok.includes(id) || (only && !only.has(id))) continue;
    try {
      execFileSync('node', [join(root, 'tools', 'validate-scene.cjs'), join(sceneDir, f)], { stdio: 'pipe' });
    } catch (e) {
      badScenes.push(f);
      continue;
    }
    writeFileSync(join(dataDir, 'scenes', f), JSON.stringify(JSON.parse(readFileSync(join(sceneDir, f), 'utf8'))));
    scenes.push(id);
  }
}

const fonts = readdirSync(join(root, 'fonts')).filter((f) => f.endsWith('.woff2')).sort();
if (srcDir) writeFileSync(join(dataDir, 'path.json'), JSON.stringify(path));

// Version = hash of everything the service worker caches, so any change ships a new cache.
const hash = createHash('sha256');
for (const f of ['index.html', 'app.js', 'core.js', 'scene.js', 'fonts.css', 'manifest.webmanifest', 'data/path.json']) hash.update(readFileSync(join(root, f)));
for (const id of ok) hash.update(readFileSync(join(dataDir, 'units', id + '.json')));
for (const id of scenes) hash.update(readFileSync(join(dataDir, 'scenes', id + '.json')));
const stamp = new Date().toISOString().slice(0, 10);
const version = `${stamp}-${hash.digest('hex').slice(0, 8)}`;
writeFileSync(join(dataDir, 'index.json'), JSON.stringify({ version, units: ok, scenes, fonts }));

const swFile = join(root, 'sw.js');
writeFileSync(swFile, readFileSync(swFile, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));

console.log(`versión ${version}: ${ok.length} unidades publicadas de ${path.units.length}, ${scenes.length} escenas` + (skipped.length ? `; unidades que no validan: ${skipped.join(', ')}` : '') + (badScenes.length ? `; escenas que no validan: ${badScenes.join(', ')}` : ''));
