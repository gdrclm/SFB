/* Keep first sound independent of Babylon, physics and the main JS download. */
(() => {
  const audio = document.getElementById("menu-music");
  if (!(audio instanceof HTMLAudioElement)) return;
  let enabled = true;
  try {
    const saved = localStorage.getItem("speed-fall-ball.music-enabled")
      ?? localStorage.getItem("speed-fall-ball.sound-enabled");
    enabled = saved === null || saved === "true";
  } catch { /* Use the same default as the game's settings. */ }
  audio.preload = enabled ? "auto" : "none";
  audio.muted = !enabled;
  try { audio.volume = .32; } catch { /* iOS gain is attached by the full controller. */ }
  audio.src = new URL("music-demo/miny-original.mp3", document.baseURI).href;
  audio.autoplay = enabled;
  const start = () => {
    if (enabled && !document.hidden) void audio.play().catch(() => {});
  };
  const retry = event => { if (event.isTrusted) start(); };
  const visibility = () => { if (document.hidden) audio.pause(); else start(); };
  document.addEventListener("pointerdown", retry, { passive: true });
  document.addEventListener("keydown", retry);
  document.addEventListener("visibilitychange", visibility);
  // The full music controller adopts this exact player and playback position.
  audio.addEventListener("sfb:music-handoff", () => {
    audio.autoplay = false;
    document.removeEventListener("pointerdown", retry);
    document.removeEventListener("keydown", retry);
    document.removeEventListener("visibilitychange", visibility);
  }, { once: true });
  start();
})();
