const W = 384;
const GAP = 157;
const GAMMA = 0.75;
const MINI_GAP = 24;   // guided split: inter-strip gap
const VMARGIN = 24;    // guided split: top/bottom margin (= MINI_GAP → all 4 white bands equally spaced)
const MARK_R = 6;      // registration dot radius
const MARK_X = MARK_R + 2; // dot x-offset from each edge

function buildGammaLUT(gamma: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(Math.pow(i / 255, 1 / gamma) * 255);
  }
  return lut;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png'
    )
  );
}

// Scale image to W width, then center-crop vertically to targetH.
function normalizeToW(img: HTMLImageElement | HTMLCanvasElement, targetH: number): HTMLCanvasElement {
  const srcW = img instanceof HTMLImageElement ? img.width : img.width;
  const srcH = img instanceof HTMLImageElement ? img.height : img.height;
  const scaledH = Math.round(srcH * (W / srcW));

  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = scaledH;
  const tc = tmp.getContext('2d')!;
  tc.imageSmoothingEnabled = false;
  tc.drawImage(img, 0, 0, W, scaledH);

  const out = document.createElement('canvas');
  out.width = W; out.height = targetH;
  const oc = out.getContext('2d')!;
  const cropY = Math.floor((scaledH - targetH) / 2);
  oc.drawImage(tmp, 0, cropY, W, targetH, 0, 0, W, targetH);
  return out;
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, MARK_R, 0, Math.PI * 2);
  ctx.fill();
}

// Remove all-near-white rows from top and bottom of canvas.
// Skips MARK_X + MARK_R + 2 = 16px from each edge so registration dot
// columns don't prevent trimming of an otherwise-white border row.
function trimRows(canvas: HTMLCanvasElement, threshold = 245): HTMLCanvasElement {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const skip = MARK_X + MARK_R + 2;
  const rowIsWhite = (y: number) => {
    for (let x = skip; x < w - skip; x++) {
      const o = (y * w + x) * 4;
      if (data[o] < threshold || data[o + 1] < threshold || data[o + 2] < threshold) return false;
    }
    return true;
  };
  let top = 0, bot = h - 1;
  while (top < h && rowIsWhite(top)) top++;
  while (bot >= 0 && rowIsWhite(bot)) bot--;
  if (top > bot) return canvas;
  const out = document.createElement('canvas');
  out.width = w; out.height = bot - top + 1;
  out.getContext('2d')!.drawImage(canvas, 0, top, w, bot - top + 1, 0, 0, w, bot - top + 1);
  return out;
}


export async function splitRGB(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const h = Math.round(img.height * (W / img.width));

  const base = document.createElement('canvas');
  base.width = W;
  base.height = h;
  const ctx = base.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, W, h);

  const lut = buildGammaLUT(GAMMA);
  const imageData = ctx.getImageData(0, 0, W, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(imageData, 0, 0);

  function channel(idx: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = h;
    const cx = c.getContext('2d')!;
    const out = cx.createImageData(W, h);
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i + idx];
      out.data[i]     = v;
      out.data[i + 1] = v;
      out.data[i + 2] = v;
      out.data[i + 3] = 255;
    }
    cx.putImageData(out, 0, 0);
    return c;
  }

  const [rC, gC, bC] = [channel(0), channel(1), channel(2)];

  const final = document.createElement('canvas');
  final.width = W;
  final.height = h * 3 + GAP * 2;
  const fc = final.getContext('2d')!;
  fc.fillStyle = '#ffffff';
  fc.fillRect(0, 0, W, final.height);
  fc.drawImage(rC, 0, 0);
  fc.drawImage(gC, 0, h + GAP);
  fc.drawImage(bC, 0, h * 2 + GAP * 2);

  return canvasToBlob(final);
}

// Guided split: same channel extraction but with top/bottom margins and
// registration dots in white space so unifyRGBGuided can auto-detect strips.
export async function splitRGBGuided(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const h = Math.round(img.height * (W / img.width));

  const base = document.createElement('canvas');
  base.width = W; base.height = h;
  const ctx = base.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, W, h);

  const lut = buildGammaLUT(GAMMA);
  const imageData = ctx.getImageData(0, 0, W, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(imageData, 0, 0);

  function channel(idx: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W; c.height = h;
    const cx = c.getContext('2d')!;
    const out = cx.createImageData(W, h);
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i + idx];
      out.data[i] = v; out.data[i + 1] = v; out.data[i + 2] = v; out.data[i + 3] = 255;
    }
    cx.putImageData(out, 0, 0);
    return c;
  }

  const [rC, gC, bC] = [channel(0), channel(1), channel(2)];

  // Layout: [VMARGIN][R strip][MINI_GAP][G strip][MINI_GAP][B strip][VMARGIN]
  // VMARGIN = MINI_GAP → all 4 white bands equally spaced, makes unify detection symmetric.
  const totalH = VMARGIN * 2 + h * 3 + MINI_GAP * 2;
  const final = document.createElement('canvas');
  final.width = W; final.height = totalH;
  const fc = final.getContext('2d')!;
  fc.fillStyle = '#ffffff';
  fc.fillRect(0, 0, W, totalH);

  fc.drawImage(rC, 0, VMARGIN);
  fc.drawImage(gC, 0, VMARGIN + h + MINI_GAP);
  fc.drawImage(bC, 0, VMARGIN + 2 * h + MINI_GAP * 2);

  // 4 dot levels: top margin center, gap1 center, gap2 center, bottom margin center.
  const topCenter  = Math.floor(VMARGIN / 2);
  const gap1Center = VMARGIN + h + Math.floor(MINI_GAP / 2);
  const gap2Center = VMARGIN + 2 * h + MINI_GAP + Math.floor(MINI_GAP / 2);
  const botCenter  = totalH - 1 - Math.floor(VMARGIN / 2);
  for (const yc of [topCenter, gap1Center, gap2Center, botCenter]) {
    drawMark(fc, MARK_X, yc);
    drawMark(fc, W - MARK_X, yc);
  }

  return canvasToBlob(final);
}

export async function unifyRGB(rFile: File, gFile: File, bFile: File): Promise<Blob> {
  const [rImg, gImg, bImg] = await Promise.all([rFile, gFile, bFile].map(loadImage));

  // Normalize all to W width, center-crop to minimum scaled height.
  const heights = [rImg, gImg, bImg].map(img => Math.round(img.height * (W / img.width)));
  const h = Math.min(...heights);

  function toLuma(img: HTMLImageElement): Uint8Array {
    const norm = normalizeToW(img, h);
    const cx = norm.getContext('2d')!;
    const src = cx.getImageData(0, 0, W, h).data;
    const out = new Uint8Array(W * h);
    for (let i = 0; i < src.length; i += 4) {
      out[i >> 2] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    }
    return out;
  }

  const [rL, gL, bL] = [toLuma(rImg), toLuma(gImg), toLuma(bImg)];

  const final = document.createElement('canvas');
  final.width = W; final.height = h;
  const fc = final.getContext('2d')!;
  const out = fc.createImageData(W, h);
  for (let i = 0; i < rL.length; i++) {
    out.data[i * 4]     = rL[i];
    out.data[i * 4 + 1] = gL[i];
    out.data[i * 4 + 2] = bL[i];
    out.data[i * 4 + 3] = 255;
  }
  fc.putImageData(out, 0, 0);
  return canvasToBlob(trimRows(final));
}

// Single-photo guided unify: finds the 2 pure-white inter-strip gaps by looking
// for the widest bright horizontal bands, then extracts R/G/B strips around them.
// This is robust to the 3 strips having very different brightness levels.
export async function unifyRGBGuided(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const pw = img.width, ph = img.height;

  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = pw; photoCanvas.height = ph;
  const photoCtx = photoCanvas.getContext('2d')!;
  photoCtx.drawImage(img, 0, 0);
  const photoData = photoCtx.getImageData(0, 0, pw, ph).data;

  // Row-average brightness (0=black, 255=white).
  const rowBright = new Float32Array(ph);
  for (let y = 0; y < ph; y++) {
    let sum = 0;
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4;
      sum += 0.299 * photoData[i] + 0.587 * photoData[i + 1] + 0.114 * photoData[i + 2];
    }
    rowBright[y] = sum / pw;
  }

  // Light smoothing — small window to preserve narrow gaps without erasing them.
  const win = Math.max(2, Math.floor(ph / 500));
  const smooth = new Float32Array(ph);
  for (let y = 0; y < ph; y++) {
    let s = 0, c = 0;
    for (let dy = -win; dy <= win; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < ph) { s += rowBright[yy]; c++; }
    }
    smooth[y] = s / c;
  }

  // Gap1 is always at ~33% and gap2 at ~66% of print height regardless of
  // source aspect ratio (strips are equal, gaps are small). Find the brightness
  // peak in each expected y-range — the gap (white paper) is always the
  // brightest row in its range, even when strip content is very light.
  type Band = { top: number; bot: number };

  function findPeak(lo: number, hi: number): number {
    let best = lo, bestV = -1;
    for (let y = lo; y <= hi; y++) {
      if (smooth[y] > bestV) { bestV = smooth[y]; best = y; }
    }
    return best;
  }

  const g1c = findPeak(Math.floor(ph * 0.15), Math.floor(ph * 0.50));
  const g2c = findPeak(Math.floor(ph * 0.50), Math.floor(ph * 0.85));

  if (g2c - g1c < Math.floor(ph * 0.05)) {
    throw new Error('Could not find the 2 gaps. Frame the photo to show just the print, or use Manual mode.');
  }

  // Expand each peak outward while brightness stays ≥97% of the peak value.
  function findGapBand(center: number): Band {
    const thresh = smooth[center] * 0.97;
    let top = center, bot = center;
    while (top > 0 && smooth[top - 1] >= thresh) top--;
    while (bot < ph - 1 && smooth[bot + 1] >= thresh) bot++;
    return { top, bot };
  }

  const gap1Raw = findGapBand(g1c);
  const gap2Raw = findGapBand(g2c);

  // The 97% expansion stops exactly `win` rows inside the true gap boundary:
  // those edge rows blend win strip rows + win gap rows, pulling smooth below
  // threshold. Correct by restoring the win-row margin on each side.
  const gap1 = { top: Math.max(0, gap1Raw.top - win),    bot: Math.min(ph - 1, gap1Raw.bot + win) };
  const gap2 = { top: Math.max(0, gap2Raw.top - win),    bot: Math.min(ph - 1, gap2Raw.bot + win) };

  // G strip height: rows between the two corrected gaps (exact ground truth).
  const stripH = gap2.top - gap1.bot - 1;
  if (stripH <= 0) {
    throw new Error('Strip detection failed. Ensure the print is clearly visible, or use Manual mode.');
  }

  // Start with fallback: derive R/B extent from G-strip height.
  let strips: Band[] = [
    { top: Math.max(0, gap1.top - stripH), bot: gap1.top - 1 },
    { top: gap1.bot + 1,                   bot: gap2.top - 1 },
    { top: gap2.bot + 1,                   bot: Math.min(ph - 1, gap2.bot + stripH) },
  ];

  // Refine using top/bottom margins (present in guided prints with VMARGIN=MINI_GAP).
  // Equal spacing means: photo distance from gap1 to top margin = gap1-to-gap2 distance.
  const spacing = g2c - g1c;
  const expTop = Math.round(g1c - spacing);
  const expBot = Math.round(g2c + spacing);
  const searchR = Math.max(win * 4, Math.floor(spacing * 0.25));

  if (expTop - searchR >= 0 && expBot + searchR < ph) {
    const topY = findPeak(expTop - searchR, Math.min(ph - 1, expTop + searchR));
    const botY = findPeak(Math.max(0, expBot - searchR), Math.min(ph - 1, expBot + searchR));
    const minGapBright = Math.min(smooth[g1c], smooth[g2c]);

    if (smooth[topY] > minGapBright * 0.80 && smooth[botY] > minGapBright * 0.80) {
      const topRaw = findGapBand(topY);
      const botRaw = findGapBand(botY);
      const topBand = { top: Math.max(0, topRaw.top - win), bot: Math.min(ph - 1, topRaw.bot + win) };
      const botBand = { top: Math.max(0, botRaw.top - win), bot: Math.min(ph - 1, botRaw.bot + win) };
      const rH = gap1.top - topBand.bot - 1;
      const bH = botBand.top - gap2.bot - 1;
      if (rH > 0 && bH > 0) {
        strips = [
          { top: topBand.bot + 1, bot: gap1.top - 1 },
          { top: gap1.bot + 1,    bot: gap2.top - 1 },
          { top: gap2.bot + 1,    bot: botBand.top - 1 },
        ];
      }
    }
  }

  // X extent: sample the TOP QUARTER of each gap (before the dot, which sits
  // at the gap center) to get clean white-paper column brightness values.
  const gapSample: number[] = [];
  for (const g of [gap1, gap2]) {
    const gH = g.bot - g.top + 1;
    const topQ = Math.max(1, Math.floor(gH / 4));
    for (let y = g.top; y < g.top + topQ; y++) gapSample.push(y);
  }

  const colBright = new Float32Array(pw);
  for (let x = 0; x < pw; x++) {
    let s = 0;
    for (const y of gapSample) {
      const i = (y * pw + x) * 4;
      s += 0.299 * photoData[i] + 0.587 * photoData[i + 1] + 0.114 * photoData[i + 2];
    }
    colBright[x] = gapSample.length > 0 ? s / gapSample.length : 255;
  }

  let maxColBright = 0;
  for (let x = 0; x < pw; x++) if (colBright[x] > maxColBright) maxColBright = colBright[x];
  const colThresh = maxColBright * 0.80;
  let xLeft = 0, xRight = pw - 1;
  for (let x = 0; x < pw; x++) { if (colBright[x] >= colThresh) { xLeft = x; break; } }
  for (let x = pw - 1; x >= 0; x--) { if (colBright[x] >= colThresh) { xRight = x; break; } }
  const stripW = xRight - xLeft + 1;

  // Scale each strip to W width maintaining aspect ratio, then center-crop
  // vertically to the minimum scaled height across the 3 strips.
  const scaledHeights = strips.map(s => Math.round((s.bot - s.top + 1) * W / stripW));
  const outH = Math.max(1, Math.min(...scaledHeights));

  function extractLuma(strip: Band): Uint8Array {
    const stripH = strip.bot - strip.top + 1;
    // Source rows that correspond to outH output rows at this strip's scale.
    const srcH = Math.round(outH * stripW / W);
    const srcY = strip.top + Math.floor((stripH - srcH) / 2);

    const sc = document.createElement('canvas');
    sc.width = W; sc.height = outH;
    const scx = sc.getContext('2d')!;
    scx.drawImage(photoCanvas, xLeft, srcY, stripW, srcH, 0, 0, W, outH);
    const src = scx.getImageData(0, 0, W, outH).data;
    const out = new Uint8Array(W * outH);
    for (let i = 0; i < src.length; i += 4) {
      out[i >> 2] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    }
    return out;
  }

  const [rL, gL, bL] = strips.map(extractLuma);

  const final = document.createElement('canvas');
  final.width = W; final.height = outH;
  const fc = final.getContext('2d')!;
  const out = fc.createImageData(W, outH);
  for (let i = 0; i < rL.length; i++) {
    out.data[i * 4]     = rL[i];
    out.data[i * 4 + 1] = gL[i];
    out.data[i * 4 + 2] = bL[i];
    out.data[i * 4 + 3] = 255;
  }
  fc.putImageData(out, 0, 0);
  return canvasToBlob(trimRows(final));
}
