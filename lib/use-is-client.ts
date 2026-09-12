import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 서버 렌더링과 hydration 중에는 false, 그 뒤 클라이언트에서는 true를 돌려준다.
 * window나 navigator를 읽는 값을 렌더 중에 계산할 때 이 값으로 가른다.
 * useEffect 안에서 setState로 mounted 플래그를 세우던 자리를 대신한다.
 */
export function useIsClient() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
