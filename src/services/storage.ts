import { DEFAULT_SETTINGS, usableAvatar, type CeremonySettings, type Phase, type Student, type Workspace } from '../domain/types';
import type { PresentationSnapshot } from '../domain/buildPresentationGroups';

/**
 * 이 기기 브라우저(IndexedDB)에만 저장한다. 서버 전송 없음.
 * 실제 명단과 연습 데이터는 서로 다른 데이터베이스로 분리한다.
 */

export class StorageError extends Error {}

function friendly(err: unknown): StorageError {
  const name = (err as DOMException | undefined)?.name;
  if (name === 'QuotaExceededError') {
    return new StorageError('저장 공간이 부족해 저장하지 못했습니다. 사진 수를 줄이거나 브라우저 저장 공간을 확인하세요.');
  }
  return new StorageError(`저장소 오류로 저장하지 못했습니다 (${name ?? String(err)}).`);
}

const dbName = (ws: Workspace) => `taekwon-yongsin-${ws}`;
const cache = new Map<Workspace, Promise<IDBDatabase>>();

function open(ws: Workspace): Promise<IDBDatabase> {
  let p = cache.get(ws);
  if (!p) {
    p = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new StorageError('이 브라우저는 로컬 저장(IndexedDB)을 지원하지 않습니다.'));
        return;
      }
      const req = indexedDB.open(dbName(ws), 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('kv');
        db.createObjectStore('students', { keyPath: 'id' });
        db.createObjectStore('blobs');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(friendly(req.error));
    });
    p.catch(() => cache.delete(ws));
    cache.set(ws, p);
  }
  return p;
}

type StoreName = 'kv' | 'students' | 'blobs';

async function tx<T>(
  ws: Workspace,
  stores: StoreName[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
  const db = await open(ws);
  return new Promise<T>((resolve, reject) => {
    let t: IDBTransaction;
    try {
      t = db.transaction(stores, mode);
    } catch (e) {
      reject(friendly(e));
      return;
    }
    let result: T;
    const req = fn(t);
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(friendly(t.error));
    t.onabort = () => reject(friendly(t.error));
  });
}

export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// ── 작업 공간(실제/연습) 선택: 작은 값이라 localStorage ──
const WS_KEY = 'ty.workspace';
export function getWorkspace(): Workspace {
  try {
    return localStorage.getItem(WS_KEY) === 'practice' ? 'practice' : 'real';
  } catch {
    return 'real';
  }
}
export function setWorkspace(ws: Workspace) {
  try { localStorage.setItem(WS_KEY, ws); } catch { /* 무시: 기본값 real */ }
}

// ── 설정 ──
export async function loadSettings(ws: Workspace): Promise<CeremonySettings> {
  const s = await tx<CeremonySettings | undefined>(ws, ['kv'], 'readonly', (t) => t.objectStore('kv').get('settings'));
  const merged = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  // 품별 단체 발표는 숨겼다: 언제나 한 명씩 발표한다
  return { ...merged, avatar: usableAvatar(merged.avatar), mode: 'INDIVIDUAL' };
}
export function saveSettings(ws: Workspace, s: CeremonySettings) {
  return tx<IDBValidKey>(ws, ['kv'], 'readwrite', (t) => t.objectStore('kv').put(s, 'settings'));
}

// ── 수련생 ──
export async function loadStudents(ws: Workspace): Promise<Student[]> {
  const list = await tx<Student[]>(ws, ['students'], 'readonly', (t) => t.objectStore('students').getAll());
  return list.sort((a, b) => a.order - b.order);
}
export function putStudents(ws: Workspace, list: Student[]) {
  return tx<void>(ws, ['students'], 'readwrite', (t) => {
    const os = t.objectStore('students');
    for (const s of list) os.put(s);
  });
}
/** 수련생과 그 사진을 함께 삭제한다 */
export function deleteStudents(ws: Workspace, list: Student[]) {
  return tx<void>(ws, ['students', 'blobs'], 'readwrite', (t) => {
    for (const s of list) {
      t.objectStore('students').delete(s.id);
      if (s.photoBlobId) t.objectStore('blobs').delete(s.photoBlobId);
    }
  });
}

// ── 사진·로고 Blob ──
export async function putBlob(ws: Workspace, blob: Blob): Promise<string> {
  const id = newId();
  await tx(ws, ['blobs'], 'readwrite', (t) => t.objectStore('blobs').put(blob, id));
  return id;
}
export function getBlob(ws: Workspace, id: string) {
  return tx<Blob | undefined>(ws, ['blobs'], 'readonly', (t) => t.objectStore('blobs').get(id));
}
export function deleteBlob(ws: Workspace, id: string) {
  return tx<undefined>(ws, ['blobs'], 'readwrite', (t) => t.objectStore('blobs').delete(id));
}

// ── 행사 진행 기록 (새로고침 복원용) ──
export interface SavedSession {
  snapshot: PresentationSnapshot;
  avatar: CeremonySettings['avatar'];
  mode: CeremonySettings['mode'];
  phase: Phase;
  groupIndex: number;
  savedAt: number;
}
export function loadSession(ws: Workspace) {
  return tx<SavedSession | undefined>(ws, ['kv'], 'readonly', (t) => t.objectStore('kv').get('session'));
}
export function saveSession(ws: Workspace, s: SavedSession) {
  return tx<IDBValidKey>(ws, ['kv'], 'readwrite', (t) => t.objectStore('kv').put(s, 'session'));
}
export function clearSession(ws: Workspace) {
  return tx<undefined>(ws, ['kv'], 'readwrite', (t) => t.objectStore('kv').delete('session'));
}

/** 작업 공간 전체 삭제 (명단·사진·설정·진행 기록) */
export async function wipeWorkspace(ws: Workspace) {
  const db = await cache.get(ws);
  db?.close();
  cache.delete(ws);
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName(ws));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(friendly(req.error));
    req.onblocked = () => reject(new StorageError('다른 탭에서 이 앱이 열려 있어 삭제하지 못했습니다. 다른 탭을 닫고 다시 시도하세요.'));
  });
}
