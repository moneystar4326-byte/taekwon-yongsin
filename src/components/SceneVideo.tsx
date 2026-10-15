import { useEffect, useRef } from 'react';

/**
 * 장면 영상 한 개. active 가 되면 처음부터 재생하고, 벗어나면 멈춘다.
 * paused 동안 멈췄다가 이어서 재생한다. loop 가 아니면 마지막 장면에서 멈춰 있는다.
 * 재생이 실패하면 onFail 로 알려 정지 이미지로 바꾼다.
 */
export function SceneVideo({
  src, poster, active, paused, loop, startDelayMs = 0, className, onFail,
}: {
  src: string;
  poster: string;
  active: boolean;
  paused: boolean;
  loop: boolean;
  startDelayMs?: number;
  className: string;
  onFail: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // 부모가 매번 새 함수를 넘겨도 재생이 처음으로 돌아가지 않게 ref 로 보관한다
  const failRef = useRef(onFail);
  failRef.current = onFail;

  const play = (v: HTMLVideoElement) =>
    v.play().catch((e: DOMException) => {
      // 장면 전환·일시정지로 재생이 중단된 것은 실패가 아니다
      if (e?.name !== 'AbortError') failRef.current();
    });

  // 장면에 들어올 때마다 처음부터
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    started.current = false;
    if (!active) {
      v.pause();
      return;
    }
    v.currentTime = 0;
    const id = window.setTimeout(() => {
      started.current = true;
      if (!pausedRef.current) void play(v);
    }, startDelayMs);
    return () => window.clearTimeout(id);
  }, [active, src, startDelayMs]);

  // 일시정지·재개
  useEffect(() => {
    const v = ref.current;
    if (!v || !active || !started.current) return;
    if (paused) v.pause();
    else if (loop || !v.ended) void play(v);
  }, [paused, active, loop]);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      playsInline
      preload="auto"
      loop={loop}
      onError={() => failRef.current()}
      disablePictureInPicture
    />
  );
}
