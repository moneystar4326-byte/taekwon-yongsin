export type Poom = 1 | 2 | 3 | 4;
export type Result = 'PENDING' | 'PASS' | 'FAIL';
export type Avatar = 'boy' | 'girl';
export type Phase =
  | 'IDLE' | 'TOUCH' | 'SUMMON' | 'DRAGON'
  | 'READY' | 'COUNTDOWN' | 'REVEAL' | 'COMPLETE';

export const POOMS: Poom[] = [1, 2, 3, 4];

/**
 * 행사에서 고를 수 있는 주인공. 여자 버전은 영상·투명 소재가 준비될 때까지 숨긴다.
 * 다시 쓰려면 'girl' 을 추가하면 된다(장면 이미지와 매핑은 그대로 남아 있다).
 */
export const ENABLED_AVATARS: Avatar[] = ['boy'];
export const usableAvatar = (a: Avatar | undefined): Avatar =>
  a && ENABLED_AVATARS.includes(a) ? a : ENABLED_AVATARS[0];

export interface Crop {
  /** 원형 프레임 안 이동량(사진 크기 대비 %) */
  x: number;
  y: number;
  /** 1 = 꽉 채움 */
  scale: number;
}

export interface Student {
  id: string;
  name: string;
  pronunciation?: string;
  poom: Poom;
  result: Result;
  photoBlobId?: string;
  crop?: Crop;
  order: number;
}

export interface CeremonySettings {
  id: string;
  title: string;
  dojoName: string;
  examDate: string;
  logoBlobId?: string;
  avatar: Avatar;
  mode: 'GROUP' | 'INDIVIDUAL';
  volume: number;
  muted: boolean;
  reducedEffects: boolean;
  /** 클린 배경이 없을 때 임시 배경으로 진행하는 데 동의했는지 */
  allowFallbackAssets: boolean;
  /** 시작 한 번으로 소환·용신 장면까지 자동 진행(합격 발표는 운영자가 누름) */
  autoAdvance: boolean;
  /** 자동 진행: 아이들 구호 시간(초) */
  chantSeconds: number;
  /** 배경 음악 */
  bgm: boolean;
}

/** 발표 시작 시점의 PASS 수련생 사본. 이후 준비 화면 수정이 섞이지 않는다. */
export type PresentedStudent = Pick<Student, 'id' | 'name' | 'pronunciation' | 'poom' | 'photoBlobId' | 'crop'>;

export interface PresentationGroup {
  id: string;
  poom: Poom;
  /** PASS만, 최대 4명; 개인 모드는 1명 */
  studentIds: string[];
  /** 같은 품 안에서 몇 번째 페이지인지 (1부터) */
  page: number;
  pageCount: number;
}

export type Workspace = 'real' | 'practice';

export const DEFAULT_SETTINGS: CeremonySettings = {
  id: 'settings',
  title: '태권용신 — 열한 빛의 약속',
  dojoName: '',
  examDate: '',
  avatar: 'boy',
  mode: 'INDIVIDUAL',
  volume: 0.9,
  muted: false,
  reducedEffects: false,
  allowFallbackAssets: false,
  autoAdvance: true,
  chantSeconds: 10,
  bgm: true,
};
