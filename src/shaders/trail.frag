#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform float uTime;
uniform float uDeltaTime;
uniform float uLogoScale;
uniform float uLogoRatio;
uniform vec2 uMouse;
uniform vec2 uMouseVelocity;
uniform vec2 uResolution;
uniform sampler2D uNoiseTexture;
uniform sampler2D uPreviousFrame;
uniform sampler2D uLogoTexture;

#define TRAIL_FALLOFF 9000.0
#define FADE_EXP vec4(0.02, 0.02, 0.1, 0.1)

#define SCROLL_SPEED 0.0005
#define DISTORT_SPEED 0.02

#define LOGO_TWIRL 0.4
#define LOGO_PULL 0.1

#define LOGO_SCALE 0.5

#define TURB_NUM 8.0
#define TURB_AMP 0.6
#define TURB_SPEED 0.5
#define TURB_VEL vec2(0.1, 0.0)
#define TURB_FREQ 50.0
#define TURB_EXP 1.3

vec2 turbulence(vec2 p) {
  mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
  vec2 turb = vec2(0.0);
  float freq = TURB_FREQ;

  for (float i = 0.0; i < TURB_NUM; i++) {
    vec2 pos = p + TURB_SPEED * i * uTime * TURB_VEL;
    float phase = freq * (pos * rot).y + TURB_SPEED * uTime * freq * 0.1;

    turb += rot[0] * sin(phase) / freq;
    rot *= mat2(0.6, -0.8, 0.8, 0.6);
    freq *= TURB_EXP;
  }

  return turb;
}

void main() {
  vec2 ratio = min(uResolution.yx / uResolution.xy, 1.0);

  vec2 scale = max(uLogoScale, 1.0 - (uLogoRatio / 4.0)) * ratio * vec2(uLogoRatio, -1.0);
  vec2 logoUV = 0.5 + (vUv - 0.5) / scale;
  vec4 logo = vec4(0.0);

  if (logoUV.x >= 0.0 && logoUV.x <= 1.0 && logoUV.y >= 0.0 && logoUV.y <= 1.0) {
    logo = texture2D(uLogoTexture, logoUV);
  }

  float delta = 144.0 * uDeltaTime;
  vec2 scroll = SCROLL_SPEED * vec2(1.0, vUv.y - 0.5) * ratio;
  vec2 turb = turbulence((vUv + scroll) / ratio);
  vec2 distort = DISTORT_SPEED * turb;

  distort -= LOGO_TWIRL * (logo.rg - 0.6) * mat2(0.0, -1.0, 1.0, 0.0) * (logo.g - 0.5) * logo.b;
  distort -= LOGO_PULL * (logo.rg - 0.6) * logo.b * logo.b;

  vec2 distortedUv = vUv + delta * scroll + delta * distort * ratio;

  vec4 prev = texture2D(uPreviousFrame, distortedUv);

  vec2 trailA = vUv + 0.01 * delta * turb * ratio - uMouse;
  vec2 trailB = -uMouseVelocity;
  float trailD = dot(trailB, trailB);
  vec2 trailDif = trailA / ratio;
  float falloff = 0.0;

  if (trailD > 0.0) {
    float f = clamp(dot(trailA, trailB) / trailD, 0.0, 1.0);
    trailDif -= f * trailB / ratio;
    falloff = (1.0 - logo.b) / (1.0 + TRAIL_FALLOFF * dot(trailDif, trailDif));
    falloff *= min(trailD / (0.001 + trailD), 1.0);
  }

  vec2 suv = (uMouse - uMouseVelocity) * 2.0 - 1.0;
  float vig = 1.0 - abs(suv.y);

  vig *= 0.5 + 0.5 * suv.x;

  vec2 nuv = gl_FragCoord.xy / 64.0 + uTime * vec2(7.1, 9.1);
  float noise = texture2D(uNoiseTexture, nuv).r;

  vec4 fade = pow(vec4(noise), FADE_EXP);

  fade = exp(-2.0 * fade * uDeltaTime);

  vec4 decay = mix(vec4(0.5, 0.5, 0.0, 0.0), prev, fade);

  vec4 col = decay;

  vec2 vel = (-trailB) / (0.01 + length(trailB));

  col.rg -= (0.5 - abs(decay.rg - 0.5)) * (falloff * vel);
  col.ba += falloff * (1.0 - decay.ba) * vec2(1.0, vig * vig);
  col += (noise - 0.5) / 255.0;

  gl_FragColor = col;
}
