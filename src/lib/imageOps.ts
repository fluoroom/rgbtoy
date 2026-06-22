const W = 384;
const GAP = 157;
const GAMMA = 0.75;

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

export async function unifyRGB(rFile: File, gFile: File, bFile: File): Promise<Blob> {
  const [rImg, gImg, bImg] = await Promise.all([rFile, gFile, bFile].map(loadImage));

  const w = rImg.width;
  const h = rImg.height;

  function toLuma(img: HTMLImageElement): Uint8Array {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d')!;
    cx.drawImage(img, 0, 0, w, h);
    const src = cx.getImageData(0, 0, w, h).data;
    const out = new Uint8Array(w * h);
    for (let i = 0; i < src.length; i += 4) {
      out[i >> 2] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    }
    return out;
  }

  const [rL, gL, bL] = [toLuma(rImg), toLuma(gImg), toLuma(bImg)];

  const final = document.createElement('canvas');
  final.width = w;
  final.height = h;
  const fc = final.getContext('2d')!;
  const out = fc.createImageData(w, h);
  for (let i = 0; i < rL.length; i++) {
    out.data[i * 4]     = rL[i];
    out.data[i * 4 + 1] = gL[i];
    out.data[i * 4 + 2] = bL[i];
    out.data[i * 4 + 3] = 255;
  }
  fc.putImageData(out, 0, 0);

  return canvasToBlob(final);
}
