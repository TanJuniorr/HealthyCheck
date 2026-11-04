type Change = { owner: string; id: string; saved: boolean };
const listeners = new Set<(change: Change) => void>();
export function publishArticleBookmark(change: Change) {
  listeners.forEach((listener) => listener(change));
}
export function subscribeArticleBookmarks(listener: (change: Change) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
