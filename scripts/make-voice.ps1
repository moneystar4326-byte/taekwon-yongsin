# 용신 내레이션 녹음 (A3: 인준 음성 + 낮춤 + 홀 잔향 + 은은한 에코, 음량 크게)
# 사용: powershell -File scripts\make-voice.ps1 -EdgeTts <edge-tts.exe 경로>
# 준비: python -m venv .tts; .tts\Scripts\pip install edge-tts
# 결과: public/assets/voice/*.mp3  (앱의 VOICE_FILES 가 이 파일들을 우선 재생한다)
#
# 이름 녹음: 준비 화면의 [이름 음성 목록 저장]으로 받은 voice-names.txt 를 넘기면
#   "이름, N품 합격! 축하한다!" 를 public/assets/voice/names/N-이름.mp3 로 만든다.
#   powershell -File scripts\make-voice.ps1 -Names "$env:USERPROFILE\Downloads\voice-names.txt"
param([string]$EdgeTts = "edge-tts", [string]$Names = "")

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'public\assets\voice'
$tmp = Join-Path $env:TEMP 'ty-voice'
New-Item -ItemType Directory -Force $out, $tmp | Out-Null

$lines = [ordered]@{
  idle     = '열한 개의 수련구슬이 모였습니다.'
  touch    = '이 작은 손에, 우리의 노력이 담겨 있습니다.'
  dragon   = '나를 깨운 용감한 수련생들이여. 너희의 도전을 기억하고 있다.'
  ready    = '지금부터, 너희가 기다려온 소식을 전하겠다.'
  pass1    = '1품 합격! 축하한다!'
  pass2    = '2품 합격! 축하한다!'
  pass3    = '3품 합격! 축하한다!'
  pass4    = '4품 합격! 축하한다!'
  complete = '오늘의 성취를 가슴에 품고, 다음 도전으로 나아가라.'
}

# 큰 홀 잔향(2.8초)
$hall = Join-Path $tmp 'hall.wav'
ffmpeg -v error -y -f lavfi -i "aevalsrc='(random(0)*2-1)*exp(-2.4*t)|(random(1)*2-1)*exp(-2.4*t)':s=44100:d=2.8" -af "lowpass=f=4000,highpass=f=120" $hall

$fx = "[0]aresample=44100,aformat=channel_layouts=stereo,rubberband=pitch=0.78:formant=shifted:transients=smooth:window=long,lowshelf=g=4:f=130,apad=pad_dur=2,asplit=2[dry][r];[r][1]afir=dry=0:wet=1:length=1[wet];[dry][wet]amix=inputs=2:weights='1 0.35':normalize=0,aecho=1.0:0.9:420|840:0.28|0.13,acompressor=threshold=-20dB:ratio=3:attack=8:release=200,loudnorm=I=-11:TP=-0.5:LRA=7,silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-55dB"

function Record([string]$text, [string]$file) {
  $raw = Join-Path $tmp 'raw.mp3'
  # 한글이 깨지지 않도록 대사를 UTF-8 파일로 넘긴다
  $txt = Join-Path $tmp 'line.txt'
  [IO.File]::WriteAllText($txt, $text, [Text.UTF8Encoding]::new($false))
  & $EdgeTts --voice ko-KR-InJoonNeural --rate=-12% --file $txt --write-media $raw
  ffmpeg -v error -y -i $raw -i $hall -filter_complex $fx -c:a libmp3lame -b:a 192k $file
}

if ($Names) {
  $dir = Join-Path $out 'names'
  New-Item -ItemType Directory -Force $dir | Out-Null
  foreach ($row in [IO.File]::ReadAllLines($Names, [Text.Encoding]::UTF8)) {
    $p = $row.TrimStart([char]0xFEFF).Split("`t")
    if ($p.Count -lt 2 -or -not $p[1].Trim()) { continue }
    $poom = $p[0].Trim(); $name = $p[1].Trim()
    $say = if ($p.Count -ge 3 -and $p[2].Trim()) { $p[2].Trim() } else { $name }
    $safe = $name -replace '[\\/:*?"<>|]', '_'
    Record "$say, ${poom}품 합격! 축하한다!" (Join-Path $dir "$poom-$safe.mp3")
    Write-Host "  names/$poom-$safe.mp3"
  }
  return
}

foreach ($id in $lines.Keys) {
  Record $lines[$id] (Join-Path $out "$id.mp3")
  Write-Host "  $id.mp3"
}
