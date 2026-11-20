// cover.js — Vice Cover Studio poster renderer.
// Draws an original multi-panel GTA-style cover on any 2d canvas:
// slanted comic panels, a Vice City sunset / neon / noir grade,
// hand-drawn palm + skyline silhouettes, grain, vignette and bold
// outlined caption lettering. No Rockstar artwork, logo or font.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#ff9a3d', '#ff5e7a', '#b04df0', '#3b1d8f'],
    tint: 'rgba(255, 94, 122, 0.16)',
    warm: 'rgba(255, 154, 61, 0.20)',
    accent: '#ffd166',
    ink: '#1b1035',
  },
  neon: {
    label: 'Neon',
    sky: ['#00e5ff', '#7c4dff', '#ff2fb3', '#12002e'],
    tint: 'rgba(0, 229, 255, 0.14)',
    warm: 'rgba(255, 47, 179, 0.18)',
    accent: '#00e5ff',
    ink: '#0a0618',
  },
  noir: {
    label: 'Noir',
    sky: ['#3a3a44', '#17171f', '#0b0b10', '#000000'],
    tint: 'rgba(120, 130, 160, 0.14)',
    warm: 'rgba(255, 255, 255, 0.05)',
    accent: '#f5f0e6',
    ink: '#000000',
  },
};

export const LAYOUTS = {
  diagonal: { label: '3-Panel Diagonal', panels: 3 },
  grid: { label: '4-Panel Grid', panels: 4 },
  hero: { label: 'Hero + Strip', panels: 4 },
};

// Seeded pseudo-random so grain is identical on every render.
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Panel shapes for a layout, as polygons in unit space [0..1] x [0..1].
// Each panel also carries its own photo slot index.
export function panelShapes(layout, w, h) {
  const slant = w * 0.045;
  if (layout === 'grid') {
    const g = w * 0.012;
    return [
      { poly: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]], slot: 0 },
      { poly: [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]], slot: 1 },
      { poly: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]], slot: 2 },
      { poly: [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]], slot: 3 },
    ].map((p) => ({ ...p, poly: p.poly.map(([x, y]) => [x * w, y * h]), gap: g }));
  }
  if (layout === 'hero') {
    const stripY = h * 0.68;
    return [
      { poly: [[0, 0], [w, 0], [w, stripY], [0, stripY]], slot: 0 },
      { poly: [[0, stripY], [w / 3, stripY], [w / 3, h], [0, h]], slot: 1 },
      { poly: [[w / 3, stripY], [(2 * w) / 3, stripY], [(2 * w) / 3, h], [w / 3, h]], slot: 2 },
      { poly: [[(2 * w) / 3, stripY], [w, stripY], [w, h], [(2 * w) / 3, h]], slot: 3 },
    ].map((p) => ({ ...p, gap: w * 0.012 }));
  }
  // diagonal: three slanted vertical panels
  return [
    { poly: [[0, 0], [w * 0.36, 0], [w * 0.28, h], [0, h]], slot: 0 },
    { poly: [[w * 0.36, 0], [w * 0.70, 0], [w * 0.62, h], [w * 0.28, h]], slot: 1 },
    { poly: [[w * 0.70, 0], [w, 0], [w, h], [w * 0.62, h]], slot: 2 },
  ].map((p) => ({ ...p, gap: w * 0.010 }));
}

function drawPhotoCover(ctx, img, poly, panel, w, h) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const pw = x1 - x0;
  const ph = y1 - y0;
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  // Fallback gradient when a panel has no photo yet.
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, '#2b1b4d');
  grad.addColorStop(1, '#120a24');
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, pw, ph);
  if (img && img.naturalWidth) {
    const zoom = panel.zoom || 1;
    const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const ox = (panel.ox || 0) * pw;
    const oy = (panel.oy || 0) * ph;
    ctx.drawImage(img, x0 + (pw - dw) / 2 + ox, y0 + (ph - dh) / 2 + oy, dw, dh);
  }
  ctx.restore();
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(18, -70, 6, -150);
  ctx.stroke();
  // Fronds fanning from the crown, drooping at the tips.
  for (let i = 0; i < 9; i++) {
    const a = (-Math.PI * 0.95 + i * (Math.PI * 0.9) / 8);
    const len = 105 - Math.abs(i - 4) * 10;
    const tx = Math.cos(a) * len;
    const ty = -150 + Math.sin(a) * len * 0.6;
    ctx.beginPath();
    ctx.moveTo(6, -150);
    ctx.quadraticCurveTo(6 + tx * 0.55, -150 + ty * 0.35 - 30, 6 + tx, -150 + ty + 34);
    ctx.lineWidth = 9;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(6, -150, 11, 0, Math.PI * 2);
  ctx.fill();
  // Coconut cluster under the crown.
  ctx.beginPath();
  ctx.arc(-2, -138, 7, 0, Math.PI * 2);
  ctx.arc(14, -136, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSkyline(ctx, w, h, color) {
  const rand = seededRandom(20261120);
  ctx.save();
  ctx.fillStyle = color;
  let x = 0;
  const base = h * 0.985;
  while (x < w) {
    const bw = w * (0.05 + rand() * 0.07);
    const bh = h * (0.10 + rand() * 0.22);
    ctx.fillRect(x, base - bh, bw, bh);
    // Rooftop antenna on some towers.
    if (rand() > 0.6) {
      ctx.fillRect(x + bw / 2 - 1.5, base - bh - h * 0.05, 3, h * 0.05);
    }
    x += bw + w * 0.008;
  }
  ctx.restore();
}

function drawGrade(ctx, grade, w, h) {
  const sky = ctx.createLinearGradient(0, 0, w, h);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, w, h);
  const warm = ctx.createRadialGradient(w * 0.5, h * 0.12, 10, w * 0.5, h * 0.12, w * 0.75);
  warm.addColorStop(0, grade.warm);
  warm.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrain(ctx, w, h) {
  const rand = seededRandom(777);
  const n = Math.floor((w * h) / 2600);
  ctx.save();
  ctx.globalAlpha = 0.10;
  for (let i = 0; i < n; i++) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * w, rand() * h, 1.6, 1.6);
  }
  ctx.restore();
  // Vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawCaption(ctx, state, grade, w, h) {
  const title = (state.title || '').trim();
  const sub = (state.subtitle || '').trim();
  if (!title && !sub) return;
  const pos = state.captionPos || 'bottom';
  const sizeScale = state.captionSize || 1;
  const color = state.captionColor || '#ffffff';
  const cx = w / 2;
  // Lay the whole caption out as one block, then centre that block on
  // the anchor point and clamp it inside the canvas, so the subtitle
  // can never be pushed off the bottom edge on wide covers.
  const titleFs = w * 0.115 * sizeScale;
  const subFs = w * 0.038 * sizeScale;
  let titleLines = [];
  if (title) {
    ctx.font = `${titleFs}px Anton, "Bebas Neue", Impact, sans-serif`;
    ctx.letterSpacing = `${Math.round(w * 0.006)}px`;
    titleLines = wrapLines(ctx, title.toUpperCase(), w * 0.92);
  }
  const titleH = titleLines.length * titleFs * 1.02;
  const subH = sub ? subFs * 1.6 : 0;
  const blockH = titleH + subH;
  const anchorY = pos === 'top' ? h * 0.16 : pos === 'middle' ? h * 0.52 : h * 0.84;
  let top = anchorY - blockH / 2;
  top = clamp(top, h * 0.03, h * 0.97 - blockH);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (title) {
    ctx.font = `${titleFs}px Anton, "Bebas Neue", Impact, sans-serif`;
    ctx.letterSpacing = `${Math.round(w * 0.006)}px`;
    const lineH = titleFs * 1.02;
    titleLines.forEach((line, i) => {
      const y = top + lineH / 2 + i * lineH;
      ctx.lineWidth = titleFs * 0.14;
      ctx.strokeStyle = grade.ink;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = titleFs * 0.10;
      ctx.shadowOffsetY = titleFs * 0.06;
      ctx.strokeText(line, cx, y);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = color;
      ctx.fillText(line, cx, y);
      // Thin accent underline on the last line (only when there is
      // no subtitle beneath it, so the bar never strikes the subtitle).
      if (i === titleLines.length - 1 && !sub) {
        const tw = ctx.measureText(line).width;
        ctx.fillStyle = grade.accent;
        ctx.fillRect(cx - tw / 2, y + titleFs * 0.62, tw, Math.max(3, titleFs * 0.055));
      }
    });
  }
  if (sub) {
    ctx.font = `700 ${subFs}px Inter, system-ui, sans-serif`;
    ctx.letterSpacing = `${Math.round(w * 0.012)}px`;
    const y = top + titleH + subFs * 0.8;
    ctx.lineWidth = subFs * 0.22;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineJoin = 'round';
    ctx.strokeText(sub.toUpperCase(), cx, y);
    ctx.fillStyle = grade.accent;
    ctx.fillText(sub.toUpperCase(), cx, y);
  }
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// Main entry: render the whole cover into ctx at size w x h.
export function drawCover(ctx, state, w, h) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = state.layout || 'diagonal';
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#120a24';
  ctx.fillRect(0, 0, w, h);
  const shapes = panelShapes(layout, w, h);
  const photos = state.photos || [];
  shapes.forEach((shape) => {
    const panel = (state.panels && state.panels[shape.slot]) || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = photos[panel.photo] || null;
    drawPhotoCover(ctx, img, shape.poly, panel, w, h);
  });
  // Thick slanted panel dividers.
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(4, w * 0.012);
  ctx.lineJoin = 'round';
  shapes.forEach((shape) => {
    ctx.beginPath();
    shape.poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
  drawGrade(ctx, grade, w, h);
  // Silhouettes along the bottom edge, above the grade.
  ctx.save();
  ctx.globalAlpha = 0.9;
  drawSkyline(ctx, w, h, 'rgba(10, 4, 24, 0.55)');
  drawPalm(ctx, w * 0.06, h * 0.99, w / 1080 * 1.1, 'rgba(8, 3, 20, 0.92)');
  drawPalm(ctx, w * 0.93, h * 0.99, w / 1080 * 0.9, 'rgba(8, 3, 20, 0.92)');
  ctx.restore();
  drawCaption(ctx, state, grade, w, h);
  drawGrain(ctx, w, h);
  // Thin outer frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

// Hit-test: which panel slot contains point (x, y) in canvas space.
export function panelAt(layout, w, h, x, y) {
  const shapes = panelShapes(layout, w, h);
  for (const shape of shapes) {
    if (pointInPoly(x, y, shape.poly)) return shape.slot;
  }
  return -1;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export { clamp };
