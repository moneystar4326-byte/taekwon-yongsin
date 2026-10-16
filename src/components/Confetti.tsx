import { useEffect, useRef } from 'react';
import { STAGE_H, STAGE_W } from './Stage';

interface Piece { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string; sway: number }

const COLORS = ['#ffd75e', '#ffbf2e', '#fff3c4', '#ff6b6b', '#4fd1c5', '#7f9cf5', '#f6ad55', '#ffffff'];

/**
 * 합격 공개 꽃가루. 양옆 위에서 한 번 크게 뿌려진 뒤 천천히 내려앉는다.
 * 사진·이름이 있는 가운데는 덜 덮도록 양쪽에서 비스듬히 쏘아 올린다. 일시정지 중에는 멈춘다.
 */
export function Confetti({ paused, durationMs = 8000 }: { paused: boolean; durationMs?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const pieces: Piece[] = [];
    const shoot = (fromLeft: boolean, n: number) => {
      for (let i = 0; i < n; i++) {
        const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 40;
        const speed = 14 + Math.random() * 12;
        pieces.push({
          x: fromLeft ? -20 : STAGE_W + 20,
          y: STAGE_H * (0.55 + Math.random() * 0.2),
          vx: Math.cos((angle * Math.PI) / 180) * speed,
          vy: Math.sin((angle * Math.PI) / 180) * speed,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          w: 10 + Math.random() * 10,
          h: 6 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          sway: Math.random() * Math.PI * 2,
        });
      }
    };
    shoot(true, 140);
    shoot(false, 140);

    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    let second = false;
    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (!pausedRef.current) {
        elapsed += dt;
        if (!second && elapsed > 900) {
          second = true;
          shoot(true, 70);
          shoot(false, 70);
        }
        const k = dt / 16.7;
        const fade = Math.max(0, Math.min(1, (durationMs - elapsed) / 1500));
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        for (let i = pieces.length - 1; i >= 0; i--) {
          const p = pieces[i];
          p.vx *= 0.985;
          p.vy = Math.min(p.vy + 0.32 * k, 3.2); // 떨어질 때는 천천히
          p.sway += 0.08 * k;
          p.x += (p.vx + Math.sin(p.sway) * 1.2) * k;
          p.y += p.vy * k;
          p.rot += p.vr * k;
          if (p.y > STAGE_H + 40) { pieces.splice(i, 1); continue; }
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.abs(Math.cos(p.sway))); // 뒤집히며 반짝이는 느낌
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (elapsed < durationMs && pieces.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return <canvas ref={canvas} className="fireworks confetti" width={STAGE_W} height={STAGE_H} aria-hidden />;
}
