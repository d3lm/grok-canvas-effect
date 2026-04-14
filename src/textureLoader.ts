import type { GL } from './webgl';

export interface TextureLoadOptions {
  repeat?: boolean;
}

export async function loadTexture(
  gl: GL,
  sourcePath: string,
  { repeat = false }: TextureLoadOptions = {},
): Promise<WebGLTexture> {
  const image = await loadImage(sourcePath);
  const source = downscaleToTextureLimit(image, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  const texture = gl.createTexture();

  if (!texture) {
    throw new Error(`Unable to create texture for "${sourcePath}".`);
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const wrapMode = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);

  return texture;
}

function loadImage(sourcePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load texture "${sourcePath}".`));
    image.src = sourcePath;
  });
}

function downscaleToTextureLimit(
  image: HTMLImageElement,
  maxTextureSize: number,
): HTMLImageElement | HTMLCanvasElement {
  if (image.width <= maxTextureSize && image.height <= maxTextureSize) {
    return image;
  }

  const scale = Math.min(maxTextureSize / image.width, maxTextureSize / image.height);
  const width = Math.max(1, Math.floor(image.width * scale));
  const height = Math.max(1, Math.floor(image.height * scale));
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create 2D context for texture downscaling.');
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas;
}
