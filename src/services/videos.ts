import { VIDEO_MANIFEST } from '../config/assets-manifest';

/** npm run videos 가 만든 목록을 읽는다. 없거나 깨져 있으면 빈 목록(= 모두 정지 이미지) */
export async function loadVideoList(): Promise<Set<string>> {
  try {
    const r = await fetch(VIDEO_MANIFEST, { cache: 'no-store' });
    if (!r.ok) return new Set();
    const j = (await r.json()) as { videos?: unknown };
    return new Set(Array.isArray(j.videos) ? j.videos.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** 영상이 실제로 재생 가능한 만큼 받아졌는지 확인한다. 시간 안에 안 되면 실패로 보고 정지 이미지를 쓴다 */
export function preloadVideo(path: string, timeoutMs = 20000): Promise<{ path: string; ok: boolean }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      resolve({ path, ok });
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    v.muted = true;
    v.preload = 'auto';
    v.oncanplaythrough = () => finish(true);
    v.onerror = () => finish(false);
    v.src = path;
    v.load();
  });
}
