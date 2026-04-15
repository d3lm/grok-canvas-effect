const BASE = import.meta.env.BASE_URL;

export const NOISE_TEXTURE_PATH = `${BASE}noise.png`;
export const LOGO_TEXTURE_PATHS = [`${BASE}logo.png`, `${BASE}logoHalf.png`, `${BASE}logoQuat.png`] as const;

export type LogoTexturePath = (typeof LOGO_TEXTURE_PATHS)[number];

export function getLogoTexturePath(viewportWidth: number): LogoTexturePath {
  if (viewportWidth >= 900) {
    return LOGO_TEXTURE_PATHS[0];
  }

  if (viewportWidth >= 450) {
    return LOGO_TEXTURE_PATHS[1];
  }

  return LOGO_TEXTURE_PATHS[2];
}
