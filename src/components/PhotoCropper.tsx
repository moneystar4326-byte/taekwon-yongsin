import { useRef, useState } from 'react';
import type { Crop } from '../domain/types';
import { StudentPhoto } from './StudentPhoto';

const PREVIEW = 260;

/** 원형 프레임 안에서 드래그로 위치를, 슬라이더로 확대를 조절한다 */
export function PhotoCropper({
  url, name, initial, onSave, onCancel,
}: { url: string; name: string; initial?: Crop; onSave: (c: Crop) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState<Crop>(initial ?? { x: 0, y: 0, scale: 1 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // 확대한 만큼만 움직일 수 있게 해 원 안에 빈 곳이 생기지 않게 한다
  const clamp = (v: number, s: number) => {
    const lim = 50 * (s - 1);
    return Math.max(-lim, Math.min(lim, v));
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="사진 위치 조절">
      <div className="modal">
        <h3>사진 위치 조절 — {name}</h3>
        <p className="muted">아래 막대로 확대한 뒤 사진을 끌어서 얼굴 위치를 맞추세요.</p>
        <div
          className="cropper-area"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = ((e.clientX - d.px) / PREVIEW) * 100;
            const dy = ((e.clientY - d.py) / PREVIEW) * 100;
            setCrop((c) => ({ ...c, x: clamp(d.x + dx, c.scale), y: clamp(d.y + dy, c.scale) }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <StudentPhoto url={url} crop={crop} name={name} size={PREVIEW} className="photo-gold" />
        </div>
        <label className="field">
          <span>확대 {crop.scale.toFixed(2)}배</span>
          <input
            type="range" min={1} max={3} step={0.01} value={crop.scale}
            onChange={(e) => {
              const s = Number(e.target.value);
              setCrop((c) => ({ scale: s, x: clamp(c.x, s), y: clamp(c.y, s) }));
            }}
          />
        </label>
        <div className="row end">
          <button className="btn" onClick={() => setCrop({ x: 0, y: 0, scale: 1 })}>초기화</button>
          <button className="btn" onClick={onCancel}>취소</button>
          <button className="btn primary" onClick={() => onSave(crop)}>적용</button>
        </div>
      </div>
    </div>
  );
}
