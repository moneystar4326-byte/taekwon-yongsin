import type { Crop } from '../domain/types';

/** 원형 사진. 사진이 없으면 이름 첫 글자를 보여준다. 이름은 텍스트 노드로만 렌더링한다 */
export function StudentPhoto({
  url, crop, name, size, className = '',
}: { url?: string; crop?: Crop; name: string; size: number; className?: string }) {
  const c = crop ?? { x: 0, y: 0, scale: 1 };
  const initial = name.trim().charAt(0) || '?';
  return (
    <div className={`photo ${className}`} style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ transform: `translate(${c.x}%, ${c.y}%) scale(${c.scale})` }}
        />
      ) : (
        <span className="photo-initial" style={{ fontSize: size * 0.42 }}>{initial}</span>
      )}
    </div>
  );
}
