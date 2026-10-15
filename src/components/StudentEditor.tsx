import { useState } from 'react';
import { POOMS, type Poom, type Result, type Student } from '../domain/types';
import { ACCEPT_ATTR } from '../services/image';
import { audio } from '../services/audio';
import { StudentPhoto } from './StudentPhoto';

export const RESULT_LABEL: Record<Result, string> = { PENDING: '미정', PASS: '합격', FAIL: '불합격' };

/** 포커스를 잃거나 Enter 를 누를 때만 저장하는 입력칸 */
function CommitInput({
  value, onCommit, placeholder, className = '', ariaLabel,
}: { value: string; onCommit: (v: string) => void; placeholder?: string; className?: string; ariaLabel: string }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setDraft(value); }
  const commit = () => { if (draft.trim() !== value) onCommit(draft.trim()); };
  return (
    <input
      className={className}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={30}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function StudentEditor({
  students, photos, selected, onSelect, onAdd, onUpdate, onPhoto, onCrop, onRemovePhoto, onMove,
}: {
  students: Student[];
  photos: Record<string, string>;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onAdd: (name: string, poom: Poom) => void;
  onUpdate: (s: Student, patch: Partial<Student>) => void;
  onPhoto: (s: Student, file: File) => void;
  onCrop: (s: Student) => void;
  onRemovePhoto: (s: Student) => void;
  onMove: (s: Student, dir: -1 | 1) => void;
}) {
  const [name, setName] = useState('');
  const [poom, setPoom] = useState<Poom>(1);
  const allSelected = students.length > 0 && students.every((s) => selected.has(s.id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelect(next);
  };

  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), poom);
    setName('');
  };

  return (
    <div className="students">
      <form className="add-row" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="수련생 이름" aria-label="새 수련생 이름" maxLength={30} />
        <select value={poom} onChange={(e) => setPoom(Number(e.target.value) as Poom)} aria-label="응시 품">
          {POOMS.map((p) => <option key={p} value={p}>{p}품</option>)}
        </select>
        <button className="btn primary" type="submit" disabled={!name.trim()}>추가</button>
        <span className="muted small">새로 추가하면 결과는 ‘미정’입니다.</span>
      </form>

      {students.length === 0 ? (
        <p className="empty">아직 등록된 수련생이 없습니다.</p>
      ) : (
        <table className="student-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="전체 선택" checked={allSelected} onChange={() => onSelect(allSelected ? new Set() : new Set(students.map((s) => s.id)))} /></th>
              <th>사진</th>
              <th>이름</th>
              <th>발음(선택)</th>
              <th>응시 품</th>
              <th>결과</th>
              <th>순서</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id} className={`result-${s.result.toLowerCase()}`}>
                <td data-label="선택"><input type="checkbox" aria-label={`${s.name} 선택`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                <td data-label="사진">
                  <div className="photo-cell">
                    <StudentPhoto url={s.photoBlobId ? photos[s.photoBlobId] : undefined} crop={s.crop} name={s.name} size={52} />
                    <div className="photo-actions">
                      <label className="btn tiny">
                        {s.photoBlobId ? '교체' : '사진'}
                        <input
                          type="file" accept={ACCEPT_ATTR} hidden
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(s, f); }}
                        />
                      </label>
                      {s.photoBlobId && <button className="btn tiny" onClick={() => onCrop(s)}>위치</button>}
                      {s.photoBlobId && <button className="btn tiny" onClick={() => onRemovePhoto(s)}>지우기</button>}
                    </div>
                  </div>
                </td>
                <td data-label="이름">
                  <CommitInput value={s.name} ariaLabel="이름" onCommit={(v) => v && onUpdate(s, { name: v })} />
                </td>
                <td data-label="발음">
                  <div className="pron">
                    <CommitInput value={s.pronunciation ?? ''} ariaLabel="발음" placeholder="예: 김서윤" onCommit={(v) => onUpdate(s, { pronunciation: v || undefined })} />
                    <button
                      className="btn tiny" title="발음 미리듣기"
                      onClick={() => { audio.unlock(); void audio.speak(s.pronunciation || s.name); }}
                    >듣기</button>
                  </div>
                </td>
                <td data-label="품">
                  <select value={s.poom} aria-label="응시 품" onChange={(e) => onUpdate(s, { poom: Number(e.target.value) as Poom })}>
                    {POOMS.map((p) => <option key={p} value={p}>{p}품</option>)}
                  </select>
                </td>
                <td data-label="결과">
                  <select className={`result-select ${s.result.toLowerCase()}`} value={s.result} aria-label="결과" onChange={(e) => onUpdate(s, { result: e.target.value as Result })}>
                    {(['PENDING', 'PASS', 'FAIL'] as Result[]).map((r) => <option key={r} value={r}>{RESULT_LABEL[r]}</option>)}
                  </select>
                </td>
                <td data-label="순서">
                  <button className="btn tiny" aria-label="위로" disabled={i === 0} onClick={() => onMove(s, -1)}>▲</button>
                  <button className="btn tiny" aria-label="아래로" disabled={i === students.length - 1} onClick={() => onMove(s, 1)}>▼</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
