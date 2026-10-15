import type { CeremonyState } from '../domain/ceremonyReducer';
import type { PresentationSnapshot } from '../domain/buildPresentationGroups';
import type { Avatar, PresentedStudent } from '../domain/types';
import { LINES, revealTitle } from '../domain/lines';
import { ORBS, CENTER_ORB_ID } from '../domain/orbs';
import { useCallback, useState } from 'react';
import {
  BG_VIDEOS, CHARACTERS, DRAGON, DRAGON_FACE_VIDEO, SCENES, SCENE_VIDEOS, TOUCH_INSERT, TOUCH_INSERT_VIDEO, type BackgroundKey, type SceneKey,
} from '../config/assets-manifest';
import { StudentPhoto } from './StudentPhoto';
import { Fireworks } from './Fireworks';
import { SceneVideo } from './SceneVideo';

/** 손 클로즈업 컷이 보이는 시간. 그 뒤에 장면 영상이 시작된다 */
const INSERT_MS = 3000;

export interface SceneAssets {
  /** 합성 장면 배경 경로 (발표 준비·카운트다운은 소환 배경, 공개·기념은 밝은 배경) */
  backgrounds: Record<BackgroundKey, string>;
  /** 배경에 구슬이 이미 그려져 있으면 웹 구슬을 겹치지 않는다 */
  backgroundHasOrbs: boolean;
  /** 불러오지 못한 파일 경로 */
  failed: Set<string>;
  /** 미리 받아 둔, 재생 가능한 영상 경로 */
  videos: Set<string>;
}

interface Props {
  state: CeremonyState;
  snapshot: PresentationSnapshot;
  avatar: Avatar;
  mode: 'GROUP' | 'INDIVIDUAL';
  photos: Record<string, string>;
  assets: SceneAssets;
  reduced: boolean;
  practice: boolean;
  brand: { logoUrl?: string; dojoName: string; examDate: string };
}

const SCENE_OF: Partial<Record<CeremonyState['phase'], SceneKey>> = {
  IDLE: 'idle', TOUCH: 'touch', SUMMON: 'summon', DRAGON: 'dragon',
};

export function CeremonyScene({ state, snapshot, avatar, mode, photos, assets, reduced, practice, brand }: Props) {
  const { phase } = state;
  const sceneKey = SCENE_OF[phase];
  const composite = !sceneKey;
  const group = snapshot.groups[state.groupIndex];
  const members: PresentedStudent[] = group ? group.studentIds.map((id) => snapshot.students[id]).filter(Boolean) : [];
  const ok = (p: string) => !assets.failed.has(p);
  const character = CHARACTERS[avatar];
  const showCharacter = character.status !== 'missing' && ok(character.path);
  const bgKey: BackgroundKey = phase === 'READY' || phase === 'COUNTDOWN' ? 'summon' : 'day';

  // 재생 중 실패한 영상은 정지 이미지로 바꾼다. 효과 줄이기 모드에서는 영상을 쓰지 않는다
  const [brokenVideos, setBrokenVideos] = useState<Set<string>>(() => new Set());
  const markBroken = useCallback((p: string) => setBrokenVideos((s) => new Set(s).add(p)), []);
  const hasVideo = (p: string) => !reduced && assets.videos.has(p) && !brokenVideos.has(p);
  const handVideo = hasVideo(TOUCH_INSERT_VIDEO);
  const showInsert = handVideo || ok(TOUCH_INSERT.path);

  return (
    <div className={`scene phase-${phase.toLowerCase()} ${reduced ? 'reduced' : ''}`}>
      {/* 1~4장면: 장면(영상 또는 정지 이미지)을 겹쳐 두고 현재 장면만 보이게 해 부드럽게 전환한다 */}
      {(Object.keys(SCENES[avatar]) as SceneKey[]).map((k) => {
        const entry = SCENES[avatar][k];
        const still = ok(entry.path) ? entry.path : assets.backgrounds[k === 'idle' || k === 'touch' ? 'day' : 'summon'];
        const video = SCENE_VIDEOS[avatar][k];
        if (hasVideo(video.path)) {
          return (
            <SceneVideo
              key={k}
              src={video.path}
              poster={still}
              active={sceneKey === k}
              paused={state.paused}
              loop={video.loop}
              startDelayMs={k === 'touch' && showInsert ? INSERT_MS : 0}
              className={`layer scene-img scene-video ${sceneKey === k ? 'on' : ''}`}
              onFail={() => markBroken(video.path)}
            />
          );
        }
        return (
          <img
            key={k}
            src={still}
            alt=""
            className={`layer scene-img ${sceneKey === k ? 'on' : ''} ${k === 'dragon' ? 'kenburns-slow' : 'kenburns'}`}
            draggable={false}
          />
        );
      })}

      {/* 5·6장면과 기념 페이지: 클린 배경 + 투명 소재 + HTML */}
      <div className={`layer composite ${composite ? 'on' : ''}`}>
        {(['summon', 'day'] as const).map((k) =>
          hasVideo(BG_VIDEOS[k]) ? (
            <SceneVideo
              key={k}
              src={BG_VIDEOS[k]}
              poster={assets.backgrounds[k]}
              active={composite && bgKey === k}
              paused={state.paused}
              loop
              className={`layer bg-img bg-video ${bgKey === k ? 'on' : ''}`}
              onFail={() => markBroken(BG_VIDEOS[k])}
            />
          ) : (
            <img key={k} src={assets.backgrounds[k]} alt="" className={`layer bg-img ${bgKey === k ? 'on' : ''}`} draggable={false} />
          ),
        )}
        <div className="layer composite-shade" />
        {hasVideo(DRAGON_FACE_VIDEO) ? (
          <SceneVideo
            src={DRAGON_FACE_VIDEO}
            poster={DRAGON.face.path}
            active={composite}
            paused={state.paused}
            loop
            className="dragon-face dragon-face-video"
            onFail={() => markBroken(DRAGON_FACE_VIDEO)}
          />
        ) : (
          ok(DRAGON.face.path) && <img src={DRAGON.face.path} alt="" className="dragon-face" draggable={false} />
        )}
        {!assets.backgroundHasOrbs && <OrbRow />}
        {showCharacter && <img src={character.path} alt="" className="hero" draggable={false} />}
        {(brand.logoUrl || brand.dojoName) && (
          <div className="brand">
            {brand.logoUrl && <img src={brand.logoUrl} alt="" />}
            <span>
              {brand.dojoName}
              {brand.examDate && <small>{brand.examDate.replace(/-/g, '. ')} 승품심사</small>}
            </span>
          </div>
        )}
      </div>

      {phase === 'IDLE' && <Subtitle text={LINES.idle} />}

      {phase === 'TOUCH' && (
        <>
          {!hasVideo(SCENE_VIDEOS[avatar].touch.path) && <div className="touch-ripple" style={{ left: '50%', top: '64%' }} />}
          {handVideo ? (
            <SceneVideo
              src={TOUCH_INSERT_VIDEO}
              poster={TOUCH_INSERT.path}
              active
              paused={state.paused}
              loop={false}
              className="layer touch-insert"
              onFail={() => markBroken(TOUCH_INSERT_VIDEO)}
            />
          ) : (
            ok(TOUCH_INSERT.path) && <img src={TOUCH_INSERT.path} alt="" className="layer touch-insert" draggable={false} />
          )}
          <Subtitle text={LINES.touch} />
        </>
      )}

      {phase === 'SUMMON' && (
        <div className="chant">
          <div className="chant-line">열한 빛이여, 하늘을 열어라!</div>
          <div className="chant-line">태권용신, 깨어나라!</div>
        </div>
      )}

      {phase === 'DRAGON' && <Subtitle text={LINES.dragon} />}

      {phase === 'READY' && group && (
        <div className="ready" key={`r${state.groupIndex}`}>
          <div className="title-plate ready-label">
            {group.poom}품 승품심사
            {group.pageCount > 1 && <span className="ready-page"> {group.page}/{group.pageCount}</span>}
          </div>
          <PhotoRow
            members={members}
            photos={photos}
            size={mode === 'INDIVIDUAL' ? 320 : 220}
            names
            className={`ready-row suspense ${mode === 'INDIVIDUAL' ? 'single' : ''}`}
          />
          {state.groupIndex === 0 && <Subtitle text={LINES.ready} />}
        </div>
      )}

      {phase === 'COUNTDOWN' && group && (
        <>
          {state.count > 0 && (
            <div className="count" key={`${state.step}`}>{state.count}</div>
          )}
          <PhotoRow members={members} photos={photos} size={mode === 'INDIVIDUAL' ? 260 : 200} names={false} className="countdown-row" />
        </>
      )}

      {phase === 'REVEAL' && group && (
        <>
          {!reduced && <Fireworks key={state.step} paused={state.paused} />}
          <div className="reveal-title title-plate" key={`t${state.step}`}>{revealTitle(group.poom)}</div>
          <PhotoRow
            members={members}
            photos={photos}
            size={mode === 'INDIVIDUAL' ? 340 : 240}
            names
            className={`reveal-row ${mode === 'INDIVIDUAL' ? 'single' : ''}`}
          />
        </>
      )}

      {phase === 'COMPLETE' && (
        <Complete snapshot={snapshot} photos={photos} reduced={reduced} paused={state.paused} step={state.step} />
      )}

      {practice && <div className="practice-badge">연습 모드 · 가상 데이터</div>}
      {state.paused && <div className="paused-badge">일시정지</div>}
    </div>
  );
}

function Subtitle({ text }: { text: string }) {
  return (
    <div className="subtitle" key={text}>
      <span>{text}</span>
    </div>
  );
}

function OrbRow() {
  // 중앙 1개 + 좌우 5개씩, 총 11개. 데이터 배열 그대로 사용한다
  const center = ORBS.find((o) => o.id === CENTER_ORB_ID)!;
  const others = ORBS.filter((o) => o.id !== CENTER_ORB_ID);
  const left = others.slice(0, 5);
  const right = others.slice(5);
  return (
    <div className="orb-row" aria-hidden>
      {left.map((o) => <img key={o.id} src={o.image} alt="" className="orb" />)}
      <img src={center.image} alt="" className="orb orb-center" />
      {right.map((o) => <img key={o.id} src={o.image} alt="" className="orb" />)}
    </div>
  );
}

function PhotoRow({
  members, photos, size, names, className,
}: { members: PresentedStudent[]; photos: Record<string, string>; size: number; names: boolean; className: string }) {
  return (
    <div className={`photo-row ${className}`}>
      {members.map((m, i) => (
        <div className="pcard" key={m.id} style={{ animationDelay: `${i * 0.12}s` }}>
          <StudentPhoto url={m.photoBlobId ? photos[m.photoBlobId] : undefined} crop={m.crop} name={m.name} size={size} className="photo-gold" />
          {names && <div className="card-name">{m.name}</div>}
        </div>
      ))}
    </div>
  );
}

function Complete({
  snapshot, photos, reduced, paused, step,
}: { snapshot: PresentationSnapshot; photos: Record<string, string>; reduced: boolean; paused: boolean; step: number }) {
  const byPoom = [1, 2, 3, 4]
    .map((p) => ({
      poom: p,
      list: snapshot.groups.filter((g) => g.poom === p).flatMap((g) => g.studentIds.map((id) => snapshot.students[id])),
    }))
    .filter((x) => x.list.length > 0);
  const total = byPoom.reduce((n, x) => n + x.list.length, 0);
  // 인원에 따라 사진 크기를 줄이고, 아주 많으면 이름만 보여준다
  const size = total <= 8 ? 130 : total <= 16 ? 96 : total <= 28 ? 72 : 0;

  return (
    <>
      {!reduced && <Fireworks key={step} paused={paused} density={0.7} />}
      <div className="complete">
        <div className="title-plate complete-title">모두 축하합니다!</div>
        <div className="complete-grid">
          {byPoom.map(({ poom, list }) => (
            <section key={poom} className="complete-poom">
              <h3>{poom}품 합격</h3>
              <div className="complete-names">
                {list.map((s) => (
                  <div key={s.id} className={`complete-item ${size ? '' : 'text-only'}`}>
                    {size > 0 && (
                      <StudentPhoto url={s.photoBlobId ? photos[s.photoBlobId] : undefined} crop={s.crop} name={s.name} size={size} className="photo-gold thin" />
                    )}
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <Subtitle text={LINES.complete} />
    </>
  );
}
