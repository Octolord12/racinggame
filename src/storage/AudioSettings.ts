const KEY = "arcade-racer-muted";

/** Whether the player has muted game audio, persisted across sessions. */
export const AudioSettings = {
  isMuted(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },

  setMuted(muted: boolean) {
    try {
      localStorage.setItem(KEY, muted ? "1" : "0");
    } catch {
      // storage unavailable - preference just won't persist
    }
  },
};
