import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/**
 * 1920×1080 기준 무대를 주어진 영역에 비율 유지로 맞춘다.
 * 안쪽의 모든 좌표는 1920×1080 픽셀 기준이라 화면 크기와 상관없이 같은 배치가 된다.
 */
export function Stage({ children, className = '' }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="stage-outer" ref={outer}>
      <div
        className={`stage ${className}`}
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
