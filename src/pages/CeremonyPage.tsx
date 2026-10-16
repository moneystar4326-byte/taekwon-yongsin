import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildPresentationGroups, type PresentationSnapshot } from '../domain/buildPresentationGroups';
import { DEFAULT_AUTO, ceremonyReducer, initialState, stepDuration, type CeremonyState } from '../domain/ceremonyReducer';
import { LINES, groupLine } from '../domain/lines';
import { usableAvatar, type CeremonySettings, type Phase, type Workspace } from '../domain/types';
import {
  BG_VIDEOS, CLEAN_BACKGROUNDS, DRAGON_FACE_VIDEO, SCENE_VIDEOS, TEMP_BACKGROUNDS, TOUCH_INSERT_VIDEO, coreAssets, type AssetEntry, type BackgroundKey,
} from '../config/assets-manifest';
import { loadVideoList, preloadVideo, supportsAlphaWebm } from '../services/videos';
import { audio } from '../services/audio';
import { music, type Cue } from '../services/music';
import { preloadAll, preloadImage } from '../services/preload';
import {
  clearSession, getWorkspace, loadSession, loadSettings, loadStudents, saveSession, saveSettings, type SavedSession,
} from '../services/storage';
import { useCeremonyClock } from '../hooks/useCeremonyClock';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { Stage } from '../components/Stage';
import { CeremonyScene, type SceneAssets } from '../components/CeremonyScene';
import { OperatorControls } from '../components/OperatorControls';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Restore = { phase: 'IDLE' | 'READY' | 'COMPLETE'; groupIndex: number };

interface Ready {
  snapshot: PresentationSnapshot;
  settings: CeremonySettings;
  restore: Restore | null;
  assets: SceneAssets;
  warnings: number;
}

export function CeremonyPage() {
  const [ready, setReady] = useState<Ready | null>(null);
  return ready ? <Ceremony {...ready} ws={getWorkspace()} /> : <Gate onOpen={setReady} />;
}

// ─────────────────────────────────────────────────────────────
// 시작 전 점검: 자산 사전 로딩, 복원 위치 선택, 사용자 클릭으로 소리 활성화
// ─────────────────────────────────────────────────────────────
function Gate({ onOpen }: { onOpen: (r: Ready) => void }) {
  const ws = getWorkspace();
  const [settings, setSettings] = useState<CeremonySettings | null>(null);
  const [freshSnapshot, setFreshSnapshot] = useState<PresentationSnapshot | null>(null);
  const [session, setSession] = useState<SavedSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [failed, setFailed] = useState<AssetEntry[] | null>(null);
  const [cleanBg, setCleanBg] = useState<Record<BackgroundKey, boolean> | null>(null);
  const [videos, setVideos] = useState<{ ok: string[]; bad: string[] } | null>(null);
  const [allowFallback, setAllowFallback] = useState(false);
  const [choice, setChoice] = useState('fresh');
  const [fullscreen, setFullscreen] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, list, sess] = await Promise.all([loadSettings(ws), loadStudents(ws), loadSession(ws)]);
        if (cancelled) return;
        setSettings(s);
        setAllowFallback(s.allowFallbackAssets);
        setFreshSnapshot(buildPresentationGroups(list, s.mode));
        if (sess) {
          setSession(sess);
          setChoice(defaultChoice(sess));
        }
        const avatar = usableAvatar(sess?.avatar ?? s.avatar);
        const entries = coreAssets(avatar);
        const listed = await loadVideoList();
        const wanted = [...Object.values(SCENE_VIDEOS[avatar]).map((v) => v.path), TOUCH_INSERT_VIDEO, ...(supportsAlphaWebm() ? [DRAGON_FACE_VIDEO] : []), ...Object.values(BG_VIDEOS)].filter((p) => listed.has(p));
        const [results, cleanDay, cleanSummon, videoResults] = await Promise.all([
          preloadAll(entries.map((e) => e.path), (d, t) => !cancelled && setProgress([d, t])),
          preloadImage(CLEAN_BACKGROUNDS.day.path),
          preloadImage(CLEAN_BACKGROUNDS.summon.path),
          Promise.all(wanted.map((p) => preloadVideo(p))),
        ]);
        if (cancelled) return;
        const bad = new Set(results.filter((r) => !r.ok).map((r) => r.path));
        setFailed(entries.filter((e) => bad.has(e.path)));
        setCleanBg({ day: cleanDay.ok, summon: cleanSummon.ok });
        setVideos({ ok: videoResults.filter((r) => r.ok).map((r) => r.path), bad: videoResults.filter((r) => !r.ok).map((r) => r.path) });
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [ws, attempt]);

  if (loadError) {
    return (
      <div className="gate"><div className="card">
        <h2>저장된 데이터를 불러오지 못했습니다</h2>
        <p className="error">{loadError}</p>
        <a className="btn" href="#/setup">준비 화면으로</a>
      </div></div>
    );
  }

  const loading = !settings || failed === null || cleanBg === null || videos === null;
  const options = session ? restoreOptions(session) : [];
  const usingSession = session && choice !== 'fresh';
  const snapshot = usingSession ? session.snapshot : freshSnapshot;
  const passCount = snapshot ? Object.keys(snapshot.students).length : 0;
  const needFallbackConsent = (failed?.length ?? 0) > 0;
  const canOpen = !loading && passCount > 0 && (!needFallbackConsent || allowFallback);

  const open = async () => {
    if (!settings || !snapshot) return;
    audio.unlock();
    music.configure(settings.volume, settings.muted, settings.bgm);
    music.preload();
    audio.configure(settings.volume, settings.muted);
    if (fullscreen) await document.documentElement.requestFullscreen?.().catch(() => undefined);
    const opt = options.find((o) => o.id === choice);
    const effective: CeremonySettings = usingSession
      ? { ...settings, avatar: usableAvatar(session.avatar), mode: session.mode }
      : settings;
    if (allowFallback !== settings.allowFallbackAssets) {
      void saveSettings(ws, { ...settings, allowFallbackAssets: allowFallback }).catch(() => undefined);
    }
    const failedPaths = new Set((failed ?? []).map((f) => f.path));
    const pick = (k: BackgroundKey) => (cleanBg?.[k] ? CLEAN_BACKGROUNDS[k] : TEMP_BACKGROUNDS[k]);
    const chosen = [pick('day'), pick('summon')];
    const temps = new Set(Object.values(TEMP_BACKGROUNDS).map((e) => e.path));
    onOpen({
      snapshot,
      settings: effective,
      restore: opt?.restore ?? null,
      warnings:
        coreAssets(effective.avatar).filter((e) => e.status !== 'approved' && !temps.has(e.path) && !failedPaths.has(e.path)).length +
        chosen.filter((e) => e.status !== 'approved').length,
      assets: {
        backgrounds: { day: pick('day').path, summon: pick('summon').path },
        // 임시 배경에는 흐린 구슬이 남아 있으므로 웹 구슬을 겹치지 않는다
        backgroundHasOrbs: !(cleanBg?.day && cleanBg?.summon),
        failed: failedPaths,
        videos: new Set(videos?.ok ?? []),
      },
    });
  };

  return (
    <div className="gate">
      <div className="card gate-card">
        <div className="row between">
          <h2>행사 시작 전 확인</h2>
          {ws === 'practice' && <span className="chip warn">연습 모드</span>}
        </div>

        <section>
          <h4>이미지 불러오기</h4>
          {loading ? (
            <p>불러오는 중… {progress[0]} / {progress[1]}</p>
          ) : failed!.length === 0 ? (
            <p className="ok">핵심 이미지 {progress[1]}개를 모두 불러왔습니다.{videos!.ok.length > 0 && ` 장면 영상 ${videos!.ok.length}개 준비됨.`}</p>
          ) : (
            <div className="error-box">
              <p>불러오지 못한 이미지가 있습니다.</p>
              <ul>{failed!.map((f) => <li key={f.path}><code>{f.path}</code> — {f.label}</li>)}</ul>
              <label className="check">
                <input type="checkbox" checked={allowFallback} onChange={(e) => setAllowFallback(e.target.checked)} />
                대체 배경으로 진행합니다
              </label>
              <button className="btn" onClick={() => setAttempt((n) => n + 1)}>다시 시도</button>
            </div>
          )}
          {videos && videos.bad.length > 0 && (
            <p className="warn-text">재생 준비가 안 된 영상 {videos.bad.length}개는 정지 이미지로 대신합니다: {videos.bad.map((p) => p.replace('assets/videos/', '')).join(', ')}</p>
          )}
          {cleanBg && (!cleanBg.day || !cleanBg.summon) && (
            <p className="warn-text">클린 배경({[!cleanBg.day && '밝음', !cleanBg.summon && '소환'].filter(Boolean).join(', ')})을 불러오지 못해 해당 장면은 <b>임시 배경</b>(흐린 장면)으로 표시됩니다.</p>
          )}
        </section>

        {session && (
          <section>
            <h4>이전 진행 기록이 있습니다</h4>
            <p className="muted">새로고침이나 종료 전 저장된 위치입니다. 결과는 자동으로 공개되지 않으니 이어갈 위치를 고르세요.</p>
            <div className="radio-list">
              {options.map((o) => (
                <label key={o.id} className="radio">
                  <input type="radio" name="restore" checked={choice === o.id} onChange={() => setChoice(o.id)} />
                  {o.label}
                </label>
              ))}
              <label className="radio">
                <input type="radio" name="restore" checked={choice === 'fresh'} onChange={() => setChoice('fresh')} />
                현재 명단으로 처음부터 새로 시작
              </label>
            </div>
          </section>
        )}

        <section>
          <h4>발표 대상</h4>
          {snapshot && passCount > 0 ? (
            <p>합격(PASS) {passCount}명 · 발표 {snapshot.groups.length}회 ({snapshot.groups.map((g) => `${g.poom}품${g.pageCount > 1 ? ` ${g.page}/${g.pageCount}` : ''}`).join(' → ')})</p>
          ) : (
            <p className="error">합격(PASS)으로 등록된 수련생이 없어 행사를 시작할 수 없습니다.</p>
          )}
        </section>

        <label className="check">
          <input type="checkbox" checked={fullscreen} onChange={(e) => setFullscreen(e.target.checked)} />
          전체화면으로 열기 (운영 패널은 숨겨지고 단축키로 진행합니다)
        </label>

        <div className="row end">
          <a className="btn" href="#/setup">준비 화면으로</a>
          <button className="btn primary big" disabled={!canOpen} onClick={open}>행사 시작</button>
        </div>
      </div>
    </div>
  );
}

const PRE_REVEAL: Phase[] = ['IDLE', 'TOUCH', 'SUMMON', 'DRAGON'];

function restoreOptions(s: SavedSession): { id: string; label: string; restore: Restore }[] {
  const n = s.snapshot.groups.length;
  const name = (i: number) => {
    const g = s.snapshot.groups[i];
    return g ? `${g.poom}품${g.pageCount > 1 ? ` ${g.page}/${g.pageCount}` : ''}` : '';
  };
  const opts: { id: string; label: string; restore: Restore }[] = [];
  if (PRE_REVEAL.includes(s.phase)) {
    opts.push({ id: 'first-ready', label: `소환 장면 생략하고 첫 발표(${name(0)}) 준비 화면부터`, restore: { phase: 'READY', groupIndex: 0 } });
  } else if (s.phase !== 'COMPLETE') {
    const shown = s.phase === 'REVEAL';
    opts.push({ id: 'same', label: `${name(s.groupIndex)} 발표 준비 화면부터 (${shown ? '이미 공개됨, 다시 공개' : '아직 공개 전'})`, restore: { phase: 'READY', groupIndex: s.groupIndex } });
    if (shown && s.groupIndex + 1 < n) {
      opts.push({ id: 'next', label: `다음 발표(${name(s.groupIndex + 1)}) 준비 화면부터`, restore: { phase: 'READY', groupIndex: s.groupIndex + 1 } });
    }
  }
  opts.push({ id: 'complete', label: '기념 페이지', restore: { phase: 'COMPLETE', groupIndex: Math.max(0, n - 1) } });
  opts.push({ id: 'start', label: '같은 명단으로 대기 장면부터 다시', restore: { phase: 'IDLE', groupIndex: 0 } });
  return opts;
}

function defaultChoice(s: SavedSession) {
  if (PRE_REVEAL.includes(s.phase)) return 'start';
  if (s.phase === 'COMPLETE') return 'complete';
  return s.phase === 'REVEAL' && s.groupIndex + 1 < s.snapshot.groups.length ? 'next' : 'same';
}

// ─────────────────────────────────────────────────────────────
// 행사 진행
// ─────────────────────────────────────────────────────────────
function Ceremony({ snapshot, settings, restore, assets, warnings, ws }: Ready & { ws: Workspace }) {
  const [state, dispatch] = useReducer(ceremonyReducer, null, () => {
    const auto = settings.autoAdvance
      ? { ...DEFAULT_AUTO, summonMs: settings.chantSeconds * 1000 }
      : null;
    const s = initialState(snapshot.groups.length, performance.now(), auto);
    return restore ? ceremonyReducer(s, { type: 'RESTORE', ...restore, now: performance.now() }) : s;
  });
  const [muted, setMuted] = useState(settings.muted);
  const [collapsed, setCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const prefersReduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const reduced = settings.reducedEffects || prefersReduced;
  const photos = usePhotoUrls(ws, [...Object.values(snapshot.students).map((s) => s.photoBlobId), settings.logoBlobId]);

  const stateRef = useRef(state);
  stateRef.current = state;

  // 자동 진행 타이머 (일시정지·재개 시 남은 시간 유지)
  useCeremonyClock(state.step, stepDuration(state), state.paused, () =>
    dispatch({ type: 'TIMER', step: stateRef.current.step, now: performance.now() }),
  );

  const next = useCallback(() => dispatch({ type: 'NEXT', now: performance.now() }), []);
  const togglePause = useCallback(() => dispatch({ type: stateRef.current.paused ? 'RESUME' : 'PAUSE' }), []);
  const replay = useCallback(() => dispatch({ type: 'REPLAY', now: performance.now() }), []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  useEffect(() => {
    audio.configure(settings.volume, muted);
    music.configure(settings.volume, muted, settings.bgm);
    void saveSettings(ws, { ...settings, muted }).catch(() => undefined);
  }, [muted, settings, ws]);

  // 배경 음악: 장면마다 곡을 정한다. 같은 곡이 이어지면 끊지 않는다
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;
  useEffect(() => {
    music.play(CUE_OF[state.phase]);
    music.setDuck(baseDuck(state.phase));
  }, [state.phase]);

  /** 대사 동안 음악을 낮췄다가 끝나면 되돌린다 */
  const say = useCallback((text: string, id?: string) => {
    music.setDuck(0.25);
    void audio.speak(text, id).then(() => music.setDuck(baseDuck(phaseRef.current)));
  }, []);

  // 대사·효과음: 장면이 바뀔 때 한 번만
  const spokenKey = useRef('');
  useEffect(() => {
    const key = `${state.phase}|${state.groupIndex}|${state.phase === 'COUNTDOWN' ? state.count : ''}|${state.phase === 'COUNTDOWN' || state.phase === 'REVEAL' ? state.step : ''}`;
    if (spokenKey.current === key) return;
    spokenKey.current = key;
    const g = snapshot.groups[state.groupIndex];
    switch (state.phase) {
      case 'IDLE': say(LINES.idle, 'idle'); break;
      case 'TOUCH': audio.chime(440, 1.4); say(LINES.touch, 'touch'); break;
      case 'SUMMON': audio.cancel(); audio.boom(); break;
      case 'DRAGON': audio.boom(); say(LINES.dragon, 'dragon'); break;
      case 'READY': if (state.groupIndex === 0) say(LINES.ready, 'ready'); else audio.cancel(); break;
      case 'COUNTDOWN':
        if (state.count === 5) audio.riser(5.4); // 5에서 0까지 차오르는 상승음
        if (state.count > 0) audio.drum(state.count); else audio.cancel();
        break;
      case 'REVEAL':
        if (g) {
          audio.impact(); // 거대한 충격음 + 심벌
          if (!settings.bgm) audio.fanfare();
          const first = snapshot.students[g.studentIds[0]];
          if (g.studentIds.length === 1 && first) {
            // 한 명씩 발표: 용신 목소리로 이름까지 부른다
            music.setDuck(0.25);
            void audio
              .speakPass(first.name, first.pronunciation || first.name, g.poom)
              .then(() => music.setDuck(baseDuck(phaseRef.current)));
          } else {
            say(groupLine(g.poom), `pass${g.poom}`);
          }
        }
        break;
      case 'COMPLETE': say(LINES.complete, 'complete'); break;
    }
  }, [state.phase, state.groupIndex, state.count, state.step, snapshot, settings.mode, settings.bgm, say]);

  // 일시정지에 맞춰 음성·음악도 멈춘다
  useEffect(() => {
    if (state.paused) { audio.pause(); music.pause(); }
    else { audio.resume(); music.resume(); }
  }, [state.paused]);

  // 진행 위치 저장 (새로고침 복원용)
  useEffect(() => {
    saveSession(ws, {
      snapshot, avatar: settings.avatar, mode: settings.mode,
      phase: state.phase, groupIndex: state.groupIndex, savedAt: Date.now(),
    }).then(() => setError(null), (e: Error) => setError(`진행 위치 저장 실패: ${e.message}`));
  }, [ws, snapshot, settings.avatar, settings.mode, state.phase, state.groupIndex]);

  // 탭이 숨겨지면 일시정지 (돌아왔을 때 결과를 건너뛰지 않게)
  useEffect(() => {
    const onVis = () => { if (document.hidden) dispatch({ type: 'PAUSE' }); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 단축키: 입력창에 포커스가 있으면 무시. Esc 는 브라우저 기본(전체화면 해제)만
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (confirmEnd) return;
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.code === 'KeyM') { e.preventDefault(); toggleMute(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, togglePause, toggleMute, confirmEnd]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // 화면을 떠나면 음성 정리
  useEffect(() => () => { audio.cancel(); music.stop(); }, []);

  const end = async () => {
    audio.cancel();
    await clearSession(ws).catch(() => undefined);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    window.location.hash = '#/setup';
  };

  const fullscreenToggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => setError('이 브라우저에서는 전체화면을 쓸 수 없습니다.'));
  };

  return (
    <div className={`ceremony ${isFullscreen ? 'fullscreen' : ''} ${state.paused ? 'is-paused' : ''}`}>
      <Stage>
        <CeremonyScene
          state={state} snapshot={snapshot} avatar={settings.avatar} mode={settings.mode}
          photos={photos} assets={assets} reduced={reduced} practice={ws === 'practice'}
          brand={{
            logoUrl: settings.logoBlobId ? photos[settings.logoBlobId] : undefined,
            dojoName: settings.dojoName,
            examDate: settings.examDate,
          }}
        />
      </Stage>
      <div className="rotate-hint">가로로 돌려서 보세요</div>
      <OperatorControls
        state={state} snapshot={snapshot} muted={muted} collapsed={collapsed} error={error} assetWarnings={warnings}
        onNext={next} onTogglePause={togglePause} onReplay={replay} onToggleMute={toggleMute}
        onFullscreen={fullscreenToggle} onEnd={() => { dispatch({ type: 'PAUSE' }); setConfirmEnd(true); }}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      {confirmEnd && (
        <ConfirmDialog
          title="행사를 종료할까요?"
          confirmLabel="종료"
          danger
          onCancel={() => setConfirmEnd(false)}
          onConfirm={end}
        >
          {state.phase === 'COMPLETE'
            ? <p>모든 발표가 끝났습니다. 진행 기록을 지우고 준비 화면으로 돌아갑니다.</p>
            : <p>아직 발표가 남아 있습니다({phaseProgress(state, snapshot)}). 종료하면 진행 위치 기록이 삭제됩니다. 명단과 사진은 그대로 남습니다.</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** 장면별 배경 음악 */
const CUE_OF: Record<Phase, Cue> = {
  IDLE: 'calm', TOUCH: 'calm',
  SUMMON: 'epic', DRAGON: 'epic', READY: 'tension', COUNTDOWN: 'tension',
  REVEAL: 'triumph', COMPLETE: 'finale',
};

/** 카운트다운 동안은 북소리가 들리게 음악을 낮춘다 */
const baseDuck = (p: Phase) => (p === 'COUNTDOWN' ? 0.55 : 1);

function phaseProgress(s: CeremonyState, snap: PresentationSnapshot) {
  if (PRE_REVEAL.includes(s.phase)) return `발표 ${snap.groups.length}회 모두 남음`;
  const done = s.phase === 'REVEAL' ? s.groupIndex + 1 : s.groupIndex;
  return `발표 ${snap.groups.length}회 중 ${done}회 완료`;
}
