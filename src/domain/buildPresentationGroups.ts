import { POOMS, type PresentationGroup, type PresentedStudent, type Student } from './types';

export const MAX_PER_PAGE = 4;

export interface PresentationSnapshot {
  groups: PresentationGroup[];
  students: Record<string, PresentedStudent>;
}

/**
 * PASS 수련생만 품 순서(1→4)로 묶는다. 없는 품은 건너뛴다.
 * 단체 모드: 한 페이지 최대 4명. 개인 모드: 한 사람씩.
 */
export function buildPresentationGroups(
  students: Student[],
  mode: 'GROUP' | 'INDIVIDUAL',
): PresentationSnapshot {
  const pass = students.filter((s) => s.result === 'PASS');
  const snapshot: Record<string, PresentedStudent> = {};
  for (const s of pass) {
    snapshot[s.id] = {
      id: s.id,
      name: s.name,
      pronunciation: s.pronunciation,
      poom: s.poom,
      photoBlobId: s.photoBlobId,
      crop: s.crop ? { ...s.crop } : undefined,
    };
  }

  const size = mode === 'INDIVIDUAL' ? 1 : MAX_PER_PAGE;
  const groups: PresentationGroup[] = [];
  for (const poom of POOMS) {
    const ids = pass
      .filter((s) => s.poom === poom)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'))
      .map((s) => s.id);
    const pageCount = Math.ceil(ids.length / size);
    for (let p = 0; p < pageCount; p++) {
      groups.push({
        id: `p${poom}-${p + 1}`,
        poom,
        studentIds: ids.slice(p * size, (p + 1) * size),
        page: p + 1,
        pageCount,
      });
    }
  }
  return { groups, students: snapshot };
}
