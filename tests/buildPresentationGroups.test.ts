import { describe, expect, it } from 'vitest';
import { buildPresentationGroups } from '../src/domain/buildPresentationGroups';
import type { Poom, Result, Student } from '../src/domain/types';

let seq = 0;
function st(poom: Poom, result: Result = 'PASS', name = `학생${++seq}`): Student {
  return { id: `s${seq}-${name}`, name, poom, result, order: seq };
}
const many = (n: number, poom: Poom = 1) => Array.from({ length: n }, () => st(poom));

describe('buildPresentationGroups', () => {
  it('0명이면 그룹이 없다', () => {
    expect(buildPresentationGroups([], 'GROUP').groups).toEqual([]);
    expect(buildPresentationGroups([st(1, 'FAIL'), st(2, 'PENDING')], 'GROUP').groups).toEqual([]);
  });

  it.each([
    [1, [1]],
    [4, [4]],
    [5, [4, 1]],
    [12, [4, 4, 4]],
    [7, [4, 3]],
  ])('%i명 → 페이지별 인원 %j', (n, sizes) => {
    const { groups } = buildPresentationGroups(many(n), 'GROUP');
    expect(groups.map((g) => g.studentIds.length)).toEqual(sizes);
    expect(groups.every((g) => g.pageCount === sizes.length)).toBe(true);
    expect(groups.map((g) => g.page)).toEqual(sizes.map((_, i) => i + 1));
  });

  it('PASS만 포함하고 FAIL/PENDING 정보는 스냅샷에도 없다', () => {
    const fail = st(1, 'FAIL', '불합격');
    const pending = st(2, 'PENDING', '대기');
    const pass = st(1, 'PASS', '합격');
    const snap = buildPresentationGroups([fail, pending, pass], 'GROUP');
    const ids = snap.groups.flatMap((g) => g.studentIds);
    expect(ids).toEqual([pass.id]);
    expect(Object.keys(snap.students)).toEqual([pass.id]);
  });

  it('품 순서는 1→2→3→4, 없는 품은 건너뛴다', () => {
    const list = [st(4), st(2), st(4), st(2), st(1)];
    const { groups } = buildPresentationGroups(list, 'GROUP');
    expect(groups.map((g) => g.poom)).toEqual([1, 2, 4]);
  });

  it('개인 모드는 한 사람씩', () => {
    const { groups } = buildPresentationGroups([...many(3, 1), ...many(2, 3)], 'INDIVIDUAL');
    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.studentIds.length === 1)).toBe(true);
    expect(groups.map((g) => g.poom)).toEqual([1, 1, 1, 3, 3]);
  });

  it('스냅샷은 원본 수정과 분리된다', () => {
    const s = st(1);
    s.crop = { x: 0, y: 0, scale: 1 };
    const snap = buildPresentationGroups([s], 'GROUP');
    s.name = '바뀐 이름';
    s.crop.scale = 3;
    expect(snap.students[s.id].name).not.toBe('바뀐 이름');
    expect(snap.students[s.id].crop?.scale).toBe(1);
  });
});
