const STORAGE_KEY_PREFIX = "arcade-racer-best-lap-";

/** Best lap time per track, persisted in localStorage. Falls back to in-memory only if storage is unavailable. */
export const BestTimes = {
  get(trackId: string): number | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + trackId);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  },

  set(trackId: string, seconds: number) {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + trackId, String(seconds));
    } catch {
      // storage unavailable (private mode, quota, etc.) - best time just won't persist
    }
  },
};
