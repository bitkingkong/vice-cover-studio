// shots.js — deterministic screenshot scenes for Vice Cover Studio.
// Reads the URL query (?shot=cover|editor, photo=, caption=, layout=,
// grade=, size=) and renders one fixed scene, then sets
// window.__shotReady = true so a headless screenshot can wait for it.

import { drawCover } from './cover.js';

export const SHOT_SIZES = {
  landscape: { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || '',
    photo: q.get('photo') || 'boulevard',
    caption: q.get('caption') || 'VICE NIGHTS',
    subtitle: q.get('subtitle') || 'A STORY IN THREE PANELS',
    layout: q.get('layout') || 'diagonal',
    grade: q.get('grade') || 'sunset',
    size: q.get('size') || 'landscape',
  };
}

function loadSampleImage(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `samples/${name}.jpg`;
  });
}

// Build the shared editor state for a shot: the sample photo fills
// every panel, each panel with its own zoom so the cover reads as
// three different crops of one photo.
export async function buildShotState(params) {
  const img = await loadSampleImage(params.photo);
  const photos = img ? [img] : [];
  const photoNames = img ? [`${params.photo}.jpg (sample)`] : [];
  const panels = [
    { photo: 0, zoom: 1.35, ox: -0.10, oy: 0.02 },
    { photo: 0, zoom: 1.15, ox: 0.12, oy: -0.06 },
    { photo: 0, zoom: 1.5, ox: 0.05, oy: 0.10 },
    { photo: 0, zoom: 1.25, ox: -0.05, oy: 0.0 },
  ];
  return {
    photos,
    photoNames,
    panels,
    layout: params.layout,
    grade: params.grade,
    title: params.caption,
    subtitle: params.subtitle,
    captionPos: 'bottom',
    captionSize: 1,
    captionColor: '#ffffff',
  };
}

// Render a cover-only shot: the canvas fills the whole viewport.
export async function renderCoverShot(canvas, params) {
  const size = SHOT_SIZES[params.size] || SHOT_SIZES.landscape;
  const state = await buildShotState(params);
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  await document.fonts.ready;
  drawCover(ctx, state, size.w, size.h);
  window.__shotReady = true;
  return state;
}

// Render the editor shot: hand the state back to main.js, which
// paints the live preview and marks the shot ready.
export async function renderEditorShot(params) {
  const state = await buildShotState(params);
  await document.fonts.ready;
  window.__shotReady = true;
  return state;
}
