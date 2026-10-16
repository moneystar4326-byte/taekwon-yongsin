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
        // 내레이션 녹음과 같은 여자 목소리(선희)를 먼저 고른다
        this.voice = ko.find((v) => /sunhi|sun-hi|선희/i.test(v.name))
          ?? ko.find((v) => /female|yuna|heami|여/i.test(v.name))
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
   * 합격 발표: "이름, N품 합격! 축하합니다!"
   * 1) 이름까지 내레이션 목소리로 미리 녹음한 파일(assets/voice/names/N-이름.mp3)이 있으면 그것을 재생
   * 2) 없으면 같은 여자 목소리로 이름을 부른 뒤 "N품 합격! 축하합니다!" 녹음을 잇는다
   */
  async speakPass(name: string, spoken: string, poom: number): Promise<void> {
    this.cancel();
    if (!this.unlocked || this.muted) return;
    const token = ++this.seq;
    const named = `assets/voice/names/${encodeURIComponent(`${poom}-${name}`)}.mp3`;
    if (await this.tryFile(named)) return;
    if (token !== this.seq) return;
    await this.tts(spoken || name, { rate: 0.95, pitch: 1 });
    if (token !== this.seq) return;
    if (!(await this.tryFile(`assets/voice/pass${poom}.mp3`)) && token === this.seq) {
      await this.tts(`${poom}품 합격! 축하합니다!`, { rate: 0.95, pitch: 1 });
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

  // ── 효과음(파일 없이 합성). 모두 큰 홀 잔향을 함께 보내 웅장하게 들리게 한다 ──

  private reverbIn: GainNode | null = null;

  /** 소리를 스피커로 보내면서 잔향 버스에도 wet 만큼 보낸다 */
  private out(node: AudioNode, wet = 0.3) {
    const ctx = this.ctx!;
    node.connect(ctx.destination);
    if (!this.reverbIn) {
      const len = Math.floor(ctx.sampleRate * 3);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-3.2 * i) / len);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      this.reverbIn = ctx.createGain();
      this.reverbIn.connect(conv).connect(ctx.destination);
    }
    const send = ctx.createGain();
    send.gain.value = wet;
    node.connect(send).connect(this.reverbIn);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, level: number, wet = 0.3) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * this.volume + 0.0001, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    this.out(g, wet);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, level: number, type: BiquadFilterType, freq: number, wet = 0.3, q = 0.7) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = level * this.volume;
    src.connect(f).connect(g);
    this.out(g, wet);
    src.start(t);
  }

  private ready() {
    return this.unlocked && !this.muted && !!this.ctx;
  }

  /** 카운트다운 숫자마다: 거대한 북(서브 저음 + 북통 + 타격음). 숫자가 줄수록 더 크고 높아진다 */
  drum(count = 5) {
    if (!this.ready()) return;
    try {
      const t = this.ctx!.currentTime;
      const lift = (5 - Math.min(5, Math.max(1, count))) / 4; // 0..1
      this.tone(t, 'sine', 62, 34, 1.6, 0.9 + lift * 0.25, 0.25); // 가슴을 울리는 서브 저음
      this.tone(t, 'sine', 140 + lift * 40, 70, 0.55, 0.6 + lift * 0.2, 0.4); // 북통
      this.noise(t, 0.18, 0.5 + lift * 0.3, 'bandpass', 1200, 0.5, 0.9); // 북채 타격
      if (count <= 2) {
        // 마지막 두 숫자는 금속성 울림을 더해 긴장감을 높인다
        this.tone(t, 'triangle', 220 + lift * 40, 210, 1.2, 0.12, 0.6);
        this.tone(t, 'triangle', 331 + lift * 60, 320, 1.2, 0.08, 0.6);
      }
    } catch { /* 무시 */ }
  }

  /** 카운트다운 동안 차오르는 상승음(바람 소리 + 올라가는 음) */
  riser(seconds = 5.4) {
    if (!this.ready()) return;
    try {
      const ctx = this.ctx!;
      const t = ctx.currentTime;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      f.type = 'bandpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(250, t);
      f.frequency.exponentialRampToValueAtTime(5000, t + seconds);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * this.volume, t + seconds * 0.95);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.05);
      src.connect(f).connect(g);
      this.out(g, 0.4);
      src.start(t);
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + seconds);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.08 * this.volume, t + seconds * 0.95);
      og.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.05);
      osc.connect(lp).connect(og);
      this.out(og, 0.5);
      osc.start(t);
      osc.stop(t + seconds + 0.1);
    } catch { /* 무시 */ }
  }

  /** 합격 공개 순간: 거대한 충격음 + 심벌 크래시 */
  impact() {
    if (!this.ready()) return;
    try {
      const t = this.ctx!.currentTime;
      this.tone(t, 'sine', 80, 28, 2.4, 1.0, 0.3);
      this.tone(t, 'sine', 160, 60, 0.8, 0.5, 0.4);
      this.noise(t, 0.35, 0.6, 'lowpass', 2500, 0.5);
      this.noise(t, 3.0, 0.45, 'highpass', 4500, 0.6); // 크래시 심벌
    } catch { /* 무시 */ }
  }

  /** 폭죽이 터지는 소리(작게) */
  pop() {
    if (!this.ready()) return;
    try {
      const t = this.ctx!.currentTime;
      this.noise(t, 0.12, 0.35, 'bandpass', 1800 + Math.random() * 1500, 0.5, 1.5);
      for (let i = 0; i < 5; i++) this.noise(t + 0.12 + Math.random() * 0.4, 0.04, 0.1, 'highpass', 5000, 0.4);
    } catch { /* 무시 */ }
  }

  /** 장면 전환용 깊은 충격음 */
  boom() {
    if (!this.ready()) return;
    try {
      const t = this.ctx!.currentTime;
      this.tone(t, 'sine', 70, 32, 2.2, 0.8, 0.35);
      this.noise(t, 1.4, 0.18, 'lowpass', 400, 0.4);
    } catch { /* 무시 */ }
  }

  /** 합격 공개용 짧은 화음 */
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.chime(f, 0.9), i * 110));
  }
}

export const audio = new AudioService();
