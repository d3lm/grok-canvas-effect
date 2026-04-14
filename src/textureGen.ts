export interface GradientLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startOpacity: number;
  endOpacity: number;
  widthA: number;
  widthB: number;
  widthLocked: boolean;
  softnessA: number;
  softnessB: number;
  softnessLocked: boolean;
}

export interface BlueRadialControl {
  centerX: number;
  centerY: number;
  innerRadius: number;
  outerRadius: number;
  scaleY: number;
}

export const OUTPUT_WIDTH = 1200;
export const OUTPUT_HEIGHT = 576;

export interface TextureSettings {
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  edgeSharpness: number;
  softness: number;
  normalStrength: number;
  blueInnerBlur: number;
  blueOuterBlur: number;
  blueRadial: BlueRadialControl;
  gradients: GradientLine[];
}

export const DEFAULT_GRADIENTS: GradientLine[] = [
  {
    startX: 0.616,
    startY: 0.7562,
    endX: 0.7157,
    endY: 0.3943,
    startOpacity: 0.25,
    endOpacity: 1,
    widthA: 0.6,
    widthB: 0.3,
    widthLocked: true,
    softnessA: 0,
    softnessB: 0,
    softnessLocked: true,
  },
  {
    startX: 0.166,
    startY: 0.2004,
    endX: 0.5666,
    endY: 0.3764,
    startOpacity: 0.25,
    endOpacity: 1,
    widthA: 0.5,
    widthB: 0.6,
    widthLocked: true,
    softnessA: 0,
    softnessB: 0,
    softnessLocked: true,
  },
];

export const DEFAULT_SETTINGS: TextureSettings = {
  text: 'Grok',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 600,
  letterSpacing: 0,
  edgeSharpness: 0,
  softness: 0.35,
  normalStrength: 0.22,
  blueInnerBlur: 8,
  blueOuterBlur: 34,
  blueRadial: {
    centerX: 0.4101,
    centerY: 0.5064,
    innerRadius: 0.494,
    outerRadius: 0.8225,
    scaleY: 0.452,
  },
  gradients: DEFAULT_GRADIENTS,
};

export interface TextureChannels {
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
  alpha: Float32Array;
  packed: Uint8Array;
  width: number;
  height: number;
}

const MASK_THRESHOLD = 0.5;
const NORMAL_TARGET_RANGE = 0.44;

export function generateTexture(settings: TextureSettings): TextureChannels {
  const mask = rasterizeTextMask(settings);

  if (settings.edgeSharpness > 0) {
    const halfWidth = 0.5 * (1 - settings.edgeSharpness);
    const lo = 0.5 - Math.max(halfWidth, 1e-6);
    const hi = 0.5 + Math.max(halfWidth, 1e-6);

    for (let i = 0; i < mask.data.length; i++) {
      mask.data[i] = smoothstep(lo, hi, mask.data[i]);
    }
  }

  const size = mask.width * mask.height;

  const blueInnerBlur = Math.max(0, Math.min(settings.blueInnerBlur, settings.blueOuterBlur));
  const blueOuterBlur = Math.max(settings.blueInnerBlur, settings.blueOuterBlur);
  const blueInnerRadius = Math.max(0, Math.min(settings.blueRadial.innerRadius, settings.blueRadial.outerRadius));

  const blueOuterRadius = Math.max(
    blueInnerRadius + 1e-3,
    Math.max(settings.blueRadial.innerRadius, settings.blueRadial.outerRadius),
  );

  const red = new Float32Array(size);
  const green = new Float32Array(size);
  const blue = new Float32Array(size);
  const alpha = new Float32Array(size);
  const packed = new Uint8Array(size * 4);
  const gradientOpacityField = new Float32Array(size);
  const blueSource = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    const px = ((i % mask.width) + 0.5) / mask.width;
    const py = (Math.floor(i / mask.width) + 0.5) / mask.height;

    let gradientOpacity = 1;

    for (const grad of settings.gradients) {
      gradientOpacity *= projectGradientContribution(px, py, grad);
    }

    gradientOpacityField[i] = gradientOpacity;
    blueSource[i] = mask.data[i] * gradientOpacity;
  }

  const blueInnerField = blurField(blueSource, mask.width, mask.height, blueInnerBlur);
  const blueOuterField = blurField(blueSource, mask.width, mask.height, blueOuterBlur);

  for (let i = 0; i < size; i++) {
    const px = ((i % mask.width) + 0.5) / mask.width;
    const py = (Math.floor(i / mask.width) + 0.5) / mask.height;

    const gradientOpacity = gradientOpacityField[i];

    const baseMask = mask.data[i] * gradientOpacity;

    const blueMix = projectRadialBlend(
      px,
      py,
      settings.blueRadial.centerX,
      settings.blueRadial.centerY,
      blueInnerRadius,
      blueOuterRadius,
      settings.blueRadial.scaleY,
      mask.width,
      mask.height,
    );

    const bv = clamp(lerp(blueInnerField[i], blueOuterField[i], blueMix), 0, 1);
    const av = baseMask;

    blue[i] = bv;
    alpha[i] = av;
  }

  fillDirectionChannels(
    red,
    green,
    mask.data,
    mask.width,
    mask.height,
    settings.normalStrength,
    settings.softness,
    mask.scaledFontSize,
  );

  for (let i = 0; i < size; i++) {
    const rv = red[i];
    const gv = green[i];
    const bv = blue[i];
    const av = alpha[i];

    const pi = i * 4;

    packed[pi] = Math.round(rv * 255);
    packed[pi + 1] = Math.round(gv * 255);
    packed[pi + 2] = Math.round(bv * 255);
    packed[pi + 3] = Math.round(av * 255);
  }

  return { red, green, blue, alpha, packed, width: mask.width, height: mask.height };
}

export function channelToImageData(channel: Float32Array, width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < channel.length; i++) {
    const val = Math.round(channel[i] * 255);
    const pi = i * 4;

    data[pi] = val;
    data[pi + 1] = val;
    data[pi + 2] = val;
    data[pi + 3] = 255;
  }

  return imageData;
}

/**
 * Renders the packed texture as an opaque preview composited onto black,
 * since the raw RGBA with semi-transparent alpha is unreadable over a
 * checkerboard background.
 */
export function packedToImageData(packed: Uint8Array, width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    const alpha = packed[pi + 3] / 255;

    // preview the packed texture the way it is typically viewed: composited
    // onto black, rather than showing the hidden RGB data from transparent texels
    data[pi] = Math.round(packed[pi] * alpha);
    data[pi + 1] = Math.round(packed[pi + 1] * alpha);
    data[pi + 2] = Math.round(packed[pi + 2] * alpha);
    data[pi + 3] = 255;
  }

  return imageData;
}

interface RasterizedMask {
  data: Float32Array;
  width: number;
  height: number;
  scaledFontSize: number;
}

function rasterizeTextMask(settings: TextureSettings): RasterizedMask {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const fontSize = Math.max(1, settings.fontSize);
  const font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}`;
  const text = settings.text || ' ';
  const glyphs = Array.from(text);

  ctx.font = font;

  const metrics = ctx.measureText(text);

  let textWidth: number;

  if (settings.letterSpacing === 0) {
    textWidth = metrics.width;
  } else {
    const advances = glyphs.map((glyph) => ctx.measureText(glyph).width);

    textWidth =
      advances.reduce((sum, advance) => sum + advance, 0) + Math.max(0, glyphs.length - 1) * settings.letterSpacing;
  }

  const fieldRadius = computeFieldRadius(fontSize, settings.softness);

  const padding = Math.max(4, Math.ceil(fontSize * (0.18 + settings.softness * 0.22)));
  const expand = Math.max(fieldRadius * 2, Math.ceil(settings.blueOuterBlur * 4));

  const fullWidth = Math.ceil(textWidth + padding * 2 + expand * 2);
  const scale = Math.min(1, OUTPUT_WIDTH / Math.max(1, fullWidth));
  const scaledFontSize = fontSize * scale;
  const scaledFont = `${settings.fontWeight} ${scaledFontSize}px ${settings.fontFamily}`;
  const scaledSpacing = settings.letterSpacing * scale;

  ctx.font = scaledFont;

  const scaledMetrics = ctx.measureText(text);
  const scaledAscent = scaledMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
  const scaledDescent = scaledMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;

  let scaledTextWidth: number;

  if (scaledSpacing === 0) {
    scaledTextWidth = scaledMetrics.width;
  } else {
    const advances = glyphs.map((glyph) => ctx.measureText(glyph).width);

    scaledTextWidth =
      advances.reduce((sum, advance) => sum + advance, 0) + Math.max(0, glyphs.length - 1) * scaledSpacing;
  }

  const scaledTextHeight = scaledAscent + scaledDescent;

  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = scaledFont;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';

  const startX = (canvas.width - scaledTextWidth) / 2;
  const baselineY = (canvas.height - scaledTextHeight) / 2 + scaledAscent;

  if (scaledSpacing === 0) {
    ctx.fillText(glyphs.join(''), startX, baselineY);
  } else {
    let cx = startX;

    for (const glyph of glyphs) {
      ctx.fillText(glyph, cx, baselineY);
      cx += ctx.measureText(glyph).width + scaledSpacing;
    }
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const field = new Float32Array(canvas.width * canvas.height);

  for (let i = 0; i < field.length; i++) {
    field[i] = imageData.data[i * 4 + 3] / 255;
  }

  return { data: field, width: canvas.width, height: canvas.height, scaledFontSize };
}

function sobelGradient(field: Float32Array, width: number, height: number): { dx: Float32Array; dy: Float32Array } {
  const dx = new Float32Array(width * height);
  const dy = new Float32Array(width * height);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;

      const x0 = Math.max(0, col - 1);
      const x1 = Math.min(width - 1, col + 1);

      const y0 = Math.max(0, row - 1);
      const y1 = Math.min(height - 1, row + 1);

      const tl = field[y0 * width + x0];
      const tc = field[y0 * width + col];
      const tr = field[y0 * width + x1];

      const ml = field[row * width + x0];
      const mr = field[row * width + x1];

      const bl = field[y1 * width + x0];
      const bc = field[y1 * width + col];
      const br = field[y1 * width + x1];

      dx[idx] = (tr + 2 * mr + br - tl - 2 * ml - bl) * 0.125;
      dy[idx] = (bl + 2 * bc + br - tl - 2 * tc - tr) * 0.125;
    }
  }

  return { dx, dy };
}

/**
 * Generates the R (horizontal) and G (vertical) direction channels as a normal
 * map derived from a height field.
 *
 * The height field is simply the text mask blurred with a large radius — the
 * Gaussian-like blur naturally inflates the text into smooth dome shapes whose
 * gradients produce the characteristic puffy/embossed look.
 */
function fillDirectionChannels(
  red: Float32Array,
  green: Float32Array,
  mask: Float32Array,
  width: number,
  height: number,
  normalStrength: number,
  softness: number,
  scaledFontSize: number,
): void {
  const size = width * height;

  const blurRadius = Math.max(1, Math.round(scaledFontSize * softness * 0.43));
  const heightField = blurField(mask, width, height, blurRadius);

  const { dx, dy } = sobelGradient(heightField, width, height);

  let maxMag = 0;

  for (let i = 0; i < size; i++) {
    maxMag = Math.max(maxMag, Math.abs(dx[i]), Math.abs(dy[i]));
  }

  const autoScale = maxMag > 1e-8 ? NORMAL_TARGET_RANGE / maxMag : 1;
  const strength = normalStrength / DEFAULT_SETTINGS.normalStrength;
  const finalScale = autoScale * strength;

  for (let i = 0; i < size; i++) {
    red[i] = clamp(0.5 + dx[i] * finalScale, 0, 1);
    green[i] = clamp(0.5 + dy[i] * finalScale, 0, 1);
  }
}

function computeFieldRadius(fontSize: number, softness: number): number {
  return Math.max(2, Math.ceil(fontSize * (0.08 + softness * 0.16)));
}

function smoothstep(e0: number, e1: number, val: number): number {
  if (e0 === e1) {
    return val < e0 ? 0 : 1;
  }

  const tt = clamp((val - e0) / (e1 - e0), 0, 1);

  return tt * tt * (3 - 2 * tt);
}

function clamp(val: number, lo: number, hi: number): number {
  return val < lo ? lo : val > hi ? hi : val;
}

function lerp(lo: number, hi: number, factor: number): number {
  return lo + (hi - lo) * factor;
}

function projectGradientContribution(px: number, py: number, grad: GradientLine): number {
  const dx = grad.endX - grad.startX;
  const dy = grad.endY - grad.startY;
  const lenSq = dx * dx + dy * dy;

  if (lenSq <= 1e-6) {
    return 1;
  }

  const len = Math.sqrt(lenSq);
  const tt = clamp(((px - grad.startX) * dx + (py - grad.startY) * dy) / lenSq, 0, 1);
  const baseOpacity = lerp(grad.startOpacity, grad.endOpacity, tt);

  if (grad.widthA >= 2 && grad.widthB >= 2) {
    return baseOpacity;
  }

  const projX = grad.startX + tt * dx;
  const projY = grad.startY + tt * dy;

  const signedPerp = (-dy * (px - projX) + dx * (py - projY)) / len;
  const sideA = signedPerp < 0;
  const halfWidth = sideA ? grad.widthA : grad.widthB;
  const softness = sideA ? grad.softnessA : grad.softnessB;
  const perpDist = Math.abs(signedPerp);

  const edge = Math.max(0.005, halfWidth * softness);
  const widthFactor = 1 - smoothstep(halfWidth - edge, halfWidth + edge, perpDist);

  return lerp(1, baseOpacity, widthFactor);
}

function projectRadialBlend(
  px: number,
  py: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  scaleY: number,
  width: number,
  height: number,
): number {
  const dx = (px - centerX) * width;
  const sy = Math.max(1e-4, scaleY);
  const dy = ((py - centerY) * height) / sy;

  const minDim = Math.max(1, Math.min(width, height));

  const distance = Math.hypot(dx, dy) / minDim;

  return smoothstep(innerRadius, outerRadius, distance);
}

function blurField(src: Float32Array, width: number, height: number, radius: number, passes = 3): Float32Array {
  const blurRadius = Math.max(0, Math.round(radius));

  if (blurRadius <= 0 || passes <= 0) {
    return new Float32Array(src);
  }

  let current = new Float32Array(src);
  let output = new Float32Array(src.length);

  const temp = new Float32Array(src.length);

  for (let pass = 0; pass < passes; pass++) {
    boxBlurHorizontal(current, temp, width, height, blurRadius);
    boxBlurVertical(temp, output, width, height, blurRadius);

    if (pass < passes - 1) {
      const next = current;

      current = output;
      output = next;
    }
  }

  return output;
}

function boxBlurHorizontal(src: Float32Array, dst: Float32Array, width: number, height: number, radius: number): void {
  const windowSize = radius * 2 + 1;

  for (let rowIdx = 0; rowIdx < height; rowIdx++) {
    const row = rowIdx * width;

    let sum = 0;

    for (let ix = -radius; ix <= radius; ix++) {
      const sampleX = clampIndex(ix, 0, width - 1);

      sum += src[row + sampleX];
    }

    for (let col = 0; col < width; col++) {
      dst[row + col] = sum / windowSize;

      const removeX = clampIndex(col - radius, 0, width - 1);
      const addX = clampIndex(col + radius + 1, 0, width - 1);

      sum += src[row + addX] - src[row + removeX];
    }
  }
}

function boxBlurVertical(src: Float32Array, dst: Float32Array, width: number, height: number, radius: number): void {
  const windowSize = radius * 2 + 1;

  for (let col = 0; col < width; col++) {
    let sum = 0;

    for (let iy = -radius; iy <= radius; iy++) {
      const sampleY = clampIndex(iy, 0, height - 1);

      sum += src[sampleY * width + col];
    }

    for (let rowIdx = 0; rowIdx < height; rowIdx++) {
      dst[rowIdx * width + col] = sum / windowSize;

      const removeY = clampIndex(rowIdx - radius, 0, height - 1);
      const addY = clampIndex(rowIdx + radius + 1, 0, height - 1);

      sum += src[addY * width + col] - src[removeY * width + col];
    }
  }
}

function clampIndex(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}
