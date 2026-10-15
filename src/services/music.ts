/**
 * 배경 음악 감독. 장면마다 곡(cue)을 정하고 곡이 바뀔 때 부드럽게 교차 전환한다.
 * - 곡은 반복 재생하며, 같은 곡이 이어지는 장면에서는 끊지 않고 계속 흐른다.
 * - 대사가 나오는 동안과 카운트다운 동안은 음량을 낮춘다(덕킹).
 * - 파일을 못 불러오거나 재생이 막혀도 예외를 던지지 않는다. 행사는 음악 없이 진행된다.
 * 곡 출처는 public/assets/music/CREDITS.txt (모두 CC0).
 */
export type Cue = 'calm' | 'epic' | 'tension' | 'triumph' | 'finale';

const FILES: Record<Cue, string> = {
  calm: 'assets/music/calm.mp3',
  epic: 'assets/music/epic.mp3',
  tension: 'assets/music/tension.mp3',
  triumph: 'assets/music/triumph.mp3',
  finale: 'assets/music/finale.mp3',
};

/** 곡별 기본 음량(대사가 잘 들리도록 전체적으로 낮게) */
const LEVEL: Record<Cue, number> = { calm: 0.6, epic: 0.8, tension: 0.8, triumph: 0.8, finale: 0.75 };
const FADE_MS = 1600;
/** 들어올 때 페이드 시간. 합격 공개는 첫 소절이 바로 터지게 짧게 */
const FADE_IN_MS: Record<Cue, number> = { calm: 1600, epic: 900, tension: 900, triumph: 150, finale: 1200 };
/** 들어올 때마다 처음부터 다시 트는 곡 */
const RESTART: Cue[] = ['triumph'];

class MusicDirector {
  private tracks = new Map<Cue, HTMLAudioElement>();
  private gains = new Map<Cue, number>(); // 현재 적용 중인 페이드 값 0..1
  private targets = new Map<Cue, number>();
  private current: Cue | null = null;
  private master = 0.9;
  private muted = false;
  private enabled = true;
  private paused = false;
  private duck = 1;
  private raf = 0;
  private last = 0;

  private el(cue: Cue) {
    let a = this.tracks.get(cue);
    if (!a) {
      a = new Audio(FILES[cue]);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      this.tracks.set(cue, a);
      this.gains.set(cue, 0);
    }
    return a;
  }

  /** 행사 시작 전에 미리 받아 둔다 */
  preload() {
    (Object.keys(FILES) as Cue[]).forEach((c) => this.el(c).load());
  }

  configure(volume: number, muted: boolean, enabled: boolean) {
    this.master = Math.min(1, Math.max(0, volume));
    this.muted = muted;
    this.enabled = enabled;
    if (!enabled) this.stop();
    this.kick();
  }

  /** 장면의 곡을 정한다. null 이면 음악을 서서히 끈다 */
  play(cue: Cue | null) {
    if (!this.enabled) cue = null;
    if (cue === this.current) return;
    this.current = cue;
    for (const c of this.tracks.keys()) this.targets.set(c, 0);
    if (cue) {
      const a = this.el(cue);
      if (RESTART.includes(cue)) {
        a.pause();
        a.currentTime = 0;
      }
      this.targets.set(cue, 1);
      if (a.paused && !this.paused) a.play().catch(() => undefined);
    }
    this.kick();
  }

  /** 대사·카운트다운 중 음량 비율 (1 = 그대로) */
  setDuck(v: number) {
    this.duck = v;
    this.kick();
  }

  pause() {
    this.paused = true;
    this.tracks.forEach((a) => a.pause());
  }

  resume() {
    this.paused = false;
    this.tracks.forEach((a, c) => {
      if ((this.gains.get(c) ?? 0) > 0.001 || this.targets.get(c)) a.play().catch(() => undefined);
    });
    this.kick();
  }

  stop() {
    this.current = null;
    this.tracks.forEach((a, c) => {
      a.pause();
      a.currentTime = 0;
      a.volume = 0;
      this.gains.set(c, 0);
      this.targets.set(c, 0);
    });
  }

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    const step = (now: number) => {
      const dt = now - this.last;
      this.last = now;
      let moving = false;
      this.tracks.forEach((a, c) => {
        const target = this.targets.get(c) ?? 0;
        let g = this.gains.get(c) ?? 0;
        if (!this.paused && g !== target) {
          const d = dt / (target > g ? FADE_IN_MS[c] : FADE_MS);
          g = target > g ? Math.min(target, g + d) : Math.max(target, g - d);
          this.gains.set(c, g);
          moving = true;
        }
        const vol = this.muted ? 0 : g * LEVEL[c] * this.master * this.duck;
        a.volume = Math.min(1, Math.max(0, vol));
        if (g === 0 && target === 0 && !a.paused) a.pause();
      });
      this.raf = moving ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }
}

export const music = new MusicDirector();
