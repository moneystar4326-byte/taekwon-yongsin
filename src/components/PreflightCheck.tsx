import { useEffect, useState } from 'react';
import { POOMS, type CeremonySettings, type Student } from '../domain/types';
import { buildPresentationGroups } from '../domain/buildPresentationGroups';
import { allAssets, CLEAN_BACKGROUNDS, type AssetStatus } from '../config/assets-manifest';
import { preloadAll } from '../services/preload';
import { audio } from '../services/audio';

const STATUS_LABEL: Record<AssetStatus, string> = { approved: '승인', 'needs-review': '검수 필요', missing: '없음' };

export function PreflightCheck({ students, settings }: { students: Student[]; settings: CeremonySettings }) {
  const [loaded, setLoaded] = useState<Record<string, boolean> | null>(null);
  const [voices, setVoices] = useState(0);

  useEffect(() => {
    let cancelled = false;
    preloadAll(allAssets().filter((a) => a.status !== 'missing').map((a) => a.path)).then((rs) => {
      if (!cancelled) setLoaded(Object.fromEntries(rs.map((r) => [r.path, r.ok])));
    });
    const count = () => setVoices(audio.koreanVoices().length);
    count();
    if (audio.speechSupported) speechSynthesis.addEventListener?.('voiceschanged', count);
    return () => {
      cancelled = true;
      if (audio.speechSupported) speechSynthesis.removeEventListener?.('voiceschanged', count);
    };
  }, []);

  const pass = students.filter((s) => s.result === 'PASS');
  const pending = students.filter((s) => s.result === 'PENDING');
  const noPhoto = pass.filter((s) => !s.photoBlobId);
  const { groups } = buildPresentationGroups(students, settings.mode);

  const assets = allAssets();
  const relevant = assets.filter((a) => !a.path.includes(settings.avatar === 'boy' ? '/girl' : '/boy') && !a.path.includes(settings.avatar === 'boy' ? 'girl-' : 'boy-'));
  const problems = relevant.filter((a) => a.status !== 'approved' || (loaded && !loaded[a.path]));
  const cleanReady = loaded?.[CLEAN_BACKGROUNDS.day.path] && loaded?.[CLEAN_BACKGROUNDS.summon.path];

  return (
    <div className="preflight">
      <div className="grid-2">
        <div>
          <h4>품별 인원</h4>
          <table className="mini">
            <thead><tr><th>품</th><th>합격</th><th>불합격</th><th>미정</th><th>발표 페이지</th></tr></thead>
            <tbody>
              {POOMS.map((p) => {
                const of = students.filter((s) => s.poom === p);
                return (
                  <tr key={p}>
                    <td>{p}품</td>
                    <td>{of.filter((s) => s.result === 'PASS').length}</td>
                    <td>{of.filter((s) => s.result === 'FAIL').length}</td>
                    <td>{of.filter((s) => s.result === 'PENDING').length}</td>
                    <td>{groups.filter((g) => g.poom === p).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">공개 화면에는 합격(PASS)만 나옵니다. 불합격·미정은 이 준비 화면에서만 보입니다.</p>
        </div>

        <div>
          <h4>점검 항목</h4>
          <ul className="checks">
            <li className={pass.length > 0 ? 'ok' : 'bad'}>
              {pass.length > 0 ? `합격 ${pass.length}명, 발표 ${groups.length}회` : '합격자가 0명이라 행사를 시작할 수 없습니다'}
            </li>
            <li className={pending.length === 0 ? 'ok' : 'warn'}>
              {pending.length === 0 ? '결과 미정 없음' : `결과 미정 ${pending.length}명 (발표에서 제외됨)`}
            </li>
            <li className={noPhoto.length === 0 ? 'ok' : 'warn'}>
              {noPhoto.length === 0 ? '합격자 사진 모두 있음' : `사진 없는 합격자 ${noPhoto.length}명 (이니셜로 표시): ${noPhoto.map((s) => s.name).join(', ')}`}
            </li>
            <li className={audio.speechSupported && voices > 0 ? 'ok' : 'warn'}>
              {!audio.speechSupported ? '이 브라우저는 음성 읽기를 지원하지 않습니다 (자막으로 진행)'
                : voices > 0 ? `한국어 음성 ${voices}개 사용 가능` : '한국어 음성을 찾지 못했습니다 (자막으로 진행)'}
            </li>
            <li className={settings.muted ? 'warn' : 'ok'}>
              음량 {Math.round(settings.volume * 100)}%{settings.muted ? ' · 음소거 상태' : ''}
              <button
                className="btn tiny"
                onClick={() => {
                  audio.unlock();
                  audio.configure(settings.volume, false);
                  void audio.speak('음량 확인입니다. 태권용신, 깨어나라!');
                  audio.chime(660, 0.8);
                }}
              >소리 확인</button>
            </li>
            <li className={cleanReady ? 'ok' : 'warn'}>
              {cleanReady ? '클린 배경 사용' : '클린 배경 없음 — 카운트다운·합격 장면은 임시 배경'}
            </li>
          </ul>
        </div>
      </div>

      <details className="assets-detail" open={problems.length > 0}>
        <summary>이미지 자산 상태 ({settings.avatar === 'boy' ? '남자' : '여자'} 주인공 기준) — 확인 필요 {problems.length}건</summary>
        {!loaded && <p className="muted">이미지 확인 중…</p>}
        <table className="mini assets">
          <thead><tr><th>자산</th><th>상태</th><th>불러오기</th><th>메모</th></tr></thead>
          <tbody>
            {relevant.map((a) => (
              <tr key={a.path}>
                <td>{a.label}<div className="muted small"><code>{a.path}</code></div></td>
                <td><span className={`status ${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
                <td>{a.status === 'missing' ? '없음' : !loaded ? '…' : loaded[a.path] ? '정상' : <span className="bad-text">실패</span>}</td>
                <td className="small">{a.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
