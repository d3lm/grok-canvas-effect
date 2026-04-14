const injectedLinks = new Map<string, HTMLLinkElement>();

/**
 * Extracts the first font family name from a CSS font-family string,
 * stripping quotes and ignoring fallbacks like `sans-serif`.
 */
export function parsePrimaryFamily(fontFamily: string): string | null {
  const first = fontFamily
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!first || isGenericFamily(first)) {
    return null;
  }

  return first;
}

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);

function isGenericFamily(name: string): boolean {
  return GENERIC_FAMILIES.has(name.toLowerCase());
}

async function ensureStylesheet(family: string): Promise<void> {
  const key = family.toLowerCase();

  if (injectedLinks.has(key)) {
    return;
  }

  const url = toGoogleFontsUrl(family);

  const link = document.createElement('link');

  link.rel = 'stylesheet';
  link.href = url;

  await new Promise<void>((resolve, reject) => {
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load font stylesheet for "${family}"`));

    document.head.appendChild(link);
  });

  injectedLinks.set(key, link);
}

/**
 * Loads a Google Font by injecting the stylesheet (once per family) then
 * triggering download of the requested weight via the Font Loading API.
 * Returns `true` if the font became available, `false` otherwise.
 */
export async function loadGoogleFont(family: string, weight = 400): Promise<boolean> {
  await ensureStylesheet(family);

  try {
    const spec = `${weight} 16px "${family}"`;

    await document.fonts.load(spec);
    await document.fonts.ready;

    return document.fonts.check(spec);
  } catch {
    return false;
  }
}

/**
 * Removes a previously injected Google Font stylesheet from the page.
 * The browser will stop using the font for any new renders.
 */
export function removeGoogleFont(family: string): void {
  const key = family.toLowerCase();
  const link = injectedLinks.get(key);

  if (link) {
    link.remove();
    injectedLinks.delete(key);
  }
}

function toGoogleFontsUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
}
