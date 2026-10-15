// kling-작업/2_결과영상여기에/ 의 영상을 웹용(H.264, 1080p, 무음)으로 바꿔 public/assets/videos/ 에 넣는다.
// 있는 영상만 처리하고, 앱이 읽을 목록(manifest.json)을 만든다. 없는 장면은 앱이 정지 이미지로 대체한다.
// 사용: npm run videos
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const IN = 'kling-작업/2_결과영상여기에';
const OUT = 'public/assets/videos';

const MAP = {
  '01_남자_대기': 'boy/idle',
  '02_남자_손얹기': 'boy/touch',
  '03_남자_소환': 'boy/summon',
  '04_남자_용신등장': 'boy/dragon',
  '05_여자_대기': 'girl/idle',
  '06_여자_손얹기': 'girl/touch',
  '07_여자_소환': 'girl/summon',
  '08_여자_용신등장': 'girl/dragon',
  '09_손클로즈업': 'touch-hand',
  '10_배경_소환': 'bg-summon',
  '11_배경_밝음': 'bg-day',
};

const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${args.join(' ')}`);
};

const available = [];
for (const [name, key] of Object.entries(MAP)) {
  const src = ['.mp4', '.mov', '.webm'].map((e) => path.join(IN, name + e)).find(existsSync);
  if (!src) {
    console.log(`  없음  ${name}`);
    continue;
  }
  const rel = `assets/videos/${key}.mp4`;
  const out = path.join('public', rel);
  mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg([
    '-i', src,
    '-an',
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    out,
  ]);
  available.push(rel);
  console.log(`  완료  ${name} → ${rel} (${(statSync(out).size / 1024 / 1024).toFixed(1)}MB)`);
}

// 초록 배경 위 용 얼굴 영상 → 크로마키로 투명 배경 WebM(VP9 알파). 사진·합격 화면 위쪽에 얹는다
const greenDragon = path.join(IN, '12_용얼굴_그린.mp4');
if (existsSync(greenDragon)) {
  const rel = 'assets/videos/dragon-face.webm';
  mkdirSync(OUT, { recursive: true });
  ffmpeg([
    '-i', greenDragon,
    '-vf', 'crop=1460:960:230:60,chromakey=0x00FF00:0.13:0.05,scale=-2:720,format=yuva420p',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-auto-alt-ref', '0',
    '-metadata:s:v:0', 'alpha_mode=1', '-an',
    path.join('public', rel),
  ]);
  available.push(rel);
  console.log(`  완료  12_용얼굴_그린 → ${rel} (투명 배경)`);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ videos: available }, null, 2));
console.log(`영상 ${available.length}개 등록 → ${OUT}/manifest.json`);
