import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, ENABLED_AVATARS, type CeremonySettings, type Poom, type Result, type Student, type Workspace } from '../domain/types';
import { SCENES } from '../config/assets-manifest';
import { ACCEPT_ATTR, prepareImage } from '../services/image';
import {
  deleteBlob, deleteStudents, getWorkspace, loadSettings, loadStudents, newId, putBlob, putStudents,
  saveSettings, setWorkspace, wipeWorkspace,
} from '../services/storage';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { StudentEditor, RESULT_LABEL } from '../components/StudentEditor';
import { PhotoCropper } from '../components/PhotoCropper';
import { PreflightCheck } from '../components/PreflightCheck';
import { ConfirmDialog } from '../components/ConfirmDialog';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

type Dialog =
  | { kind: 'bulk'; ids: string[]; result: Result }
  | { kind: 'delete'; list: Student[] }
  | { kind: 'wipe' }
  | null;

const PRACTICE_NAMES = ['연습하늘', '연습바다', '연습별님', '연습구름', '연습나무', '연습햇살', '연습바람', '연습새싹', '연습달님'];

export function SetupPage() {
  const [ws, setWs] = useState<Workspace>(getWorkspace());
  const [settings, setSettings] = useState<CeremonySettings | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cropping, setCropping] = useState<Student | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [bulkResult, setBulkResult] = useState<Result>('PASS');
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    setSelected(new Set());
    Promise.all([loadSettings(ws), loadStudents(ws)])
      .then(([s, list]) => { if (!cancelled) { setSettings(s); setStudents(list); setLoadError(null); } })
      .catch((e: Error) => { if (!cancelled) { setLoadError(e.message); setSettings(DEFAULT_SETTINGS); } });
    return () => { cancelled = true; };
  }, [ws]);

  const photoIds = useMemo(() => [...students.map((s) => s.photoBlobId), settings?.logoBlobId], [students, settings?.logoBlobId]);
  const photos = usePhotoUrls(ws, photoIds);

  /** 저장이 실제로 끝난 뒤에만 '저장됨'으로 표시한다 */
  const persist = useCallback(async (p: Promise<unknown>) => {
    setSave({ kind: 'saving' });
    try {
      await p;
      setSave({ kind: 'saved' });
      return true;
    } catch (e) {
      setSave({ kind: 'error', message: (e as Error).message });
      return false;
    }
  }, []);

  if (!settings) {
    return <div className="setup"><p className="muted pad">불러오는 중…</p></div>;
  }

  const updateSettings = (patch: Partial<CeremonySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void persist(saveSettings(ws, next));
  };

  const updateStudent = (s: Student, patch: Partial<Student>) => {
    const next = { ...s, ...patch };
    setStudents((list) => list.map((x) => (x.id === s.id ? next : x)));
    void persist(putStudents(ws, [next]));
  };

  const addStudent = (name: string, poom: Poom) => {
    const order = students.reduce((m, s) => Math.max(m, s.order), 0) + 1;
    const s: Student = { id: newId(), name, poom, result: 'PENDING', order };
    setStudents((list) => [...list, s]);
    void persist(putStudents(ws, [s]));
  };

  const move = (s: Student, dir: -1 | 1) => {
    const i = students.findIndex((x) => x.id === s.id);
    const j = i + dir;
    if (j < 0 || j >= students.length) return;
    const a = { ...students[i], order: students[j].order };
    const b = { ...students[j], order: students[i].order };
    const list = [...students];
    list[i] = b;
    list[j] = a;
    setStudents(list);
    void persist(putStudents(ws, [a, b]));
  };

  const setPhoto = async (s: Student, file: File) => {
    setPhotoError(null);
    try {
      const blob = await prepareImage(file);
      const id = await putBlob(ws, blob);
      const next = { ...s, photoBlobId: id, crop: { x: 0, y: 0, scale: 1 } };
      const ok = await persist(putStudents(ws, [next]));
      if (!ok) { await deleteBlob(ws, id).catch(() => undefined); return; }
      if (s.photoBlobId) await deleteBlob(ws, s.photoBlobId).catch(() => undefined);
      setStudents((list) => list.map((x) => (x.id === s.id ? next : x)));
      setCropping(next);
    } catch (e) {
      setPhotoError(`${s.name}: ${(e as Error).message}`);
    }
  };

  const removePhoto = async (s: Student) => {
    const next = { ...s, photoBlobId: undefined, crop: undefined };
    if (await persist(putStudents(ws, [next]))) {
      setStudents((list) => list.map((x) => (x.id === s.id ? next : x)));
      if (s.photoBlobId) await deleteBlob(ws, s.photoBlobId).catch(() => undefined);
    }
  };

  const setLogo = async (file: File) => {
    setPhotoError(null);
    try {
      const blob = await prepareImage(file, { keepAlpha: true });
      const id = await putBlob(ws, blob);
      const old = settings.logoBlobId;
      updateSettings({ logoBlobId: id });
      if (old) await deleteBlob(ws, old).catch(() => undefined);
    } catch (e) {
      setPhotoError(`로고: ${(e as Error).message}`);
    }
  };

  const switchWorkspace = (next: Workspace) => {
    setWorkspace(next);
    setWs(next);
  };

  const seedPractice = () => {
    const base = students.reduce((m, s) => Math.max(m, s.order), 0);
    const results: Result[] = ['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'FAIL', 'PASS', 'PENDING', 'PASS'];
    const poomOf: Poom[] = [1, 1, 1, 1, 1, 1, 2, 2, 3];
    const list: Student[] = PRACTICE_NAMES.map((name, i) => ({
      id: newId(), name, poom: poomOf[i], result: results[i], order: base + i + 1,
    }));
    setStudents((l) => [...l, ...list]);
    void persist(putStudents(ws, list));
  };

  const selectedList = students.filter((s) => selected.has(s.id));
  const passCount = students.filter((s) => s.result === 'PASS').length;

  return (
    <div className={`setup ${ws === 'practice' ? 'practice' : ''}`}>
      <header className="setup-header">
        <div>
          <h1>태권용신 <small>열한 빛의 약속 · 행사 준비</small></h1>
          <p className="muted small">이 기기 브라우저에만 저장됩니다. 서버로 전송하지 않습니다. 국기원 공식 서비스가 아닙니다.</p>
        </div>
        <div className="header-actions">
          <div className="segmented" role="group" aria-label="작업 공간">
            <button className={ws === 'real' ? 'on' : ''} onClick={() => switchWorkspace('real')}>실제 명단</button>
            <button className={ws === 'practice' ? 'on' : ''} onClick={() => switchWorkspace('practice')}>연습 모드</button>
          </div>
          <SaveIndicator state={save} />
        </div>
      </header>

      {ws === 'practice' && (
        <div className="banner practice-banner">
          연습 모드입니다. 여기 데이터는 실제 명단과 따로 저장되며, 무대에 ‘연습 모드’ 표시가 나옵니다.
          {students.length === 0 && <button className="btn tiny" onClick={seedPractice}>가상 명단 채우기</button>}
        </div>
      )}
      {loadError && <div className="banner error">{loadError}</div>}

      <Section title="1. 행사 설정">
        <div className="form-grid">
          <label className="field"><span>행사 제목</span>
            <input value={settings.title} maxLength={40} onChange={(e) => setSettings({ ...settings, title: e.target.value })} onBlur={() => updateSettings({})} />
          </label>
          <label className="field"><span>도장명</span>
            <input value={settings.dojoName} maxLength={30} placeholder="예: 한빛태권도" onChange={(e) => setSettings({ ...settings, dojoName: e.target.value })} onBlur={() => updateSettings({})} />
          </label>
          <label className="field"><span>심사일</span>
            <input type="date" value={settings.examDate} onChange={(e) => updateSettings({ examDate: e.target.value })} />
          </label>
          <div className="field"><span>도장 로고 (선택)</span>
            <div className="row">
              {settings.logoBlobId && photos[settings.logoBlobId] && <img className="logo-preview" src={photos[settings.logoBlobId]} alt="로고" />}
              <label className="btn tiny">{settings.logoBlobId ? '로고 교체' : '로고 올리기'}
                <input type="file" accept={ACCEPT_ATTR} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void setLogo(f); }} />
              </label>
              {settings.logoBlobId && (
                <button className="btn tiny" onClick={() => { const id = settings.logoBlobId!; updateSettings({ logoBlobId: undefined }); void deleteBlob(ws, id).catch(() => undefined); }}>로고 지우기</button>
              )}
            </div>
          </div>
        </div>

        <div className="field"><span>대표 수련생 (주인공)</span>
          <div className="avatar-pick">
            {ENABLED_AVATARS.map((a) => (
              <button key={a} className={`avatar-card ${settings.avatar === a ? 'on' : ''}`} onClick={() => updateSettings({ avatar: a })}>
                <img src={SCENES[a].idle.path} alt="" />
                <span>{a === 'boy' ? '남자' : '여자'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="field"><span>발표 방식</span>
            <span>한 명씩 사진을 보여 준 뒤 [합격 발표]로 공개합니다.</span>
            <span className="muted small">품 순서는 1품 → 4품, 같은 품 안에서는 명단 순서대로 발표합니다.</span>
          </div>
          <label className="field"><span>음량 {Math.round(settings.volume * 100)}%</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => setSettings({ ...settings, volume: Number(e.target.value) })} onPointerUp={() => updateSettings({})} onKeyUp={() => updateSettings({})} />
          </label>
          <div className="field"><span>진행 방식</span>
            <label className="check"><input type="checkbox" checked={settings.autoAdvance} onChange={(e) => updateSettings({ autoAdvance: e.target.checked })} /> 도입부 자동 진행</label>
            {settings.autoAdvance && (
              <label className="check small">구호 시간
                <select value={settings.chantSeconds} onChange={(e) => updateSettings({ chantSeconds: Number(e.target.value) })}>
                  {[6, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}초</option>)}
                </select>
              </label>
            )}
            <span className="muted small">
              {settings.autoAdvance
                ? '[시작] 한 번이면 용신 등장까지 자동으로 진행됩니다. 합격 발표와 다음 수련생은 직접 누릅니다.'
                : '소환 장면에서도 구호가 끝나면 [다음]을 눌러 진행합니다.'}
            </span>
          </div>
          <div className="field"><span>옵션</span>
            <label className="check"><input type="checkbox" checked={settings.bgm} onChange={(e) => updateSettings({ bgm: e.target.checked })} /> 배경 음악</label>
            <label className="check"><input type="checkbox" checked={settings.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} /> 음소거로 시작</label>
            <label className="check"><input type="checkbox" checked={settings.reducedEffects} onChange={(e) => updateSettings({ reducedEffects: e.target.checked })} /> 효과 줄이기 (폭죽·움직임 최소화)</label>
          </div>
        </div>
      </Section>

      <Section title={`2. 수련생 명단 (${students.length}명 · 합격 ${passCount}명)`}>
        {photoError && <div className="banner error">{photoError} <button className="btn tiny" onClick={() => setPhotoError(null)}>닫기</button></div>}
        <StudentEditor
          students={students} photos={photos} selected={selected} onSelect={setSelected}
          onAdd={addStudent} onUpdate={updateStudent} onPhoto={(s, f) => void setPhoto(s, f)}
          onCrop={setCropping} onRemovePhoto={(s) => void removePhoto(s)} onMove={move}
        />
        {students.length > 0 && (
          <div className="bulk-bar">
            <span>선택 {selectedList.length}명</span>
            <select value={bulkResult} onChange={(e) => setBulkResult(e.target.value as Result)} aria-label="일괄 변경할 결과">
              {(['PASS', 'FAIL', 'PENDING'] as Result[]).map((r) => <option key={r} value={r}>{RESULT_LABEL[r]}</option>)}
            </select>
            <button className="btn" disabled={!selectedList.length} onClick={() => setDialog({ kind: 'bulk', ids: selectedList.map((s) => s.id), result: bulkResult })}>결과 일괄 변경</button>
            <button className="btn danger" disabled={!selectedList.length} onClick={() => setDialog({ kind: 'delete', list: selectedList })}>선택 삭제</button>
          </div>
        )}
      </Section>

      <Section title="3. 시작 전 점검">
        <PreflightCheck students={students} settings={settings} />
        <div className="start-row">
          <a className={`btn primary big ${passCount === 0 ? 'disabled' : ''}`} href={passCount ? '#/ceremony' : undefined} aria-disabled={passCount === 0}>
            행사 진행 화면으로 ▶
          </a>
          {passCount === 0 && <span className="bad-text">합격(PASS) 수련생이 있어야 시작할 수 있습니다.</span>}
          {passCount > 0 && (
            <button
              className="btn"
              title="합격자 이름을 용신 목소리로 녹음하기 위한 목록 파일을 저장합니다"
              onClick={() => {
                // 형식: 품<TAB>이름<TAB>발음  (scripts/make-voice.ps1 -Names 로 녹음)
                const rows = students
                  .filter((s) => s.result === 'PASS')
                  .map((s) => `${s.poom}\t${s.name}\t${s.pronunciation ?? ''}`);
                const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'voice-names.txt';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              이름 음성 목록 저장
            </button>
          )}
        </div>
      </Section>

      <Section title="데이터 관리">
        <p className="muted small">{ws === 'practice' ? '연습' : '실제'} 데이터(명단·사진·로고·설정·진행 기록)를 이 기기에서 모두 지웁니다.</p>
        <button className="btn danger" onClick={() => setDialog({ kind: 'wipe' })}>{ws === 'practice' ? '연습' : '실제'} 데이터 전체 삭제</button>
      </Section>

      {cropping?.photoBlobId && photos[cropping.photoBlobId] && (
        <PhotoCropper
          url={photos[cropping.photoBlobId]} name={cropping.name} initial={cropping.crop}
          onCancel={() => setCropping(null)}
          onSave={(crop) => { updateStudent(cropping, { crop }); setCropping(null); }}
        />
      )}

      {dialog?.kind === 'bulk' && (
        <ConfirmDialog
          title="결과 일괄 변경" confirmLabel={`${dialog.ids.length}명 변경`}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const changed = students.filter((s) => dialog.ids.includes(s.id)).map((s) => ({ ...s, result: dialog.result }));
            setStudents((list) => list.map((s) => changed.find((c) => c.id === s.id) ?? s));
            void persist(putStudents(ws, changed));
            setDialog(null);
          }}
        >
          <p>선택한 <b>{dialog.ids.length}명</b>의 결과를 <b>‘{RESULT_LABEL[dialog.result]}’</b>으로 바꿉니다.</p>
          <p className="muted small">{students.filter((s) => dialog.ids.includes(s.id)).map((s) => s.name).join(', ')}</p>
        </ConfirmDialog>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="수련생 삭제" confirmLabel={`${dialog.list.length}명 삭제`} danger
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            const ids = new Set(dialog.list.map((s) => s.id));
            if (await persist(deleteStudents(ws, dialog.list))) {
              setStudents((list) => list.filter((s) => !ids.has(s.id)));
              setSelected(new Set());
            }
            setDialog(null);
          }}
        >
          <p><b>{dialog.list.length}명</b>을 삭제합니다{dialog.list.some((s) => s.photoBlobId) ? ` (사진 ${dialog.list.filter((s) => s.photoBlobId).length}장 포함)` : ''}. 되돌릴 수 없습니다.</p>
          <p className="muted small">{dialog.list.map((s) => s.name).join(', ')}</p>
        </ConfirmDialog>
      )}

      {dialog?.kind === 'wipe' && (
        <ConfirmDialog
          title="전체 삭제" confirmLabel="모두 삭제" danger
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            if (await persist(wipeWorkspace(ws))) {
              setStudents([]);
              setSettings(DEFAULT_SETTINGS);
              setSelected(new Set());
            }
            setDialog(null);
          }}
        >
          <p>{ws === 'practice' ? '연습' : '실제'} 데이터의 수련생 <b>{students.length}명</b>, 사진 <b>{students.filter((s) => s.photoBlobId).length}장</b>, 로고, 설정, 진행 기록을 모두 지웁니다. 되돌릴 수 없습니다.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === 'saving') return <span className="save saving">저장 중…</span>;
  if (state.kind === 'saved') return <span className="save saved">저장됨</span>;
  if (state.kind === 'error') return <span className="save error" title={state.message}>저장 실패: {state.message}</span>;
  return null;
}
