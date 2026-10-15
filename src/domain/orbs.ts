/**
 * 열한 개의 수련구슬. 상징은 이 앱의 창작 설정이며 공식 품새 해설이나 심사 기준이 아니다.
 * 평원은 포함하지 않는다. 중앙 대표 구슬은 태극 1장.
 */
export interface Orb {
  id: string;
  order: number;
  poomsae: string;
  symbol: string;
  image: string;
}

export const ORBS: readonly Orb[] = [
  { id: 'taegeuk-01', order: 1, poomsae: '태극 1장', symbol: '첫걸음', image: 'assets/orbs/taegeuk-01.webp' },
  { id: 'taegeuk-02', order: 2, poomsae: '태극 2장', symbol: '꾸준함', image: 'assets/orbs/taegeuk-02.webp' },
  { id: 'taegeuk-03', order: 3, poomsae: '태극 3장', symbol: '용기', image: 'assets/orbs/taegeuk-03.webp' },
  { id: 'taegeuk-04', order: 4, poomsae: '태극 4장', symbol: '집중', image: 'assets/orbs/taegeuk-04.webp' },
  { id: 'taegeuk-05', order: 5, poomsae: '태극 5장', symbol: '유연함', image: 'assets/orbs/taegeuk-05.webp' },
  { id: 'taegeuk-06', order: 6, poomsae: '태극 6장', symbol: '균형', image: 'assets/orbs/taegeuk-06.webp' },
  { id: 'taegeuk-07', order: 7, poomsae: '태극 7장', symbol: '인내', image: 'assets/orbs/taegeuk-07.webp' },
  { id: 'taegeuk-08', order: 8, poomsae: '태극 8장', symbol: '도약', image: 'assets/orbs/taegeuk-08.webp' },
  { id: 'koryo', order: 9, poomsae: '고려', symbol: '굳은 의지', image: 'assets/orbs/koryo.webp' },
  { id: 'keumgang', order: 10, poomsae: '금강', symbol: '흔들림 없는 마음', image: 'assets/orbs/keumgang.webp' },
  { id: 'taebaek', order: 11, poomsae: '태백', symbol: '밝은 성장', image: 'assets/orbs/taebaek.webp' },
];

export const CENTER_ORB_ID = 'taegeuk-01';
