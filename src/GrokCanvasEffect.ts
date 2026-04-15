import { getLogoTexturePath, LOGO_TEXTURE_PATHS, NOISE_TEXTURE_PATH, type LogoTexturePath } from './assets';
import { LOGO_LAYOUT, LOGO_RATIO, QUALITY_ADAPTATION } from './config';
import { FRAG_MAIN, FRAG_TRAIL, VERT } from './shaders';
import { loadTexture } from './textureLoader';
import {
  bindFullscreenQuad,
  createFullscreenQuad,
  createProgram,
  createRenderTarget,
  getWebGLContext,
  resizeRenderTarget,
  type GL,
  type RenderTarget,
} from './webgl';

type Vec2 = [number, number];

interface MainUniforms {
  time: WebGLUniformLocation;
  resolution: WebGLUniformLocation;
  logoScale: WebGLUniformLocation;
  logoRatio: WebGLUniformLocation;
  offset: WebGLUniformLocation;
  noiseTexture: WebGLUniformLocation;
  logoTexture: WebGLUniformLocation;
  trailTexture: WebGLUniformLocation;
}

interface TrailUniforms {
  time: WebGLUniformLocation;
  deltaTime: WebGLUniformLocation;
  resolution: WebGLUniformLocation;
  logoScale: WebGLUniformLocation;
  logoRatio: WebGLUniformLocation;
  mouse: WebGLUniformLocation;
  mouseVelocity: WebGLUniformLocation;
  noiseTexture: WebGLUniformLocation;
  logoTexture: WebGLUniformLocation;
  previousFrame: WebGLUniformLocation;
}

export class GrokCanvasEffect {
  readonly #gl: GL;
  readonly #mainProgram: WebGLProgram;
  readonly #trailProgram: WebGLProgram;
  readonly #quadBuffer: WebGLBuffer;
  readonly #mainUniforms: MainUniforms;
  readonly #trailUniforms: TrailUniforms;
  readonly #renderTargets: [RenderTarget, RenderTarget];
  readonly #logoTextures = new Map<LogoTexturePath, WebGLTexture>();
  readonly #canvas: HTMLCanvasElement;

  #noiseTexture: WebGLTexture | null = null;
  #currentLogoPath: LogoTexturePath = LOGO_TEXTURE_PATHS[0];
  #logoRatio = LOGO_RATIO;
  #pingPongIndex = 0;
  #qualityScale: number = QUALITY_ADAPTATION.maxScale;
  #fps = 0;
  #frameCount = 0;
  #fpsTime = 0;
  #adaptTime = 0;
  #lastTime = 0;
  #deltaTime = 0.0167;
  #animationFrameId = 0;
  #running = false;
  #destroyed = false;
  #mousePosition: Vec2 = [0.5, 0.5];
  #previousMousePosition: Vec2 = [0.5, 0.5];

  constructor(canvas: HTMLCanvasElement) {
    const gl = getWebGLContext(canvas);

    if (!gl) {
      throw new Error('WebGL is not supported in this browser.');
    }

    this.#canvas = canvas;
    this.#gl = gl;
    this.#mainProgram = createProgram(gl, VERT, FRAG_MAIN);
    this.#trailProgram = createProgram(gl, VERT, FRAG_TRAIL);
    this.#quadBuffer = createFullscreenQuad(gl);

    this.#mainUniforms = {
      time: getUniformLocation(gl, this.#mainProgram, 'uTime'),
      resolution: getUniformLocation(gl, this.#mainProgram, 'uResolution'),
      logoScale: getUniformLocation(gl, this.#mainProgram, 'uLogoScale'),
      logoRatio: getUniformLocation(gl, this.#mainProgram, 'uLogoRatio'),
      offset: getUniformLocation(gl, this.#mainProgram, 'uOffset'),
      noiseTexture: getUniformLocation(gl, this.#mainProgram, 'uNoiseTexture'),
      logoTexture: getUniformLocation(gl, this.#mainProgram, 'uLogoTexture'),
      trailTexture: getUniformLocation(gl, this.#mainProgram, 'uTrailTexture'),
    };

    this.#trailUniforms = {
      time: getUniformLocation(gl, this.#trailProgram, 'uTime'),
      deltaTime: getUniformLocation(gl, this.#trailProgram, 'uDeltaTime'),
      resolution: getUniformLocation(gl, this.#trailProgram, 'uResolution'),
      logoScale: getUniformLocation(gl, this.#trailProgram, 'uLogoScale'),
      logoRatio: getUniformLocation(gl, this.#trailProgram, 'uLogoRatio'),
      mouse: getUniformLocation(gl, this.#trailProgram, 'uMouse'),
      mouseVelocity: getUniformLocation(gl, this.#trailProgram, 'uMouseVelocity'),
      noiseTexture: getUniformLocation(gl, this.#trailProgram, 'uNoiseTexture'),
      logoTexture: getUniformLocation(gl, this.#trailProgram, 'uLogoTexture'),
      previousFrame: getUniformLocation(gl, this.#trailProgram, 'uPreviousFrame'),
    };

    this.#renderTargets = [createRenderTarget(gl, 1, 1), createRenderTarget(gl, 1, 1)];
  }

  async init(): Promise<void> {
    if (this.#destroyed || this.#running) {
      return;
    }

    this.#logoRatio = LOGO_RATIO;
    this.#resize();

    const loadedTextures = await Promise.all([
      loadTexture(this.#gl, NOISE_TEXTURE_PATH, { repeat: true }),
      ...LOGO_TEXTURE_PATHS.map((sourcePath) => loadTexture(this.#gl, sourcePath)),
    ]);

    if (this.#destroyed) {
      return;
    }

    const [noiseTexture, ...logoTextures] = loadedTextures;

    this.#noiseTexture = noiseTexture;

    LOGO_TEXTURE_PATHS.forEach((sourcePath, index) => {
      const texture = logoTextures[index];

      if (!texture) {
        throw new Error(`Missing preloaded texture for "${sourcePath}".`);
      }

      this.#logoTextures.set(sourcePath, texture);
    });

    this.#currentLogoPath = getLogoTexturePath(this.#canvas.width);

    this.#startLoop();
  }

  async initWithRawTexture(pixels: Uint8Array, width: number, height: number, logoRatio: number): Promise<void> {
    if (this.#destroyed || this.#running) {
      return;
    }

    this.#logoRatio = Math.max(0.25, logoRatio);

    this.#resize();

    this.#noiseTexture = await loadTexture(this.#gl, NOISE_TEXTURE_PATH, { repeat: true });

    if (this.#destroyed) {
      return;
    }

    for (const path of LOGO_TEXTURE_PATHS) {
      const texture = this.#gl.createTexture();

      if (!texture) {
        throw new Error(`Unable to create texture for "${path}".`);
      }

      this.#gl.bindTexture(this.#gl.TEXTURE_2D, texture);

      this.#gl.texImage2D(
        this.#gl.TEXTURE_2D,
        0,
        this.#gl.RGBA,
        width,
        height,
        0,
        this.#gl.RGBA,
        this.#gl.UNSIGNED_BYTE,
        pixels,
      );

      this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_MIN_FILTER, this.#gl.LINEAR);
      this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_MAG_FILTER, this.#gl.LINEAR);
      this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_WRAP_S, this.#gl.CLAMP_TO_EDGE);
      this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_WRAP_T, this.#gl.CLAMP_TO_EDGE);

      this.#logoTextures.set(path, texture);
    }

    this.#currentLogoPath = getLogoTexturePath(this.#canvas.width);

    this.#startLoop();
  }

  #startLoop(): void {
    this.#resetTrailBuffers();
    this.#attachEvents();

    const now = performance.now();

    this.#fpsTime = now;
    this.#adaptTime = now;
    this.#frameCount = 0;
    this.#lastTime = 0;
    this.#running = true;
    this.#animationFrameId = requestAnimationFrame(this.#frame);
  }

  destroy(): void {
    if (this.#destroyed) {
      return;
    }

    this.#destroyed = true;
    this.#running = false;

    if (this.#animationFrameId) {
      cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = 0;
    }

    this.#detachEvents();

    this.#gl.deleteBuffer(this.#quadBuffer);
    this.#gl.deleteProgram(this.#mainProgram);
    this.#gl.deleteProgram(this.#trailProgram);

    if (this.#noiseTexture) {
      this.#gl.deleteTexture(this.#noiseTexture);
      this.#noiseTexture = null;
    }

    for (const texture of this.#logoTextures.values()) {
      this.#gl.deleteTexture(texture);
    }

    this.#logoTextures.clear();

    for (const renderTarget of this.#renderTargets) {
      this.#gl.deleteFramebuffer(renderTarget.framebuffer);
      this.#gl.deleteTexture(renderTarget.texture);
    }
  }

  readonly #frame = (timestamp: number): void => {
    if (!this.#running) {
      return;
    }

    this.#animationFrameId = requestAnimationFrame(this.#frame);

    const noiseTexture = this.#noiseTexture;
    const logoTexture = this.#logoTextures.get(this.#currentLogoPath) ?? null;

    if (!noiseTexture || !logoTexture) {
      return;
    }

    this.#deltaTime = this.#lastTime > 0 ? Math.min((timestamp - this.#lastTime) * 0.001, 0.05) : 0.0167;
    this.#lastTime = timestamp;

    this.#updateQuality(timestamp);

    const mouseVelocity: Vec2 = [
      this.#mousePosition[0] - this.#previousMousePosition[0],
      this.#mousePosition[1] - this.#previousMousePosition[1],
    ];

    this.#previousMousePosition = [...this.#mousePosition];

    const nextIndex = (this.#pingPongIndex + 1) % this.#renderTargets.length;
    const time = timestamp * 0.001;
    const previousTarget = this.#renderTargets[this.#pingPongIndex];
    const nextTarget = this.#renderTargets[nextIndex];

    this.#drawTrailPass(nextTarget, previousTarget.texture, noiseTexture, logoTexture, time, mouseVelocity);
    this.#drawMainPass(nextTarget.texture, noiseTexture, logoTexture, time);

    this.#pingPongIndex = nextIndex;
  };

  #attachEvents(): void {
    window.addEventListener('resize', this.#handleResize);
    window.addEventListener('mousemove', this.#handleMouseMove, { passive: true });
    window.addEventListener('touchmove', this.#handleTouchMove, { passive: true });
    document.addEventListener('visibilitychange', this.#handleVisibilityChange);
  }

  #detachEvents(): void {
    window.removeEventListener('resize', this.#handleResize);
    window.removeEventListener('mousemove', this.#handleMouseMove);
    window.removeEventListener('touchmove', this.#handleTouchMove);
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange);
  }

  readonly #handleResize = (): void => {
    this.#resize();
  };

  readonly #handleMouseMove = (event: MouseEvent): void => {
    this.#updateMousePosition(event.clientX, event.clientY);
  };

  readonly #handleTouchMove = (event: TouchEvent): void => {
    const [touch] = event.touches;

    if (touch) {
      this.#updateMousePosition(touch.clientX, touch.clientY);
    }
  };

  readonly #handleVisibilityChange = (): void => {
    if (!document.hidden) {
      const now = performance.now();

      this.#lastTime = 0;
      this.#fpsTime = now;
      this.#adaptTime = now;

      return;
    }

    this.#frameCount = 0;
    this.#fpsTime = 0;
  };

  #updateMousePosition(clientX: number, clientY: number): void {
    const bounds = this.#canvas.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
      return;
    }

    this.#mousePosition = [(clientX - bounds.left) / bounds.width, 1 - (clientY - bounds.top) / bounds.height];
  }

  #updateQuality(timestamp: number): void {
    this.#frameCount += 1;

    if (timestamp - this.#fpsTime < 1000) {
      return;
    }

    this.#fps = Math.round((1000 * this.#frameCount) / (timestamp - this.#fpsTime));
    this.#fpsTime = timestamp;
    this.#frameCount = 0;

    if (timestamp - this.#adaptTime < QUALITY_ADAPTATION.updateIntervalMs) {
      return;
    }

    let nextScale = this.#qualityScale;

    if (this.#fps < QUALITY_ADAPTATION.lowFpsThreshold && this.#qualityScale > QUALITY_ADAPTATION.minScale) {
      nextScale = Math.max(QUALITY_ADAPTATION.minScale, this.#qualityScale - QUALITY_ADAPTATION.step);
    } else if (this.#fps > QUALITY_ADAPTATION.highFpsThreshold && this.#qualityScale < QUALITY_ADAPTATION.maxScale) {
      nextScale = Math.min(QUALITY_ADAPTATION.maxScale, this.#qualityScale + QUALITY_ADAPTATION.step);
    }

    if (nextScale !== this.#qualityScale) {
      this.#qualityScale = nextScale;
      this.#resize();
    }

    this.#adaptTime = timestamp;
  }

  #resize(): void {
    const width = Math.max(1, this.#canvas.clientWidth);
    const height = Math.max(1, this.#canvas.clientHeight);

    this.#canvas.width = width;
    this.#canvas.height = height;

    for (const renderTarget of this.#renderTargets) {
      resizeRenderTarget(this.#gl, renderTarget, width * this.#qualityScale, height * this.#qualityScale);
    }

    this.#currentLogoPath = getLogoTexturePath(width);

    this.#updateLayoutUniforms();

    this.#gl.viewport(0, 0, width, height);

    if (this.#noiseTexture) {
      this.#resetTrailBuffers();
    }
  }

  #updateLayoutUniforms(): void {
    const logoHeight = this.#canvas.height * LOGO_LAYOUT.heightRatio;
    const logoWidth = logoHeight * this.#logoRatio;
    const rightGap = Math.max((this.#canvas.width - logoWidth) / 2, 0);
    const gapProgress = Math.min(rightGap / LOGO_LAYOUT.edgePadding, 1);
    const offsetX = -LOGO_LAYOUT.maxOffset * (1 - gapProgress);

    this.#gl.useProgram(this.#mainProgram);
    this.#gl.uniform2f(this.#mainUniforms.resolution, this.#canvas.width, this.#canvas.height);
    this.#gl.uniform1f(this.#mainUniforms.logoScale, LOGO_LAYOUT.heightRatio);
    this.#gl.uniform1f(this.#mainUniforms.logoRatio, this.#logoRatio);
    this.#gl.uniform2f(this.#mainUniforms.offset, offsetX, 0);

    this.#gl.useProgram(this.#trailProgram);
    this.#gl.uniform2f(this.#trailUniforms.resolution, this.#canvas.width, this.#canvas.height);
    this.#gl.uniform1f(this.#trailUniforms.logoScale, LOGO_LAYOUT.heightRatio);
    this.#gl.uniform1f(this.#trailUniforms.logoRatio, this.#logoRatio);
  }

  #resetTrailBuffers(): void {
    const previousFramebuffer = this.#gl.getParameter(this.#gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    for (const renderTarget of this.#renderTargets) {
      this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, renderTarget.framebuffer);
      this.#gl.viewport(0, 0, renderTarget.width, renderTarget.height);
      this.#gl.clearColor(0.5, 0.5, 0, 0);
      this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
    }

    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, previousFramebuffer);
    this.#gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #drawTrailPass(
    nextTarget: RenderTarget,
    previousFrameTexture: WebGLTexture,
    noiseTexture: WebGLTexture,
    logoTexture: WebGLTexture,
    time: number,
    mouseVelocity: Vec2,
  ): void {
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, nextTarget.framebuffer);
    this.#gl.viewport(0, 0, nextTarget.width, nextTarget.height);

    bindFullscreenQuad(this.#gl, this.#trailProgram, this.#quadBuffer);

    this.#gl.uniform1f(this.#trailUniforms.time, time);
    this.#gl.uniform1f(this.#trailUniforms.deltaTime, this.#deltaTime);
    this.#gl.uniform2f(this.#trailUniforms.mouse, this.#mousePosition[0], this.#mousePosition[1]);
    this.#gl.uniform2f(this.#trailUniforms.mouseVelocity, mouseVelocity[0], mouseVelocity[1]);

    this.#gl.activeTexture(this.#gl.TEXTURE0);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, noiseTexture);
    this.#gl.uniform1i(this.#trailUniforms.noiseTexture, 0);

    this.#gl.activeTexture(this.#gl.TEXTURE1);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, previousFrameTexture);
    this.#gl.uniform1i(this.#trailUniforms.previousFrame, 1);

    this.#gl.activeTexture(this.#gl.TEXTURE2);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, logoTexture);
    this.#gl.uniform1i(this.#trailUniforms.logoTexture, 2);

    this.#gl.drawArrays(this.#gl.TRIANGLE_STRIP, 0, 4);
  }

  #drawMainPass(trailTexture: WebGLTexture, noiseTexture: WebGLTexture, logoTexture: WebGLTexture, time: number): void {
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
    this.#gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);

    bindFullscreenQuad(this.#gl, this.#mainProgram, this.#quadBuffer);

    this.#gl.uniform1f(this.#mainUniforms.time, time);

    this.#gl.activeTexture(this.#gl.TEXTURE0);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, noiseTexture);
    this.#gl.uniform1i(this.#mainUniforms.noiseTexture, 0);

    this.#gl.activeTexture(this.#gl.TEXTURE1);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, logoTexture);
    this.#gl.uniform1i(this.#mainUniforms.logoTexture, 1);

    this.#gl.activeTexture(this.#gl.TEXTURE2);
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, trailTexture);
    this.#gl.uniform1i(this.#mainUniforms.trailTexture, 2);

    this.#gl.drawArrays(this.#gl.TRIANGLE_STRIP, 0, 4);
  }
}

function getUniformLocation(gl: GL, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);

  if (!location) {
    throw new Error(`Uniform "${name}" was not found.`);
  }

  return location;
}
