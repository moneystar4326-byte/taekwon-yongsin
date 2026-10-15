import type { CeremonyState } from '../domain/ceremonyReducer';
import type { PresentationSnapshot } from '../domain/buildPresentationGroups';

const PHASE_LABEL: Record<CeremonyState['phase'], string> = {
  IDLE: '1 대기',
  TOUCH: '2 손 얹기',
  SUMMON: '3 소환 (구호)',
  DRAGON: '4 용신 등장',
  READY: '합격 발표 대기',
  COUNTDOWN: '5 카운트다운',
  REVEAL: '6 합격 공개',
  COMPLETE: '기념 페이지',
};

const HINT: Record<CeremonyState['phase'], string> = {
  IDLE: '[시작]을 누르면 대표 수련생이 구슬에 손을 얹습니다.',
  TOUCH: '약 6초 뒤 자동으로 소환 장면으로 넘어갑니다.',
  SUMMON: '아이들의 구호가 끝나면 [다음]을 누르세요.',
  DRAGON: '약 10초 뒤 자동으로 발표 준비로 넘어갑니다.',
  READY: '수련생 사진을 보여 주는 중입니다. [합격 발표]를 누르면 카운트다운 후 합격이 공개됩니다.',
  COUNTDOWN: '카운트다운 중에는 다음 버튼이 잠깁니다.',
  REVEAL: '축하 시간입니다. [다음 수련생]을 누르면 다음 사진이 나옵니다. [다시 보기]로 같은 발표를 한 번 더.',
  COMPLETE: '모든 발표가 끝났습니다. [종료]로 행사를 마칩니다.',
};

/** 자동 진행일 때 안내 */
const AUTO_HINT: Partial<Record<CeremonyState['phase'], string>> = {
  IDLE: '잠시 뒤 자동으로 시작됩니다(용신 등장까지 자동, 첫 수련생 사진에서 멈춤). [시작]으로 바로 넘어갈 수 있습니다.',
  SUMMON: '아이들이 구호를 외치는 시간입니다. 정해진 시간 뒤 용신이 나타납니다. [다음]으로 앞당길 수 있습니다.',
};

export function OperatorControls({
  state, snapshot, muted, collapsed, error, assetWarnings,
  onNext, onTogglePause, onReplay, onToggleMute, onFullscreen, onEnd, onToggleCollapse,
}: {
  state: CeremonyState;
  snapshot: PresentationSnapshot;
  muted: boolean;
  collapsed: boolean;
  error: string | null;
  assetWarnings: number;
  onNext: () => void;
  onTogglePause: () => void;
  onReplay: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onEnd: () => void;
  onToggleCollapse: () => void;
}) {
  const g = snapshot.groups[state.groupIndex];
  const names = g ? g.studentIds.map((id) => snapshot.students[id]?.name ?? '') : [];
  const nextLabel =
    state.phase === 'IDLE' ? '시작' :
    state.phase === 'READY' ? '합격 발표' :
    state.phase === 'REVEAL' ? (state.groupIndex + 1 < snapshot.groups.length ? (snapshot.groups[state.groupIndex + 1].studentIds.length === 1 ? '다음 수련생' : '다음 발표') : '기념 페이지') :
    '다음';
  const nextDisabled = state.paused || state.phase === 'COUNTDOWN' || state.phase === 'COMPLETE';

  return (
    <div className={`operator ${collapsed ? 'collapsed' : ''}`}>
      <button className="operator-toggle" onClick={onToggleCollapse} aria-expanded={!collapsed}>
        {collapsed ? '▲ 운영 패널' : '▼ 접기'}
      </button>
      {!collapsed && (
        <div className="operator-body">
          <div className="operator-info">
            <div className="operator-phase">
              <strong>{PHASE_LABEL[state.phase]}</strong>
              {g && ['READY', 'COUNTDOWN', 'REVEAL'].includes(state.phase) && (
                <span className="chip">
                  {g.poom}품{g.pageCount > 1 ? ` ${g.page}/${g.pageCount}` : ''} · {names.length}명 · 발표 {state.groupIndex + 1}/{snapshot.groups.length}
                </span>
              )}
              {state.paused && <span className="chip warn">일시정지</span>}
              {muted && <span className="chip">음소거</span>}
              {assetWarnings > 0 && <span className="chip warn">검수 필요 이미지 {assetWarnings}개 사용 중</span>}
            </div>
            <div className="operator-hint">{(state.auto && AUTO_HINT[state.phase]) || HINT[state.phase]}</div>
            {state.phase === 'READY' && <div className="operator-names">이번 발표: {names.join(', ')}</div>}
            {error && <div className="operator-error">{error}</div>}
          </div>
          <div className="operator-buttons">
            <button className="btn primary big" onClick={onNext} disabled={nextDisabled}>{nextLabel} ▶</button>
            <button className="btn" onClick={onTogglePause}>{state.paused ? '재개' : '일시정지'}</button>
            <button className="btn" onClick={onReplay} disabled={state.phase !== 'REVEAL' || state.paused}>다시 보기</button>
            <button className="btn" onClick={onToggleMute}>{muted ? '소리 켜기' : '음소거'}</button>
            <button className="btn" onClick={onFullscreen}>전체화면</button>
            <button className="btn danger" onClick={onEnd}>종료</button>
          </div>
          <div className="operator-keys">단축키: Space 일시정지/재개 · → 다음 · M 음소거 · Esc 전체화면 해제</div>
        </div>
      )}
    </div>
  );
}
