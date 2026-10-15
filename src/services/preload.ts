/** 불러온 이미지를 붙잡아 두어 행사 중 다시 내려받지 않게 한다 */
const keep = new Map<string, HTMLImageElement>();

export interface PreloadResult {
  path: string;
  ok: boolean;
}

export function preloadImage(path: string): Promise<PreloadResult> {
  const hit = keep.get(path);
  if (hit?.complete && hit.naturalWidth > 0) return Promise.resolve({ path, ok: true });
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      keep.set(path, img);
      resolve({ path, ok: true });
    };
    img.onerror = () => resolve({ path, ok: false });
    img.src = path;
  });
}

export async function preloadAll(paths: string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  const unique = [...new Set(paths)];
  return Promise.all(
    unique.map((p) =>
      preloadImage(p).then((r) => {
        onProgress?.(++done, unique.length);
        return r;
      }),
    ),
  );
}
