/* The question works before the game bundle loads. Consent never persists. */
(() => {
  const audio = document.getElementById("menu-music");
  const dialog = document.getElementById("music-consent");
  const yes = document.getElementById("music-consent-yes");
  const no = document.getElementById("music-consent-no");
  if (!(audio instanceof HTMLAudioElement) || !(dialog instanceof HTMLDialogElement) || !yes || !no) return;
  document.documentElement.dataset.musicConsent = "pending";
  let enabled = false, handedOff = false;
  audio.preload = "auto";
  audio.autoplay = false;
  audio.muted = true;
  audio.pause();
  try { audio.volume = .32; } catch { /* iOS gain is attached by the full controller. */ }
  audio.src = new URL("music-demo/miny-original.mp3", document.baseURI).href;
  const start = () => {
    if (!handedOff && enabled && !document.hidden) void audio.play().catch(() => {});
  };
  const visibility = () => { if (document.hidden) audio.pause(); else start(); };
  document.addEventListener("visibilitychange", visibility);
  const choose = value => {
    if (document.documentElement.dataset.musicConsent !== "pending") return;
    enabled = value;
    document.documentElement.dataset.musicConsent = value ? "accepted" : "declined";
    try { localStorage.setItem("speed-fall-ball.music-enabled", String(value)); } catch { /* This page's choice still works. */ }
    audio.muted = !value;
    if (!value) { audio.pause(); audio.preload = "none"; }
    dialog.close();
    // The settings owner and AudioContext start synchronously in the Yes click.
    audio.dispatchEvent(new CustomEvent("sfb:music-choice", { detail: value }));
    start();
    document.getElementById("start-run-button")?.focus({ preventScroll: true });
  };
  yes.addEventListener("click", () => { choose(true); });
  no.addEventListener("click", () => { choose(false); });
  dialog.addEventListener("cancel", event => { event.preventDefault(); });
  audio.addEventListener("sfb:music-handoff", () => {
    handedOff = true;
    document.removeEventListener("visibilitychange", visibility);
  }, { once: true });
  dialog.showModal();
})();
