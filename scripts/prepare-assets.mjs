// 원본(assets-source/)은 그대로 두고 웹용 변환본을 public/assets/ 에 만든다.
// 사용: npm run assets
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'assets-source';
const OUT = 'public/assets';

const src = (name) => path.join(SRC, name);
const out = async (rel) => {
  const p = path.join(OUT, rel);
  await mkdir(path.dirname(p), { recursive: true });
  return p;
};
const exists = (p) => access(p).then(() => true, () => false);

// ── 완성 장면 (불투명 16:9) ───────────────────────────────
const SCENES = {
  boy: { '01-idle': '12-boy-01-idle', '02-touch': '10-boy-02-touch', '03-summon': '09-boy-03-summon', '04-dragon': '11-boy-04-dragon' },
  girl: { '01-idle': '03-girl-01-idle', '02-touch': '06-girl-02-touch', '03-summon': '05-girl-03-summon', '04-dragon': '04-girl-04-dragon' },
};

async function scenes() {
  for (const [avatar, map] of Object.entries(SCENES)) {
    for (const [scene, file] of Object.entries(map)) {
      await sharp(src(`${file}.png`)).webp({ quality: 86 }).toFile(await out(`scenes/${avatar}/${scene}.webp`));
    }
  }
  await sharp(src('15-touch-hand-closeup.png')).webp({ quality: 86 }).toFile(await out('scenes/touch-hand.webp'));
}

// ── 배경 ─────────────────────────────────────────────────
// 클린 배경(인물·구슬 없음)이 assets-source/clean-day.png, clean-summon.png 로 들어오면 그것을 쓴다.
// 없으면 IDLE/SUMMON 장면을 강하게 흐린 임시 배경을 만든다(구슬·인물이 흐릿하게 남아 있음).
async function backgrounds() {
  for (const [kind, fallback] of [['day', '12-boy-01-idle'], ['summon', '09-boy-03-summon']]) {
    const clean = src(`clean-${kind}.png`);
    if (await exists(clean)) {
      await sharp(clean).resize(1920, 1080, { fit: 'cover' }).webp({ quality: 86 }).toFile(await out(`backgrounds/${kind}.webp`));
      console.log(`  clean-${kind}.png → backgrounds/${kind}.webp`);
    }
    await sharp(src(`${fallback}.png`))
      .blur(26)
      .modulate({ brightness: kind === 'day' ? 0.92 : 0.8 })
      .webp({ quality: 80 })
      .toFile(await out(`backgrounds/temp-${kind}.webp`));
  }
}

// ── 구슬: 원형 마스크로 가장자리 잔여 점 제거 후 512px 정사각 ──
const ORBS = {
  'taegeuk-01': '29-orb-taegeuk-01', 'taegeuk-02': '21-orb-taegeuk-02', 'taegeuk-03': '26-orb-taegeuk-03',
  'taegeuk-04': '27-orb-taegeuk-04', 'taegeuk-05': '25-orb-taegeuk-05', 'taegeuk-06': '24-orb-taegeuk-06',
  'taegeuk-07': '23-orb-taegeuk-07', 'taegeuk-08': '28-orb-taegeuk-08', koryo: '22-orb-koryo',
  keumgang: '20-orb-keumgang', taebaek: '17-orb-taebaek',
};

async function orb(id, file) {
  const { data, info } = await sharp(src(`${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // 거의 불투명한 픽셀의 무게중심과 면적으로 원의 중심·반지름을 추정 (잔여 점에 흔들리지 않음)
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 200) { n++; sx += x; sy += y; }
  }
  const cx = sx / n, cy = sy / n, r = Math.sqrt(n / Math.PI);
  const inner = r * 0.995, outer = r * 1.03;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - cx, y - cy);
    const i = (y * w + x) * 4 + 3;
    if (d >= outer) data[i] = 0;
    else if (d > inner) data[i] = Math.round(data[i] * (1 - (d - inner) / (outer - inner)));
  }
  const half = Math.ceil(outer) + 2;
  const left = Math.round(cx - half), top = Math.round(cy - half), size = half * 2;
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extend({ top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + size - h), right: Math.max(0, left + size - w), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extract({ left: Math.max(0, left), top: Math.max(0, top), width: size, height: size })
    .resize(512, 512)
    .webp({ quality: 90, alphaQuality: 90 })
    .toFile(await out(`orbs/${id}.webp`));
  console.log(`  orb ${id}: r=${r.toFixed(0)} center=(${cx.toFixed(0)},${cy.toFixed(0)})`);
}

// ── 투명 소재: 용신·주인공. 넓은 반투명 광채를 줄인다 ──────────
async function cutout(file, rel, { trim, height }) {
  const { data, info } = await sharp(src(`${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    data[i] = a <= trim ? 0 : Math.round(((a - trim) * 255) / (255 - trim));
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize({ height })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(await out(rel));
}

console.log('scenes…'); await scenes();
console.log('backgrounds…'); await backgrounds();
console.log('orbs…'); for (const [id, file] of Object.entries(ORBS)) await orb(id, file);
console.log('cutouts…');
await cutout('13-dragon-face', 'dragon/face.webp', { trim: 48, height: 820 });
await cutout('14-dragon-full', 'dragon/full.webp', { trim: 48, height: 1200 });
await cutout('16-boy-back-lookup', 'characters/boy-lookup.webp', { trim: 24, height: 1000 });
// 첫 장면(12번)에서 아이만 오려낸 것. 처음부터 끝까지 같은 아이가 나오도록 합성 화면에 쓴다
await sharp(src('30-boy-idle-cutout.png')).trim({ threshold: 1 }).resize({ height: 600 }).webp({ quality: 90, alphaQuality: 95 }).toFile(await out('characters/boy-idle.webp'));
await cutout('18-boy-back-reach', 'characters/boy-reach.webp', { trim: 24, height: 1000 });
await cutout('19-boy-back-stand', 'characters/boy-stand.webp', { trim: 24, height: 1000 });
console.log('done');
