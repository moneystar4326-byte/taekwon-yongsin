import type { Avatar } from '../domain/types';
import { ORBS } from '../domain/orbs';

/**
 * 자산 상태
 * - approved: 검수 완료
 * - needs-review: 사용은 하지만 기획서 기준과 다른 점이 있어 교체·수정 필요
 * - missing: 아직 전달받지 못함
 *
 * 원본은 assets-source/ 에 보존되고, `npm run assets` 가 public/assets/ 웹용 변환본을 만든다.
 * 머리 색은 2026-10-15 결정에 따라 '짙은 갈색'을 기준으로 한다(기획서의 검정에서 변경).
 */
export type AssetStatus = 'approved' | 'needs-review' | 'missing';

export interface AssetEntry {
  path: string;
  label: string;
  status: AssetStatus;
  source?: string;
  note?: string;
}

export type SceneKey = 'idle' | 'touch' | 'summon' | 'dragon';

const BELT_NOTE = '뒤로 늘어진 띠 끝이 보임(부분 수정 필요)';

export const SCENES: Record<Avatar, Record<SceneKey, AssetEntry>> = {
  boy: {
    idle: { path: 'assets/scenes/boy/01-idle.webp', label: '남자 01 대기', status: 'needs-review', source: '12-boy-01-idle.png', note: `${BELT_NOTE}. 주변 구슬 수 재확인 필요` },
    touch: { path: 'assets/scenes/boy/02-touch.webp', label: '남자 02 손 얹기', status: 'needs-review', source: '10-boy-02-touch.png', note: BELT_NOTE },
    summon: { path: 'assets/scenes/boy/03-summon.webp', label: '남자 03 소환', status: 'needs-review', source: '09-boy-03-summon.png', note: `${BELT_NOTE}. 어깨 붉은 표식` },
    dragon: { path: 'assets/scenes/boy/04-dragon.webp', label: '남자 04 용신 등장', status: 'needs-review', source: '11-boy-04-dragon.png', note: `${BELT_NOTE}. 어깨 붉은 표식. 구슬 수 재확인` },
  },
  girl: {
    idle: { path: 'assets/scenes/girl/01-idle.webp', label: '여자 01 대기', status: 'needs-review', source: '03-girl-01-idle.png', note: `${BELT_NOTE}. 주변 구슬 수 재확인 필요` },
    touch: { path: 'assets/scenes/girl/02-touch.webp', label: '여자 02 손 얹기', status: 'needs-review', source: '06-girl-02-touch.png', note: BELT_NOTE },
    summon: { path: 'assets/scenes/girl/03-summon.webp', label: '여자 03 소환', status: 'needs-review', source: '05-girl-03-summon.png', note: BELT_NOTE },
    dragon: { path: 'assets/scenes/girl/04-dragon.webp', label: '여자 04 용신 등장', status: 'needs-review', source: '04-girl-04-dragon.png', note: `${BELT_NOTE}. 구슬 수 재확인` },
  },
};

/**
 * Kling 으로 만든 장면 영상. `npm run videos` 가 만든 public/assets/videos/manifest.json 에
 * 올라 있는 것만 쓰고, 없거나 재생에 실패하면 같은 장면의 정지 이미지로 대체한다.
 * loop: 운영자를 기다리는 장면(대기·소환)은 반복, 나머지는 끝 장면에서 멈춘다.
 */
export const SCENE_VIDEOS: Record<Avatar, Record<SceneKey, { path: string; loop: boolean }>> = {
  boy: {
    idle: { path: 'assets/videos/boy/idle.mp4', loop: true },
    touch: { path: 'assets/videos/boy/touch.mp4', loop: false },
    summon: { path: 'assets/videos/boy/summon.mp4', loop: true },
    dragon: { path: 'assets/videos/boy/dragon.mp4', loop: false },
  },
  girl: {
    idle: { path: 'assets/videos/girl/idle.mp4', loop: true },
    touch: { path: 'assets/videos/girl/touch.mp4', loop: false },
    summon: { path: 'assets/videos/girl/summon.mp4', loop: true },
    dragon: { path: 'assets/videos/girl/dragon.mp4', loop: false },
  },
};
export const TOUCH_INSERT_VIDEO = 'assets/videos/touch-hand.mp4';
/** 사진·카운트다운·합격 화면 위쪽의 움직이는 용 얼굴(투명 배경 WebM) */
export const DRAGON_FACE_VIDEO = 'assets/videos/dragon-face.webm';
/** 사진·카운트다운·합격 화면 뒤에 반복 재생하는 배경 영상(인물·구슬 없음) */
export const BG_VIDEOS = {
  day: 'assets/videos/bg-day.mp4',
  summon: 'assets/videos/bg-summon.mp4',
} as const;
export const VIDEO_MANIFEST = 'assets/videos/manifest.json';

export const TOUCH_INSERT: AssetEntry = {
  path: 'assets/scenes/touch-hand.webp', label: '손 접촉 클로즈업', status: 'needs-review',
  source: '15-touch-hand-closeup.png', note: '배경이 성역과 톤이 다름(짧은 컷으로 사용)',
};

export type BackgroundKey = 'day' | 'summon';

/**
 * 인물·구슬·숫자·문구가 없는 클린 배경. 파일이 있으면 자동으로 이쪽을 쓴다.
 * 현재 파일은 대기(12번)·소환(09번) 장면에서 LaMa 로컬 인페인팅으로 아이·구슬·받침대를 지운 것.
 * 더 좋은 배경이 생기면 assets-source/clean-*.png 를 바꾸고 npm run assets 실행.
 */
export const CLEAN_BACKGROUNDS: Record<BackgroundKey, AssetEntry> = {
  day: {
    path: 'assets/backgrounds/day.webp', label: '클린 성역 배경(밝음)', status: 'needs-review',
    source: 'clean-day.png', note: '12번에서 인물·구슬을 지운 AI 보정본. 가운데 난간이 매끈하게 바뀜',
  },
  summon: {
    path: 'assets/backgrounds/summon.webp', label: '클린 성역 배경(소환)', status: 'needs-review',
    source: 'clean-summon.png', note: '09번에서 인물·구슬을 지운 AI 보정본. 빛줄기 일부 남음',
  },
};

export const TEMP_BACKGROUNDS: Record<BackgroundKey, AssetEntry> = {
  day: {
    path: 'assets/backgrounds/temp-day.webp', label: '임시 배경(대기 장면 흐림)', status: 'needs-review',
    note: '클린 배경을 불러오지 못할 때만 사용',
  },
  summon: {
    path: 'assets/backgrounds/temp-summon.webp', label: '임시 배경(소환 장면 흐림)', status: 'needs-review',
    note: '클린 배경을 불러오지 못할 때만 사용',
  },
};

export const DRAGON = {
  face: { path: 'assets/dragon/face.webp', label: '용신 얼굴', status: 'approved', source: '13-dragon-face.png' } as AssetEntry,
  full: { path: 'assets/dragon/full.webp', label: '용신 전신', status: 'approved', source: '14-dragon-full.png' } as AssetEntry,
};

export const CHARACTERS: Record<Avatar, AssetEntry> = {
  boy: { path: 'assets/characters/boy-idle.webp', label: '남자 주인공(투명)', status: 'needs-review', source: '30-boy-idle-cutout.png', note: '첫 장면(12번)에서 오려낸 같은 아이. ' + BELT_NOTE },
  girl: { path: 'assets/characters/girl-lookup.webp', label: '여자 주인공(투명)', status: 'missing', note: '남자 16번과 같은 포즈로 제작 필요' },
};

export const ORB_ASSETS: AssetEntry[] = ORBS.map((o) => ({
  path: o.image, label: `구슬 ${o.order} ${o.poomsae}`, status: 'approved',
}));

/** 행사 시작 전 반드시 불러와야 하는 자산 */
export function coreAssets(avatar: Avatar): AssetEntry[] {
  return [
    ...Object.values(SCENES[avatar]),
    TOUCH_INSERT,
    TEMP_BACKGROUNDS.day,
    TEMP_BACKGROUNDS.summon,
    DRAGON.face,
    DRAGON.full,
    ...(CHARACTERS[avatar].status === 'missing' ? [] : [CHARACTERS[avatar]]),
    ...ORB_ASSETS,
  ];
}

export function allAssets(): AssetEntry[] {
  return [
    ...Object.values(SCENES.boy), ...Object.values(SCENES.girl), TOUCH_INSERT,
    CLEAN_BACKGROUNDS.day, CLEAN_BACKGROUNDS.summon, TEMP_BACKGROUNDS.day, TEMP_BACKGROUNDS.summon, DRAGON.face, DRAGON.full,
    CHARACTERS.boy, CHARACTERS.girl, ...ORB_ASSETS,
  ];
}
