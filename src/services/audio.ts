/**
 * 음성·효과음 어댑터.
 * - 기본: Web Speech API 한국어 음성. 지원하지 않으면 자막만으로 진행한다.
 * - 녹음 파일: VOICE_FILES 의 대사는 용신 목소리 녹음(scripts/make-voice.ps1)을 우선 재생한다.
 * - 음성 재생이 실패해도 진행에는 영향을 주지 않는다(모든 메서드는 예외를 던지지 않는다).
 * 저작권 있는 음악은 사용하지 않는다. 배경 음악 파일이 없으면 조용히 진행한다.
 */
export const VOICE_FILES: Partial<Record<string, string>> = Object.fromEntries(
  ['idle', 'touch', 'dragon', 'ready', 'complete', 'pass1', 'pass2', 'pass3', 'pass4'].map((id) => [id, `assets/voice/${id}.mp3`]),
);

class AudioService {
  private unlocked = false;
  private volume = 0.9;
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;
  private current: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private seq = 0;

  get speechSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  koreanVoices(): SpeechSynthesisVoice[] {
    if (!this.speechSupported) return [];
    return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ko'));
  }

  /** 사용자의 클릭 이후 호출한다. 브라우저 자동재생 정책 때문에 그 전에는 소리를 내지 않는다 */
  unlock() {
    this.unlocked = true;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !this.ctx) this.ctx = new Ctx();
      void this.ctx?.resume();
    } catch { /* 효과음 없이 진행 */ }
    if (this.speechSupported) {
      const pick = () => {
        const ko = this.koreanVoices();
        // 용신 녹음과 같은 남자 목소리(인준)를 먼저 고른다
        this.voice = ko.find((v) => /injoon|인준/i.test(v.name))
          ?? ko.find((v) => /hyunsu|현수|male|남/i.test(v.name) && !/female/i.test(v.name))
          ?? ko[0] ?? null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  configure(volume: number, muted: boolean) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.muted = muted;
    if (this.current) this.current.volume = muted ? 0 : 1;
    if (muted) this.cancel();
  }

  /** 이전 대사를 취소하고 새 대사를 말한다. 끝나거나 실패하면 resolve */
  speak(text: string, lineId?: string): Promise<void> {
    this.cancel();
    if (!this.unlocked || this.muted || !text) return Promise.resolve();
    const file = lineId ? VOICE_FILES[lineId] : undefined;
    if (file) return this.playFile(file, text);
    return this.tts(text);
  }

  /**
   * 합격 발표: "이름, N품 합격! 축하한다!"
   * 1) 이름까지 용신 목소리로 미리 녹음한 파일(assets/voice/names/N-이름.mp3)이 있으면 그것을 재생
   * 2) 없으면 같은 남자 목소리를 낮게 해서 이름을 부른 뒤 "N품 합격! 축하한다!" 녹음을 잇는다
   */
  async speakPass(name: string, spoken: string, poom: number): Promise<void> {
    this.cancel();
    if (!this.unlocked || this.muted) return;
    const token = ++this.seq;
    const named = `assets/voice/names/${encodeURIComponent(`${poom}-${name}`)}.mp3`;
    if (await this.tryFile(named)) return;
    if (token !== this.seq) return;
    await this.tts(spoken || name, { rate: 0.82, pitch: 0.55 });
    if (token !== this.seq) return;
    if (!(await this.tryFile(`assets/voice/pass${poom}.mp3`)) && token === this.seq) {
      await this.tts(`${poom}품 합격! 축하한다!`, { rate: 0.82, pitch: 0.55 });
    }
  }

  /** 파일을 끝까지 재생하면 true, 없거나 재생할 수 없으면 false */
  private tryFile(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const a = new Audio(src);
      a.volume = 1;
      this.current = a;
      a.onended = () => resolve(true);
      a.onerror = () => { if (this.current === a) this.current = null; resolve(false); };
      a.onpause = () => { if (this.current !== a) resolve(true); }; // 취소됨
      a.play().catch(() => { if (this.current === a) this.current = null; resolve(false); });
    });
  }

  private tts(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<void> {
    if (!this.speechSupported) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        if (this.voice) u.voice = this.voice;
        u.volume = this.volume;
        u.rate = opts.rate ?? 0.92;
        u.pitch = opts.pitch ?? 0.9;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }

  private playFile(src: string, fallbackText: string): Promise<void> {
    return new Promise((resolve) => {
      const a = new Audio(src);
      a.volume = 1; // 녹음 파일 자체를 크게 맞춰 두었으므로 최대 음량으로 재생
      this.current = a;
      a.onended = () => resolve();
      a.onerror = () => { this.current = null; void this.tts(fallbackText).then(resolve); };
      a.play().catch(() => { this.current = null; void this.tts(fallbackText).then(resolve); });
    });
  }

  pause() {
    try {
      if (this.speechSupported) speechSynthesis.pause();
      this.current?.pause();
      void this.ctx?.suspend();
    } catch { /* 무시 */ }
  }

  resume() {
    try {
      if (this.speechSupported) speechSynthesis.resume();
      void this.current?.play().catch(() => undefined);
      void this.ctx?.resume();
    } catch { /* 무시 */ }
  }

  cancel() {
    this.seq++; // 진행 중인 합격 발표 연속 재생을 멈춘다
    try {
      if (this.speechSupported) speechSynthesis.cancel();
      if (this.current) {
        this.current.pause();
        this.current = null;
      }
    } catch { /* 무시 */ }
  }

  /** 카운트다운용 부드러운 종소리. 파일 없이 합성한다 */
  chime(freq = 660, duration = 0.5) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25 * this.volume + 0.0001, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch { /* 무시 */ }
  }

  /** 팀파니 같은 북소리. 숫자가 작아질수록 조금씩 크고 높아진다 */
  drum(count = 5) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const lift = (5 - Math.min(5, Math.max(1, count))) / 4; // 0..1
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 + lift * 30, t);
      osc.frequency.exponentialRampToValueAtTime(55 + lift * 15, t + 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((0.55 + lift * 0.35) * this.volume, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.2);
      this.noise(t, 0.12, 0.25 * this.volume, 900);
    } catch { /* 무시 */ }
  }

  /** 장면 전환용 깊은 충격음 */
  boom() {
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 1.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.8 * this.volume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 2.3);
      this.noise(t, 1.4, 0.18 * this.volume, 400);
    } catch { /* 무시 */ }
  }

  private noise(t: number, dur: number, level: number, cutoff: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.value = level;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  }

  /** 합격 공개용 짧은 화음 */
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.chime(f, 0.9), i * 110));
  }
}

export const audio = new AudioService();
