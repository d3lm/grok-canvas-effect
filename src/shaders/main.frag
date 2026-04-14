#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform float uLogoScale;
uniform float uLogoRatio;
uniform vec2 uOffset;
uniform sampler2D uNoiseTexture;
uniform sampler2D uLogoTexture;
uniform sampler2D uTrailTexture;

#define STAR 5.0
#define FLARE 4.0
#define COLOR vec3(0.2, 0.3, 0.8)

#define STAR_NUM 12.0
#define STAR_AMP 0.5
#define STAR_SPEED 0.01
#define STAR_VEL vec2(1.0, 0.0)
#define STAR_FREQ 8.0
#define STAR_EXP 1.5

#define LOGO_SCALE 0.5

#define GLOW_STRENGTH 12.0
#define GLOW_RED vec3(0.5, 0.2, 0.2)
#define GLOW_BLUE vec3(0.3, 0.3, 0.6)
#define GLOW_TURBULENCE 0.4
#define GLOW_TINT 3.0

#define LIGHT_EXP 30.0

#define TRAIL_EXP vec3(1.4, 1.2, 1.0)
#define TRAIL_STRENGTH 0.4

#define DITHER 0.01
#define DITHER_RES 64.0

vec3 gamma_encode(vec3 lrgb) {
  return sqrt(lrgb);
}

vec2 turbulence(vec2 p, float freq, float num) {
  mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
  vec2 turb = vec2(0.0);

  for (float i = 0.0; i < STAR_NUM; i++) {
    if (i >= num) {
      break;
    }

    vec2 pos = p + turb + STAR_SPEED * i * uTime * STAR_VEL;
    float phase = freq * (pos * rot).y + STAR_SPEED * uTime * freq;

    turb += rot[0] * sin(phase) / freq;
    rot *= mat2(0.6, -0.8, 0.8, 0.6);
    freq *= STAR_EXP;
  }

  return turb;
}

vec3 star(inout vec2 p) {
  #define STAR_STRETCH 0.7
  #define STAR_CURVE 0.5

  vec2 suv = p * 2.0 - 1.0;
  vec2 right = suv - vec2(1.0, 0.0);

  right.x *= STAR_STRETCH * uResolution.x / uResolution.y;

  float factor = 1.0 + 0.4 * sin(9.0 * suv.y) * sin(5.0 * (suv.x + 5.0 * uTime * STAR_SPEED));
  vec2 turb = right + factor * STAR_AMP * turbulence(right, STAR_FREQ, STAR_NUM);

  turb.x -= STAR_CURVE * suv.y * suv.y;

  float fade = max(4.0 * suv.y * suv.y - suv.x + 1.2, 0.001);
  float atten = fade * max(0.5 * turb.x, -turb.x);

  float ft = 0.4 * uTime;
  vec2 fp = 8.0 * (turb + 0.5 * STAR_VEL * ft);

  fp *= mat2(0.4, -0.3, 0.3, 0.4);

  float f = cos(fp.x) * sin(fp.y) - 0.5;
  float flare = f * f + 0.5 * suv.y * suv.y - 1.5 * turb.x
    + 0.6 * cos(0.42 * ft + 1.6 * turb.y) * cos(0.31 * ft - turb.y);

  vec3 col = 0.1 * COLOR * (STAR / (atten * atten) + FLARE / (flare * flare));

  const vec3 chrom = vec3(0.0, 0.1, 0.2);

  col *= exp(p.x
    * cos(turb.y * 5.0 + 0.4 * (uTime + turb.x * 1.0) + chrom)
    * cos(turb.y * 7.0 - 0.5 * (uTime - turb.x * 1.5) + chrom)
    * cos(turb.y * 9.0 + 0.6 * (uTime + turb.x * 2.0) + chrom));

  return col;
}

void main() {
  vec2 duv = 0.9 * gl_FragCoord.xy / DITHER_RES * mat2(0.8, -0.6, 0.6, 0.8);
  float dither = texture2D(uNoiseTexture, duv).r - 0.5;

  vec2 ratio = min(uResolution.yx / uResolution.xy, 1.0);
  vec4 trailTex = texture2D(uTrailTexture, vUv);

  vec2 suv = vUv * 2.0 - 1.0;

  vec2 scale = max(uLogoScale, 1.0 - (uLogoRatio / 4.0)) * ratio * vec2(uLogoRatio, -1.0);
  vec2 logoUv = 0.5 + (vUv - 0.5) / scale;

  vec4 logo = vec4(0.0);
  vec4 logoTurb = vec4(0.0);
  vec2 dir = vec2(0.0);
  float glow = 0.0;
  vec2 distort = uOffset;

  if (logoUv.x >= 0.0 && logoUv.x <= 1.0 && logoUv.y >= 0.0 && logoUv.y <= 1.0) {
    logo = texture2D(uLogoTexture, logoUv);
    dir = logo.rg - 0.6;
    dir.x = -dir.x;

    vec2 shift = -2.0 * vec2(dir.y, -dir.x) * dir.y * logo.b;

    shift += 0.1 * (1.0 - logo.b) * (trailTex.rg - 0.5) * trailTex.b * ratio;

    vec2 logoT = logoUv * vec2(uLogoRatio, 1.0) + shift;

    logoT += (1.0 - logo.b) * turbulence(logoT, 40.0, 6.0);
    logoUv = (logoT - shift) / vec2(uLogoRatio, 1.0);

    logoTurb = texture2D(uLogoTexture, logoUv);
    logoTurb.b = mix(logo.b, logoTurb.b, GLOW_TURBULENCE);

    float xx = logoUv.x;
    float yy = logoUv.y - 0.5;

    glow = max(logoTurb.b - (xx * xx + 8.0 * yy * yy) * logoTurb.b, 0.0);

    distort += dir * logo.b * (1.0 - logo.b);
  }

  vec2 starUv = vUv + distort;

  starUv += 0.3 * (trailTex.rg - 0.5) * trailTex.b * ratio;

  vec3 col = star(starUv);

  float vig = 1.0 - abs(suv.y);

  vig *= 0.5 + 0.5 * suv.x;
  col *= vig * vig;

  col /= 1.0 + col;
  col = clamp(col, 0.0, 1.0);
  col = gamma_encode(col);

  float yy = suv.y + 0.03;

  yy = max(1.0 - 1e1 * yy * yy / max(0.5 + 1.5 * starUv.x, 0.1), 0.0);

  float light = max(0.5 + 0.5 * starUv.x, 0.0) * yy;

  light += 2.0 * (1.0 - light) * glow;

  float tint = GLOW_TINT * dir.x * glow;
  vec3 hue = mix(GLOW_RED, GLOW_BLUE, 1.0 + suv.x + tint);
  float alpha = 1.0 - (1.0 - pow(yy, LIGHT_EXP)) * glow;
  vec3 rim = GLOW_STRENGTH * light * light * light * light * alpha * (0.5 + 0.5 * suv.x) * hue;

  rim /= 1.0 + rim;
  col += (1.0 - col) * rim * rim;
  col += TRAIL_STRENGTH * hue * pow(trailTex.aaa, TRAIL_EXP);

  float a = smoothstep(1.0, 0.2, logo.a);

  col.rgb = a * col.rgb + (1.0 - a);

  col += DITHER * dither;

  gl_FragColor = vec4(col, 1.0);
}
