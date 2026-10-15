import { useEffect, useRef } from 'react';
import { STAGE_H, STAGE_W } from './Stage';

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number }

/**
 * 합격 공개용 폭죽. 화면 위쪽과 양옆에서만 터져 사진·이름을 가리지 않고 durationMs 뒤 끝난다.
 * 빠른 점멸 없이 천천히 퍼지고 사라진다. 일시정지 중에는 멈춘다.
 */
export function Fireworks({ paused, durationMs = 6500, density = 1 }: { paused: boolean; durationMs?: number; density?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const sparks: Spark[] = [];
    let elapsed = 0;
    let nextBurst = 0;
    let last = performance.now();
    let raf = 0;

    // 사진·이름이 놓이는 가운데 아래 영역을 피한다
    const spot = () => {
      const side = Math.random();
      if (side < 0.5) return { x: 260 + Math.random() * 1400, y: 90 + Math.random() * 230 };
      return { x: side < 0.75 ? 120 + Math.random() * 220 : 1580 + Math.random() * 220, y: 140 + Math.random() * 420 };
    };

    const burst = () => {
      const { x, y } = spot();
      const hue = [42, 48, 36, 170, 330][Math.floor(Math.random() * 5)];
      const n = Math.round(70 * density);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const v = 2.2 + Math.random() * 2.6;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 70 + Math.random() * 40, hue });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (!pausedRef.current) {
        elapsed += dt;
        if (elapsed < durationMs - 1500 && elapsed >= nextBurst) {
          burst();
          nextBurst = elapsed + 420 + Math.random() * 380;
        }
        const k = dt / 16.7;
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life += k;
          s.x += s.vx * k;
          s.y += s.vy * k;
          s.vx *= 0.985;
          s.vy = s.vy * 0.985 + 0.035 * k;
          if (s.life > s.max) sparks.splice(i, 1);
        }
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        ctx.globalCompositeOperation = 'lighter';
        for (const s of sparks) {
          const a = 1 - s.life / s.max;
          ctx.fillStyle = `hsla(${s.hue}, 95%, ${60 + a * 20}%, ${a})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.6 + a * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (elapsed < durationMs || sparks.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, density]);

  return <canvas ref={canvas} className="fireworks" width={STAGE_W} height={STAGE_H} aria-hidden />;
}
