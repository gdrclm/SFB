type GameStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

/** GitHub Pages shares an origin with other projects: only remove SFB game keys; retain online identity and pending submissions. */
export function resetGameData(storage: GameStorage): void {
  const saved = new Map<string, string>();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("speed-fall-ball.") && !key.startsWith("speed-fall-ball.network.")) {
      const value = storage.getItem(key);
      if (value !== null) saved.set(key, value);
    }
  }
  try {
    for (const key of saved.keys()) storage.removeItem(key);
  } catch (error: unknown) {
    // Best effort rollback if storage access changes partway through deletion.
    for (const [key, value] of saved) {
      try { storage.setItem(key, value); } catch { /* The UI reports failure. */ }
    }
    throw error;
  }
}
