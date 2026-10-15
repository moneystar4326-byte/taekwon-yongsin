import { describe, expect, it } from 'vitest';
import {
  ceremonyReducer as r, initialState, stepDuration, NEXT_GUARD_MS, DEFAULT_AUTO, type CeremonyState,
} from '../src/domain/ceremonyReducer';

let t = 0;
const later = () => (t += NEXT_GUARD_MS + 1);
const next = (s: CeremonyState) => r(s, { type: 'NEXT', now: later() });
const timer = (s: CeremonyState) => r(s, { type: 'TIMER', step: s.step, now: later() });

function toReady(groups: number) {
  let s = initialState(groups, t);
  s = next(s); // TOUCH
  s = timer(s); // SUMMON (6초 자동)
  s = next(s); // DRAGON (구호 후 운영자)
  s = timer(s); // READY
  return s;
}

function countdown(s: CeremonyState) {
  const seen: number[] = [];
  while (s.phase === 'COUNTDOWN') {
    seen.push(s.count);
    s = timer(s);
  }
  return { s, seen };
}

describe('ceremonyReducer', () => {
  it('IDLE → TOUCH → SUMMON → DRAGON → READY 흐름', () => {
    let s = initialState(2, t);
    const phases = [s.phase];
    s = next(s); phases.push(s.phase);
    s = timer(s); phases.push(s.phase);
    expect(stepDuration(s)).toBeNull(); // SUMMON 은 구호를 기다린다
    s = timer(s); phases.push(s.phase); // 타이머가 와도 그대로
    s = next(s); phases.push(s.phase);
    s = timer(s); phases.push(s.phase);
    expect(phases).toEqual(['IDLE', 'TOUCH', 'SUMMON', 'SUMMON', 'DRAGON', 'READY']);
  });

  it('5·4·3·2·1 후 정적, 그다음 REVEAL 한 번', () => {
    let s = next(toReady(1));
    const { s: after, seen } = countdown(s);
    expect(seen).toEqual([5, 4, 3, 2, 1, 0]);
    expect(after.phase).toBe('REVEAL');
  });

  it('카운트다운 중 다음 버튼은 잠긴다', () => {
    let s = next(toReady(1));
    const before = s;
    for (let i = 0; i < 5; i++) s = next(s);
    expect(s).toBe(before);
  });

  it('장면 직후 연타는 무시된다', () => {
    let s = initialState(1, 0);
    s = r(s, { type: 'NEXT', now: 10_000 });
    const again = r(s, { type: 'NEXT', now: 10_100 });
    expect(again).toBe(s);
  });

  it('낡은 타이머는 무시된다', () => {
    let s = next(initialState(1, t)); // TOUCH
    const oldStep = s.step;
    s = next(s); // 운영자가 먼저 SUMMON 으로
    const same = r(s, { type: 'TIMER', step: oldStep, now: later() });
    expect(same).toBe(s);
  });

  it('일시정지 중에는 타이머도 다음도 진행되지 않는다', () => {
    let s = next(toReady(1));
    s = r(s, { type: 'PAUSE' });
    const paused = s;
    s = timer(s);
    s = next(s);
    expect(s).toBe(paused);
    s = r(s, { type: 'RESUME' });
    s = timer(s);
    expect(s.count).toBe(4);
  });

  it('다시 보기는 같은 그룹만 재생한다', () => {
    let s = next(toReady(3));
    s = countdown(s).s;
    expect(s.groupIndex).toBe(0);
    s = r(s, { type: 'REPLAY', now: later() });
    expect(s.phase).toBe('COUNTDOWN');
    s = countdown(s).s;
    expect(s).toMatchObject({ phase: 'REVEAL', groupIndex: 0 });
  });

  it('긴 소환 장면은 반복하지 않고 다음 그룹 READY 로, 마지막엔 COMPLETE', () => {
    let s = toReady(2);
    const phases: string[] = [];
    for (let g = 0; g < 2; g++) {
      s = next(s);
      s = countdown(s).s;
      phases.push(`${s.phase}${s.groupIndex}`);
      s = next(s);
      phases.push(`${s.phase}${s.groupIndex}`);
    }
    expect(phases).toEqual(['REVEAL0', 'READY1', 'REVEAL1', 'COMPLETE1']);
  });

  it('자동 진행: 시작 한 번이면 첫 수련생 사진(발표 준비)까지 가고 거기서 멈춘다', () => {
    let s = next(initialState(2, t, DEFAULT_AUTO)); // 시작
    let guard = 0;
    while (s.phase !== 'READY' && guard++ < 10) s = timer(s);
    expect(s.phase).toBe('READY');
    expect(stepDuration(s)).toBeNull();
    expect(timer(s)).toBe(s);
  });

  it('합격 발표와 다음 수련생은 언제나 운영자가 누른다', () => {
    let s = next(initialState(2, t, DEFAULT_AUTO));
    while (s.phase !== 'READY') s = timer(s);
    s = next(s); // [합격 발표]
    s = countdown(s).s;
    expect(s.phase).toBe('REVEAL');
    expect(stepDuration(s)).toBeNull();
    expect(timer(s)).toBe(s); // 저절로 넘어가지 않음
    s = next(s); // [다음 수련생]
    expect(s).toMatchObject({ phase: 'READY', groupIndex: 1 });
  });

  it('자동 진행 중에도 다음 버튼으로 앞당길 수 있고, 일시정지하면 멈춘다', () => {
    let s = next(initialState(1, t, DEFAULT_AUTO));
    s = timer(s); // SUMMON
    s = next(s);
    expect(s.phase).toBe('DRAGON');
    s = r(s, { type: 'PAUSE' });
    expect(timer(s)).toBe(s);
  });

  it('자동 진행이면 대기 대사 뒤 손 얹기로 스스로 넘어가고, 수동이면 기다린다', () => {
    const auto = initialState(1, t, DEFAULT_AUTO);
    expect(stepDuration(auto)).toBe(DEFAULT_AUTO.idleMs);
    expect(timer(auto).phase).toBe('TOUCH');
    const manual = initialState(1, t);
    expect(stepDuration(manual)).toBeNull();
    expect(timer(manual)).toBe(manual);
  });

  it('자동 진행: 무대가 열리면 아무것도 누르지 않아도 첫 수련생 사진까지 간다', () => {
    let s = initialState(2, t, DEFAULT_AUTO);
    let guard = 0;
    while (s.phase !== 'READY' && guard++ < 10) s = timer(s);
    expect(s.phase).toBe('READY');
  });

  it('복원은 결과를 자동 공개하지 않는다', () => {
    const s = r(initialState(4, t), { type: 'RESTORE', phase: 'READY', groupIndex: 2, now: later() });
    expect(s).toMatchObject({ phase: 'READY', groupIndex: 2, paused: false });
    expect(r(initialState(2), { type: 'RESTORE', phase: 'READY', groupIndex: 9, now: 0 }).groupIndex).toBe(1);
  });
});
