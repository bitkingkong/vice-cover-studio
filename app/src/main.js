// main.js — Vice Cover Studio editor wiring.
// Uploads photos (file input + drag-drop + built-in samples), keeps one
// crop per panel (drag to pan, slider to zoom, photo picker per panel),
// edits the caption, switches layout / grade / export size, previews
// live on canvas and exports a PNG. Photos are read locally with
// FileReader and never uploaded anywhere.

import { drawCover, panelAt, GRADES, LAYOUTS } from './cover.js';
import { shotParams, renderCoverShot, renderEditorShot, SHOT_SIZES } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 · Square' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · Portrait' },
  landscape: { w: 1920, h: 1080, label: '1920 × 1080 · Landscape' },
};

const state = {
  photos: [], // HTMLImageElement list, index = photo slot
  photoNames: [],
  panels: [
    { photo: 0, zoom: 1, ox: 0, oy: 0 },
    { photo: 0, zoom: 1, ox: 0, oy: 0 },
    { photo: 0, zoom: 1, ox: 0, oy: 0 },
    { photo: 0, zoom: 1, ox: 0, oy: 0 },
  ],
  layout: 'diagonal',
  grade: 'sunset',
  title: 'VICE NIGHTS',
  subtitle: 'A STORY IN THREE PANELS',
  captionPos: 'bottom',
  captionSize: 1,
  captionColor: '#ffffff',
  exportSize: 'landscape',
  activePanel: 0,
};

function previewSize() {
  const s = EXPORT_SIZES[state.exportSize];
  return s.w >= s.h ? { w: 960, h: Math.round(960 * s.h / s.w) } : { w: Math.round(720 * s.w / s.h), h: 720 };
}

export function render() {
  const { w, h } = previewSize();
  canvas.width = w;
  canvas.height = h;
  drawCover(ctx, state, w, h);
}

function refreshPanelControls() {
  const p = state.panels[state.activePanel];
  $('zoom').value = p.zoom;
  $('zoomVal').textContent = `${Math.round(p.zoom * 100)}%`;
  $('panelPhoto').innerHTML = state.photoNames
    .map((n, i) => `<option value="${i}"${i === p.photo ? ' selected' : ''}>${escapeHtml(n)}</option>`)
    .join('');
  document.querySelectorAll('#panelTabs button').forEach((b, i) => {
    b.classList.toggle('active', i === state.activePanel);
    b.disabled = i >= (LAYOUTS[state.layout].panels);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function addPhoto(img, name) {
  state.photos.push(img);
  state.photoNames.push(name);
  refreshPhotoList();
  refreshPanelControls();
  render();
}

function refreshPhotoList() {
  const list = $('photoList');
  list.innerHTML = '';
  state.photoNames.forEach((name, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = name;
    chip.title = `Use this photo in panel ${state.activePanel + 1}`;
    chip.addEventListener('click', () => {
      state.panels[state.activePanel].photo = i;
      refreshPanelControls();
      render();
    });
    list.appendChild(chip);
  });
  $('photoCount').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded`;
}

function loadFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { addPhoto(img, file.name); resolve(true); };
      img.onerror = () => resolve(false);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}

async function loadSample(name) {
  const img = new Image();
  img.onload = () => { addPhoto(img, `${name}.jpg (sample)`); };
  img.src = `samples/${name}.jpg`;
}

function exportPng() {
  const size = EXPORT_SIZES[state.exportSize];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), state, size.w, size.h);
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    const slug = (state.title || 'vice-cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vice-cover';
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('exportNote').textContent = `Exported ${size.w} × ${size.h} PNG — check your downloads.`;
  }, 'image/png');
}

function bindControls() {
  $('fileInput').addEventListener('change', async (e) => {
    for (const f of e.target.files) await loadFile(f);
    e.target.value = '';
  });
  const drop = $('dropZone');
  drop.addEventListener('click', () => $('fileInput').click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    for (const f of e.dataTransfer.files) {
      if (f.type.startsWith('image/')) await loadFile(f);
    }
  });
  $('sampleBoulevard').addEventListener('click', () => loadSample('boulevard'));
  $('samplePier').addEventListener('click', () => loadSample('pier'));

  // Layout + grade pickers.
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.addEventListener('click', () => {
      state.layout = b.dataset.layout;
      document.querySelectorAll('[data-layout]').forEach((x) => x.classList.toggle('active', x === b));
      refreshPanelControls();
      render();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.addEventListener('click', () => {
      state.grade = b.dataset.grade;
      document.querySelectorAll('[data-grade]').forEach((x) => x.classList.toggle('active', x === b));
      render();
    });
  });

  // Caption.
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('captionSize').addEventListener('input', (e) => {
    state.captionSize = Number(e.target.value);
    $('captionSizeVal').textContent = `${Math.round(state.captionSize * 100)}%`;
    render();
  });
  $('captionPos').addEventListener('change', (e) => { state.captionPos = e.target.value; render(); });
  document.querySelectorAll('[data-caption-color]').forEach((b) => {
    b.addEventListener('click', () => {
      state.captionColor = b.dataset.captionColor;
      document.querySelectorAll('[data-caption-color]').forEach((x) => x.classList.toggle('active', x === b));
      render();
    });
  });

  // Per-panel crop.
  document.querySelectorAll('#panelTabs button').forEach((b, i) => {
    b.addEventListener('click', () => { state.activePanel = i; refreshPanelControls(); render(); });
  });
  $('zoom').addEventListener('input', (e) => {
    state.panels[state.activePanel].zoom = Number(e.target.value);
    $('zoomVal').textContent = `${Math.round(state.panels[state.activePanel].zoom * 100)}%`;
    render();
  });
  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[state.activePanel].photo = Number(e.target.value);
    render();
  });
  $('resetCrop').addEventListener('click', () => {
    state.panels[state.activePanel] = { photo: state.panels[state.activePanel].photo, zoom: 1, ox: 0, oy: 0 };
    refreshPanelControls();
    render();
  });

  // Drag on the preview pans the photo inside the panel under the cursor.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const slot = panelAt(state.layout, canvas.width, canvas.height, x, y);
    if (slot >= 0) {
      state.activePanel = slot;
      refreshPanelControls();
      drag = { slot, x, y, ox: state.panels[slot].ox, oy: state.panels[slot].oy };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const p = state.panels[drag.slot];
    p.ox = drag.ox + (x - drag.x) / canvas.width;
    p.oy = drag.oy + (y - drag.y) / canvas.height;
    render();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });

  // Export.
  $('exportSize').addEventListener('change', (e) => { state.exportSize = e.target.value; render(); });
  $('exportBtn').addEventListener('click', exportPng);
}

async function init() {
  bindControls();
  const params = shotParams();
  if (params.shot === 'cover') {
    document.body.classList.add('shot-cover');
    await renderCoverShot(canvas, params);
    return;
  }
  if (params.shot === 'editor') {
    const shotState = await renderEditorShot(params);
    Object.assign(state, shotState);
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    refreshPhotoList();
    refreshPanelControls();
    render();
    return;
  }
  // Normal editor: preload both samples so the first cover is one click away.
  await loadSample('boulevard');
  render();
  window.__shotReady = true;
}

init();
