import { useEffect, useState } from 'react';
import { getBlob } from '../services/storage';
import type { Workspace } from '../domain/types';

/**
 * Blob id 목록을 object URL 로 바꾼다. 목록이 바뀌거나 화면을 떠나면 URL 을 해제한다.
 * 불러오지 못한 사진은 결과에서 빠지며, 화면은 이니셜로 대체한다.
 */
export function usePhotoUrls(ws: Workspace, ids: (string | undefined)[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = [...new Set(ids.filter(Boolean) as string[])].sort().join('|');

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const wanted = key ? key.split('|') : [];
    (async () => {
      const next: Record<string, string> = {};
      for (const id of wanted) {
        try {
          const blob = await getBlob(ws, id);
          if (!blob || cancelled) continue;
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[id] = url;
        } catch {
          /* 사진 없이 진행 */
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [ws, key]);

  return urls;
}
