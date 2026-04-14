export type GL = WebGLRenderingContext | WebGL2RenderingContext;

export interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

export function getWebGLContext(canvas: HTMLCanvasElement): GL | null {
  return canvas.getContext('webgl2') ?? canvas.getContext('webgl');
}

export function createProgram(gl: GL, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!program) {
    throw new Error('Unable to create WebGL program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error.';

    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    throw new Error(`Program link error: ${message}`);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

export function createFullscreenQuad(gl: GL): WebGLBuffer {
  const buffer = gl.createBuffer();

  if (!buffer) {
    throw new Error('Unable to create fullscreen quad buffer.');
  }

  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  return buffer;
}

export function bindFullscreenQuad(gl: GL, program: WebGLProgram, buffer: WebGLBuffer): void {
  const positionLocation = gl.getAttribLocation(program, 'aPosition');

  if (positionLocation < 0) {
    throw new Error('Shader attribute "aPosition" was not found.');
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
}

export function createRenderTarget(gl: GL, width: number, height: number): RenderTarget {
  const texture = createTexture(gl);
  const framebuffer = gl.createFramebuffer();

  if (!framebuffer) {
    gl.deleteTexture(texture);
    throw new Error('Unable to create framebuffer.');
  }

  const renderTarget: RenderTarget = {
    texture,
    framebuffer,
    width: 0,
    height: 0,
  };

  resizeRenderTarget(gl, renderTarget, width, height);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return renderTarget;
}

export function resizeRenderTarget(gl: GL, renderTarget: RenderTarget, width: number, height: number): void {
  const nextWidth = Math.max(1, Math.floor(width));
  const nextHeight = Math.max(1, Math.floor(height));

  if (renderTarget.width === nextWidth && renderTarget.height === nextHeight) {
    return;
  }

  gl.bindTexture(gl.TEXTURE_2D, renderTarget.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nextWidth, nextHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  renderTarget.width = nextWidth;
  renderTarget.height = nextHeight;
}

function compileShader(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('Unable to create shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${message}`);
  }

  return shader;
}

function createTexture(gl: GL): WebGLTexture {
  const texture = gl.createTexture();

  if (!texture) {
    throw new Error('Unable to create texture.');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}
