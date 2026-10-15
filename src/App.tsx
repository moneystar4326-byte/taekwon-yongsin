import { useEffect, useState } from 'react';
import { SetupPage } from './pages/SetupPage';
import { CeremonyPage } from './pages/CeremonyPage';

/**
 * 해시 라우팅(#/setup, #/ceremony). 빌드 결과를 어떤 정적 서버에 올려도
 * 새로고침 시 404 없이 같은 화면으로 돌아온다.
 */
function useRoute() {
  const read = () => (window.location.hash.replace(/^#/, '') || '/setup');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useRoute();
  return route.startsWith('/ceremony') ? <CeremonyPage key="ceremony" /> : <SetupPage key="setup" />;
}
