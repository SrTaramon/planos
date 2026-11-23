/* Planos: escenas animadas («Míralo en acción»). Una escena es una lista de pasos; cada paso dibuja
   un plano con piezas (servidores, cache, base de datos…) en una cuadrícula, sus conexiones y los
   paquetes que viajan por ellas. Sin dependencias: SVG a mano y requestAnimationFrame. */
(function (root) {
  'use strict';

  const CX = 100; // separación entre columnas
  const CY = 112; // separación entre filas
  const SPEED = 165; // unidades por segundo
  const MAX_PACKETS = 60;

  const ICONS = {
    client: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>',
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
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  };
  // Forma y color de cada tipo de pieza.
  const KIND = {
    client: ['slab', 'n'], users: ['crowd', 'n'], lb: ['block', 't'], service: ['block', 'b'], worker: ['block', 'b'],
    cache: ['block', 'a'], db: ['cyl', 'p'], storage: ['cyl', 'g'], queue: ['block', 'g'], stream: ['block', 'g'],
    cdn: ['block', 't'], search: ['block', 'a'], external: ['cloud', 'n'], lock: ['block', 'p'], clock: ['block', 'a'],
  };
  const KINDS = Object.keys(KIND);
  const PACKETS = ['req', 'resp', 'write', 'event', 'ping', 'heavy', 'fail'];
  const PACKET_LABEL = { req: 'petición', resp: 'respuesta', write: 'escritura', event: 'evento o mensaje', ping: 'comprobación', heavy: 'petición pesada', fail: 'falla' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tw = (text, size, mono) => String(text).length * size * (mono ? 0.61 : 0.56);
  const fx = (n) => Math.round(n * 10) / 10;

  // ---------- geometry ----------
  const pos = (n) => ({ x: n.at[0] * CX, y: n.at[1] * CY });
  const radius = (n) => ({ crowd: 44, slab: 38, cloud: 34, cyl: 30, block: 31 }[(KIND[n.kind] || KIND.service)[0]]);
  // Centro visual de la pieza (los paquetes y las líneas apuntan ahí).
  const anchor = (n) => { const p = pos(n); return { x: p.x, y: p.y - 6 }; };

  function linkGeom(link, nodes) {
    const a = nodes[link.from];
    const b = nodes[link.to];
    if (!a || !b) return null;
    const A = anchor(a);
    const B = anchor(b);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Number(link.bend) || 0;
    // Control point for a curve: perpendicular offset from the midpoint.
    const C = { x: (A.x + B.x) / 2 - (dy / len) * bend * CX, y: (A.y + B.y) / 2 + (dx / len) * bend * CX };
    const ra = radius(a);
    const rb = radius(b);
    const toward = (P, Q, r) => { const l = Math.hypot(Q.x - P.x, Q.y - P.y) || 1; return { x: P.x + ((Q.x - P.x) / l) * r, y: P.y + ((Q.y - P.y) / l) * r }; };
    const P0 = toward(A, bend ? C : B, ra);
    const P2 = toward(B, bend ? C : A, rb);
    return { P0, P2, C: bend ? C : null };
  }
  function pointAt(g, t) {
    if (!g.C) return { x: g.P0.x + (g.P2.x - g.P0.x) * t, y: g.P0.y + (g.P2.y - g.P0.y) * t };
    const u = 1 - t;
    return { x: u * u * g.P0.x + 2 * u * t * g.C.x + t * t * g.P2.x, y: u * u * g.P0.y + 2 * u * t * g.C.y + t * t * g.P2.y };
  }
  function segLength(g) {
    if (!g.C) return Math.hypot(g.P2.x - g.P0.x, g.P2.y - g.P0.y);
    let L = 0;
    let p = g.P0;
    for (let i = 1; i <= 16; i++) { const q = pointAt(g, i / 16); L += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
    return L;
  }

  // Lo que se dibuja en un paso: piezas, conexiones y flujos, con los índices por id.
  function stepModel(scene, i) {
    const st = scene.steps[i] || {};
    const nodes = {};
    for (const n of st.nodes || []) if (n && n.id && Array.isArray(n.at)) nodes[n.id] = n;
    const links = {};
    for (const l of st.links || []) if (l && l.id && nodes[l.from] && nodes[l.to]) links[l.id] = l;
    return { st, nodes, links };
  }

  // El encuadre es el mismo en todos los pasos de la escena, para que el plano no salte.
  function frame(scene) {
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const st of scene.steps || []) {
      for (const n of st.nodes || []) {
        if (!Array.isArray(n.at)) continue;
        const p = pos(n);
        const half = Math.max(46, (tw(n.label || '', 12.5) + 22) / 2, n.items ? (n.items.length * 44) / 2 : 0);
        x0 = Math.min(x0, p.x - half); x1 = Math.max(x1, p.x + half);
        y0 = Math.min(y0, p.y - (n.badge || n.load != null ? 66 : 48));
        y1 = Math.max(y1, p.y + 42 + (n.note ? 15 : 0) + (n.items ? 20 : 0));
      }
      for (const z of st.zones || []) {
        x0 = Math.min(x0, z.from[0] * CX - 62); x1 = Math.max(x1, z.to[0] * CX + 62);
        y0 = Math.min(y0, z.from[1] * CY - 82); y1 = Math.max(y1, z.to[1] * CY + 70);
      }
      if (st.ring) {
        const r = st.ring.radius * CX;
        x0 = Math.min(x0, st.ring.center[0] * CX - r - 10); x1 = Math.max(x1, st.ring.center[0] * CX + r + 10);
        y0 = Math.min(y0, st.ring.center[1] * CY - r - 30); y1 = Math.max(y1, st.ring.center[1] * CY + r + 10);
      }
    }
    if (!Number.isFinite(x0)) return { x: -100, y: -100, w: 200, h: 200 };
    const pad = 10;
    return { x: fx(x0 - pad), y: fx(y0 - pad), w: fx(x1 - x0 + 2 * pad), h: fx(y1 - y0 + 2 * pad) };
  }

  // ---------- drawing ----------
  function icon(kind, x, y, size, cls) {
    const d = ICONS[kind] || ICONS.service;
    const s = size / 24;
    return `<g class="${cls || 'n-ico'}" transform="translate(${fx(x - size / 2)} ${fx(y - size / 2)}) scale(${Math.round(s * 1000) / 1000})" fill="none" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
  }
  function shape(n, x, y) {
    const [form] = KIND[n.kind] || KIND.service;
    if (form === 'block') {
      const w = 28;
      const top = `${x},${y - 28} ${x + w},${y - 14} ${x},${y} ${x - w},${y - 14}`;
      const left = `${x - w},${y - 14} ${x},${y} ${x},${y + 18} ${x - w},${y + 4}`;
      const right = `${x},${y} ${x + w},${y - 14} ${x + w},${y + 4} ${x},${y + 18}`;
      return `<polygon class="f-l" points="${left}"/><polygon class="f-r" points="${right}"/><polygon class="f-t" points="${top}"/>` + icon(n.kind, x, y - 14, 15);
    }
    if (form === 'cyl') {
      const rx = 25;
      const ry = 9;
      const t = y - 20;
      const b = y + 12;
      return `<path class="f-l" d="M${x - rx},${t} L${x - rx},${b} A${rx},${ry} 0 0 0 ${x + rx},${b} L${x + rx},${t} Z"/>` +
        `<path class="f-r" d="M${x},${t + ry} L${x},${b + ry} A${rx},${ry} 0 0 0 ${x + rx},${b} L${x + rx},${t} A${rx},${ry} 0 0 1 ${x},${t + ry} Z"/>` +
        `<ellipse class="f-t" cx="${x}" cy="${t}" rx="${rx}" ry="${ry}"/>` + icon(n.kind, x, y + 2, 14);
    }
    if (form === 'slab' || form === 'crowd') {
      const w = form === 'crowd' ? 40 : 34;
      const h = w / 2;
      const top = `${x},${y - h + 4} ${x + w},${y + 4} ${x},${y + h + 4} ${x - w},${y + 4}`;
      const left = `${x - w},${y + 4} ${x},${y + h + 4} ${x},${y + h + 10} ${x - w},${y + 10}`;
      const right = `${x},${y + h + 4} ${x + w},${y + 4} ${x + w},${y + 10} ${x},${y + h + 10}`;
      let on = '';
      if (form === 'crowd') {
        const ppl = [[-17, 2], [-6, -4], [6, -8], [16, -2], [-10, 9], [3, 5], [14, 9]];
        on = ppl.map(([dx, dy], k) => `<g class="person p${k % 4}"><rect x="${x + dx - 3.6}" y="${y + dy - 9}" width="7.2" height="10" rx="3.4"/><circle cx="${x + dx}" cy="${y + dy - 12}" r="3.4"/></g>`).join('');
      } else {
        on = `<polygon class="screen" points="${x - 15},${y - 22} ${x + 12},${y - 30} ${x + 12},${y - 8} ${x - 15},${y}"/><polygon class="screen-in" points="${x - 12},${y - 20} ${x + 9},${y - 26.5} ${x + 9},${y - 10} ${x - 12},${y - 3.5}"/>`;
      }
      return `<polygon class="f-l" points="${left}"/><polygon class="f-r" points="${right}"/><polygon class="f-t" points="${top}"/>${on}`;
    }
    // cloud (external)
    return `<path class="f-t" transform="translate(${x - 30} ${y - 30}) scale(2.5)" d="${'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z'}"/>` + icon(n.kind === 'external' ? 'cdn' : n.kind, x, y - 4, 14);
  }
  function pill(x, y, text, cls, size, mono) {
    const w = tw(text, size, mono) + 16;
    const h = size + 8;
    return `<g class="${cls}"><rect x="${fx(x - w / 2)}" y="${fx(y - h / 2)}" width="${fx(w)}" height="${h}" rx="${h / 2}"/><text x="${x}" y="${fx(y + size * 0.36)}" text-anchor="middle">${esc(text)}</text></g>`;
  }
  function nodeSvg(n, isNew) {
    const { x, y } = pos(n);
    const [form, hue] = KIND[n.kind] || KIND.service;
    const st = ['ok', 'hot', 'down', 'dim'].includes(n.state) ? n.state : 'ok';
    let out = `<g class="node h-${hue} s-${st}${isNew ? ' is-new' : ''}" data-id="${esc(n.id)}">`;
    if (n.mark === 'good' || n.mark === 'bad') {
      const w = form === 'crowd' ? 52 : 42;
      out += `<polygon class="halo halo-${n.mark}" points="${x},${y - w / 2 + 12} ${x + w},${y + 12} ${x},${y + w / 2 + 12} ${x - w},${y + 12}"/>`;
    }
    if (st === 'hot') out += `<ellipse class="glow" cx="${x}" cy="${y - 4}" rx="44" ry="34"/>`;
    out += `<g class="body">${shape(n, x, y)}</g>`;
    if (st === 'down') out += `<g class="down-x"><path d="M${x - 11},${y - 23} l22,22 M${x + 11},${y - 23} l-22,22"/></g>`;
    // badge above: a load bar and/or a short text
    if (n.load != null || n.badge) {
      const load = n.load != null ? Math.max(0, Math.min(1, Number(n.load))) : null;
      const text = n.badge || (load != null ? `${Math.round(load * 100)} %` : '');
      const bar = load != null ? 30 : 0;
      const w = tw(text, 11, true) + 16 + (bar ? bar + 6 : 0);
      const by = y - 52;
      const lvl = load == null ? '' : load >= 0.85 ? 'bad' : load >= 0.6 ? 'mid' : 'good';
      out += `<g class="badge"><rect x="${fx(x - w / 2)}" y="${by - 9}" width="${fx(w)}" height="18" rx="9"/>` +
        (bar ? `<rect class="bar-bg" x="${fx(x - w / 2 + 8)}" y="${by - 2.5}" width="${bar}" height="5" rx="2.5"/><rect class="bar ${lvl}" x="${fx(x - w / 2 + 8)}" y="${by - 2.5}" width="${fx(bar * load)}" height="5" rx="2.5"/>` : '') +
        `<text x="${fx(x - w / 2 + 8 + (bar ? bar + 6 : 0))}" y="${by + 4}">${esc(text)}</text></g>`;
    }
    const ly = y + (form === 'crowd' ? 40 : form === 'slab' ? 36 : 33);
    if (n.label) out += pill(x, ly, n.label, 'label', 12.5, false);
    let ny = ly + 16;
    if (n.note) { out += `<text class="note" x="${x}" y="${ny + 2}" text-anchor="middle">${esc(n.note)}</text>`; ny += 14; }
    if (Array.isArray(n.items) && n.items.length) {
      const items = n.items.slice(0, 4);
      const widths = items.map((t) => tw(t, 10, true) + 10);
      const total = widths.reduce((a, b) => a + b, 0) + (items.length - 1) * 4;
      let ix = x - total / 2;
      out += '<g class="items">' + items.map((t, k) => { const w = widths[k]; const g = `<rect x="${fx(ix)}" y="${ny - 6}" width="${fx(w)}" height="15" rx="4"/><text x="${fx(ix + w / 2)}" y="${ny + 5}" text-anchor="middle">${esc(t)}</text>`; ix += w + 4; return g; }).join('') + '</g>';
    }
    return out + '</g>';
  }
  function linkSvg(l, g) {
    const st = ['ok', 'hot', 'down', 'dim'].includes(l.state) ? l.state : 'ok';
    const d = g.C ? `M${fx(g.P0.x)},${fx(g.P0.y)} Q${fx(g.C.x)},${fx(g.C.y)} ${fx(g.P2.x)},${fx(g.P2.y)}` : `M${fx(g.P0.x)},${fx(g.P0.y)} L${fx(g.P2.x)},${fx(g.P2.y)}`;
    let out = `<path class="link s-${st}${l.dashed ? ' dashed' : ''}" d="${d}"${l.arrow ? ' marker-end="url(#sc-arrow)"' : ''}/>`;
    if (l.label) {
      const m = pointAt(g, 0.5);
      out += pill(fx(m.x), fx(m.y), l.label, 'link-label', 11, true);
    }
    return out;
  }

  // El SVG de un paso. prev: el paso anterior (para animar lo que aparece).
  function svg(scene, i, opts = {}) {
    const { st, nodes, links } = stepModel(scene, i);
    const prev = i > 0 ? stepModel(scene, i - 1).nodes : null;
    const f = frame(scene);
    let out = `<svg class="scene-svg" viewBox="${f.x} ${f.y} ${f.w} ${f.h}" role="img" aria-label="${esc(opts.label || st.title || '')}" xmlns="http://www.w3.org/2000/svg">` +
      '<defs><marker id="sc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9z" class="arrow-head"/></marker></defs>';
    out += '<g class="zones">';
    for (const z of st.zones || []) {
      const x = z.from[0] * CX - 58;
      const y = z.from[1] * CY - 70;
      const w = (z.to[0] - z.from[0]) * CX + 116;
      const h = (z.to[1] - z.from[1]) * CY + 132;
      out += `<g class="zone ${z.tone ? 'z-' + esc(z.tone) : ''}"><rect x="${fx(x)}" y="${fx(y)}" width="${fx(w)}" height="${fx(h)}" rx="16"/><text x="${fx(x + 12)}" y="${fx(y + 17)}">${esc(z.label || '')}</text></g>`;
    }
    if (st.ring) {
      const c = { x: st.ring.center[0] * CX, y: st.ring.center[1] * CY - 6 };
      const r = st.ring.radius * CX;
      // Marcas sobre el anillo (p. ej. virtual nodes): a = grados desde arriba, en el sentido del reloj; c = color 0-3.
      const ticks = (Array.isArray(st.ring.ticks) ? st.ring.ticks : []).map((t) => {
        const a = ((Number(t.a) || 0) * Math.PI) / 180;
        return `<circle class="tick p${(Number(t.c) || 0) % 4}" cx="${fx(c.x + r * Math.sin(a))}" cy="${fx(c.y - r * Math.cos(a))}" r="5.5"/>`;
      }).join('');
      out += `<g class="ring"><circle class="track" cx="${fx(c.x)}" cy="${fx(c.y)}" r="${fx(r)}"/>${ticks}${st.ring.label ? pill(fx(c.x), fx(c.y - r), st.ring.label, 'link-label', 11, true) : ''}</g>`;
    }
    out += '</g><g class="links">';
    for (const l of Object.values(links)) { const g = linkGeom(l, nodes); if (g) out += linkSvg(l, g); }
    out += '</g><g class="packets"></g><g class="nodes">';
    const order = Object.values(nodes).sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
    for (const n of order) out += nodeSvg(n, prev ? !prev[n.id] : false);
    out += '</g><g class="fx"></g>';
    if (opts.still) out += staticPackets(scene, i);
    return out + '</svg>';
  }

  // ---------- flows ----------
  function flowRoutes(scene, i) {
    const { st, nodes, links } = stepModel(scene, i);
    const geo = {};
    for (const [id, l] of Object.entries(links)) geo[id] = linkGeom(l, nodes);
    return (st.flows || []).map((f) => {
      const via = Array.isArray(f.via) ? f.via : [];
      return { f, via, geo, links, kind: PACKETS.includes(f.kind) ? f.kind : 'req', rate: Math.max(0.15, Math.min(8, Number(f.rate) || 1)) };
    }).filter((r) => r.via.length);
  }
  // Un recorrido concreto: elige rama donde la haya y orienta cada tramo para que sea continuo.
  function buildPath(route, pick) {
    const ids = route.via.map((v, k) => (Array.isArray(v) ? v[pick(k, v.length)] : v)).filter((id) => route.geo[id]);
    const segs = [];
    let at = null;
    ids.forEach((id, k) => {
      const l = route.links[id];
      let fwd = true;
      if (at) fwd = l.from === at || l.to !== at;
      else if (k + 1 < ids.length) { const nx = route.links[ids[k + 1]]; fwd = !(nx && (nx.from === l.from || nx.to === l.from)); }
      segs.push({ g: route.geo[id], fwd, len: segLength(route.geo[id]) });
      at = fwd ? l.to : l.from;
    });
    const total = segs.reduce((a, s) => a + s.len, 0);
    return { segs, total };
  }
  function pathPoint(path, dist) {
    let d = dist;
    for (const s of path.segs) {
      if (d <= s.len) { const t = s.len ? d / s.len : 0; return pointAt(s.g, s.fwd ? t : 1 - t); }
      d -= s.len;
    }
    const last = path.segs[path.segs.length - 1];
    return last ? pointAt(last.g, last.fwd ? 1 : 0) : { x: 0, y: 0 };
  }
  function reversePath(path) { return { segs: path.segs.slice().reverse().map((s) => ({ ...s, fwd: !s.fwd })), total: path.total }; }

  function packetSvg(kind) {
    if (kind === 'heavy') return '<rect x="-6" y="-6" width="12" height="12" rx="2.5"/>';
    if (kind === 'event') return '<path d="M0 -6.5 6.5 0 0 6.5 -6.5 0z"/>';
    if (kind === 'write') return '<rect x="-5" y="-5" width="10" height="10" rx="1.5"/>';
    return '<circle r="5"/>';
  }
  // Sin animación: un par de paquetes quietos en cada recorrido.
  function staticPackets(scene, i) {
    let out = '<g class="packets-still">';
    for (const r of flowRoutes(scene, i)) {
      const p = buildPath(r, () => 0);
      for (const t of [0.35, 0.72]) { const q = pathPoint(p, p.total * t); out += `<g class="pk k-${r.kind}" transform="translate(${fx(q.x)} ${fx(q.y)})">${packetSvg(r.kind)}</g>`; }
    }
    return out + '</g>';
  }

  class Animator {
    constructor(svgEl, scene, i) {
      this.svg = svgEl;
      this.layer = svgEl.querySelector('.packets');
      this.fxLayer = svgEl.querySelector('.fx');
      this.routes = flowRoutes(scene, i).map((r) => ({ ...r, rr: 0, next: 0 }));
      this.packets = [];
      this.running = false;
      this.paused = false;
      this.raf = 0;
      this.last = 0;
      this.clock = 0;
    }
    spawn(r, birth, kind, path) {
      if (this.packets.length >= MAX_PACKETS) return;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.setAttribute('class', `pk k-${kind}`);
      el.innerHTML = packetSvg(kind);
      this.layer.appendChild(el);
      this.packets.push({ r, el, birth, kind, path });
    }
    emit(r, birth) {
      const pick = (k, n) => (r.f.pick === 'random' ? Math.floor(Math.random() * n) : (r.rr++) % n);
      const path = buildPath(r, pick);
      if (!path.total) return;
      this.spawn(r, birth, r.kind, path);
    }
    start(preroll = 2600) {
      if (!this.routes.length) return;
      this.running = true;
      this.clock = 0;
      this.routes.forEach((r, k) => { r.next = -preroll + (k * 1000) / (r.rate * this.routes.length); });
      this.step(0, true);
      this.last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min(100, now - this.last);
        this.last = now;
        if (!this.paused) { this.clock += dt; this.step(this.clock, false); }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    step(now, quiet) {
      for (const r of this.routes) {
        while (r.next <= now) { this.emit(r, r.next); r.next += 1000 / r.rate; }
      }
      const alive = [];
      for (const p of this.packets) {
        const dist = ((now - p.birth) / 1000) * SPEED;
        const end = p.r.f.failAt ? p.path.total * Math.max(0.1, Math.min(1, p.r.f.failAt)) : p.path.total;
        if (dist >= end) {
          p.el.remove();
          if (!quiet || dist < end + SPEED * 0.4) this.arrive(p, now, end, quiet);
          continue;
        }
        const q = pathPoint(p.path, dist);
        p.el.setAttribute('transform', `translate(${fx(q.x)} ${fx(q.y)})`);
        alive.push(p);
      }
      this.packets = alive;
    }
    arrive(p, now, end, quiet) {
      const f = p.r.f;
      const q = pathPoint(p.path, end);
      if (p.kind === 'fail' || f.fail || f.failAt) {
        if (!quiet) this.burst(q, 'bad');
        return;
      }
      if (f.back && p.kind !== f.back && p.isBack !== true) {
        const back = reversePath(p.path);
        const birth = p.birth + (end / SPEED) * 1000 + (Number(f.wait) || 0);
        this.spawn(p.r, birth, PACKETS.includes(f.back) ? f.back : 'resp', back);
        this.packets[this.packets.length - 1].isBack = true;
        return;
      }
      if (!quiet && f.pop) this.burst(q, 'good');
    }
    burst(q, tone) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `burst ${tone}`);
      g.setAttribute('transform', `translate(${fx(q.x)} ${fx(q.y)})`);
      g.innerHTML = tone === 'bad' ? '<circle r="9"/><path d="M-4 -4 4 4 M4 -4 -4 4"/>' : '<circle r="8"/>';
      this.fxLayer.appendChild(g);
      setTimeout(() => g.remove(), 700);
    }
    pause() { this.paused = true; }
    resume() { this.paused = false; this.last = performance.now(); }
    stop() { this.running = false; cancelAnimationFrame(this.raf); this.packets.forEach((p) => p.el.remove()); this.packets = []; }
  }

  // Lo que el paso enseña en la leyenda: los tipos de paquete que viajan y si hay piezas caídas.
  function legend(scene, i) {
    const { st, nodes } = stepModel(scene, i);
    const kinds = [];
    for (const f of st.flows || []) {
      const k = PACKETS.includes(f.kind) ? f.kind : 'req';
      if (!kinds.includes(k)) kinds.push(k);
      if (f.back && !kinds.includes(f.back)) kinds.push(f.back);
      if ((f.fail || f.failAt) && !kinds.includes('fail')) kinds.push('fail');
    }
    const names = { ...PACKET_LABEL, ...(scene.legend || {}) };
    const items = kinds.map((k) => ({ kind: k, label: names[k] || k }));
    if (Object.values(nodes).some((n) => n.state === 'down')) items.push({ kind: 'down', label: 'caído' });
    if (Object.values(nodes).some((n) => n.state === 'hot')) items.push({ kind: 'hot', label: 'saturado' });
    return items;
  }

  root.PlanosScene = { CX, CY, KINDS, PACKETS, ICONS, svg, frame, stepModel, flowRoutes, buildPath, legend, Animator, packetSvg };
})(typeof self !== 'undefined' ? self : window);
