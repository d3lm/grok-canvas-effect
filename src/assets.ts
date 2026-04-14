export const NOISE_TEXTURE_PATH = '/noise.png';
export const LOGO_TEXTURE_PATHS = ['/logo.png', '/logoHalf.png', '/logoQuat.png'] as const;

export type LogoTexturePath = (typeof LOGO_TEXTURE_PATHS)[number];

export function getLogoTexturePath(viewportWidth: number): LogoTexturePath {
  if (viewportWidth >= 900) {
    return '/logo.png';
  }

  if (viewportWidth >= 450) {
    return '/logoHalf.png';
  }

  return '/logoQuat.png';
}
