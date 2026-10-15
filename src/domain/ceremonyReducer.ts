import type { Phase } from './types';

export const TOUCH_MS = 6000;
export const DRAGON_MS = 10000;
export const COUNT_MS = 1000;
export const HUSH_MS = 400;
export const COUNT_FROM = 5;
/** 장면이 바뀐 직후 다음 입력을 무시하는 시간 (버튼 연타 방지) */
export const NEXT_GUARD_MS = 700;

/**
 * 도입부 자동 진행. 있으면 [시작] 한 번으로 소환 장면까지 스스로 넘어가 첫 수련생 사진에서 멈춘다.
 * 합격 발표(발표 준비 → 카운트다운)와 다음 수련생으로 넘어가기는 언제나 운영자가 누른다.
 * 없으면(null) 소환 장면에서도 운영자가 [다음]을 눌러야 한다.
 */
export interface AutoTiming {
  /** 대기: 첫 대사("열한 개의 수련구슬이 모였습니다") 뒤 손 얹기로 넘어가기까지 */
  idleMs: number;
  /** 소환: 아이들이 구호를 외치는 시간 */
  summonMs: number;
}

export const DEFAULT_AUTO: AutoTiming = { idleMs: 7000, summonMs: 10000 };

export interface CeremonyState {
  auto: AutoTiming | null;
  phase: Phase;
  groupIndex: number;
  groupCount: number;
  /** COUNTDOWN 중 표시 숫자 5..1, 0 = 공개 직전 정적 */
  count: number;
  paused: boolean;
  /** 장면(또는 카운트)이 바뀔 때마다 증가. 타이머가 낡은 상태에 반응하지 않게 한다 */
  step: number;
  enteredAt: number;
}

export type CeremonyAction =
  | { type: 'NEXT'; now: number }
  | { type: 'TIMER'; step: number; now: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'REPLAY'; now: number }
  | { type: 'RESTORE'; phase: 'IDLE' | 'READY' | 'COMPLETE'; groupIndex: number; now: number };

export function initialState(groupCount: number, now = 0, auto: AutoTiming | null = null): CeremonyState {
  return { auto, phase: 'IDLE', groupIndex: 0, groupCount, count: 0, paused: false, step: 0, enteredAt: now };
}

/** 현재 단계가 자동으로 넘어가기까지의 시간. null 이면 운영자가 다음을 눌러야 한다 */
export function stepDuration(s: CeremonyState): number | null {
  switch (s.phase) {
    case 'TOUCH': return TOUCH_MS;
    case 'DRAGON': return DRAGON_MS;
    case 'COUNTDOWN': return s.count > 0 ? COUNT_MS : HUSH_MS;
    case 'IDLE': return s.auto?.idleMs ?? null;
    case 'SUMMON': return s.auto?.summonMs ?? null;
    default: return null; // 대기·발표 준비·합격 공개·기념 페이지는 운영자가 넘긴다
  }
}

function afterReveal(s: CeremonyState, now: number): CeremonyState {
  return s.groupIndex + 1 < s.groupCount
    ? go(s, now, { phase: 'READY', groupIndex: s.groupIndex + 1 })
    : go(s, now, { phase: 'COMPLETE' });
}

function go(s: CeremonyState, now: number, patch: Partial<CeremonyState>): CeremonyState {
  return { ...s, count: 0, ...patch, step: s.step + 1, enteredAt: now };
}

function afterDragon(s: CeremonyState, now: number): CeremonyState {
  return s.groupCount > 0
    ? go(s, now, { phase: 'READY', groupIndex: 0 })
    : go(s, now, { phase: 'COMPLETE' });
}

export function ceremonyReducer(s: CeremonyState, a: CeremonyAction): CeremonyState {
  switch (a.type) {
    case 'PAUSE':
      return s.paused ? s : { ...s, paused: true };
    case 'RESUME':
      return s.paused ? { ...s, paused: false } : s;

    case 'NEXT': {
      if (s.paused || a.now - s.enteredAt < NEXT_GUARD_MS) return s;
      switch (s.phase) {
        case 'IDLE': return go(s, a.now, { phase: 'TOUCH' });
        case 'TOUCH': return go(s, a.now, { phase: 'SUMMON' });
        case 'SUMMON': return go(s, a.now, { phase: 'DRAGON' });
        case 'DRAGON': return afterDragon(s, a.now);
        case 'READY': return go(s, a.now, { phase: 'COUNTDOWN', count: COUNT_FROM });
        case 'COUNTDOWN': return s; // 카운트다운 중에는 잠금
        case 'REVEAL': return afterReveal(s, a.now);
        case 'COMPLETE': return s;
      }
      return s;
    }

    case 'TIMER': {
      if (s.paused || a.step !== s.step || stepDuration(s) == null) return s;
      switch (s.phase) {
        case 'IDLE': return go(s, a.now, { phase: 'TOUCH' });
        case 'TOUCH': return go(s, a.now, { phase: 'SUMMON' });
        case 'SUMMON': return go(s, a.now, { phase: 'DRAGON' });
        case 'DRAGON': return afterDragon(s, a.now);
        case 'COUNTDOWN':
          if (s.count > 0) return go(s, a.now, { phase: 'COUNTDOWN', count: s.count - 1 });
          return go(s, a.now, { phase: 'REVEAL' });
      }
      return s;
    }

    case 'REPLAY': {
      // 같은 그룹만 다시 공개한다. 다음 그룹으로 넘어가지 않는다.
      if (s.paused || s.phase !== 'REVEAL' || a.now - s.enteredAt < NEXT_GUARD_MS) return s;
      return go(s, a.now, { phase: 'COUNTDOWN', count: COUNT_FROM });
    }

    case 'RESTORE': {
      const groupIndex = Math.min(Math.max(0, a.groupIndex), Math.max(0, s.groupCount - 1));
      return go(s, a.now, { phase: a.phase, groupIndex, paused: false });
    }
  }
}
