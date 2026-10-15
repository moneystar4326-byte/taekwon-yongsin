import { useEffect, useRef } from 'react';

/**
 * 일시정지할 수 있는 타이머.
 * key 가 바뀌면 새로 시작하고, paused 동안 멈췄다가 재개 시 남은 시간부터 이어 간다.
 * 컴포넌트가 해제되면 타이머를 정리한다.
 */
export function useCeremonyClock(key: number, ms: number | null, paused: boolean, onDone: () => void) {
  const remaining = useRef<{ key: number; left: number } | null>(null);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    if (ms == null) return;
    if (!remaining.current || remaining.current.key !== key) remaining.current = { key, left: ms };
    if (paused) return;
    const slot = remaining.current;
    const started = performance.now();
    const id = window.setTimeout(() => {
      slot.left = 0;
      cb.current();
    }, slot.left);
    return () => {
      window.clearTimeout(id);
      slot.left = Math.max(0, slot.left - (performance.now() - started));
    };
  }, [key, ms, paused]);
}
