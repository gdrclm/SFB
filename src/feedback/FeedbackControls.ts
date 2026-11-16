import { FeedbackSettings, type FeedbackSetting } from "./FeedbackSettings";
import { getHaptics } from "./Haptics";
import { initializeBackgroundMusic, type BackgroundMusic } from "./BackgroundMusic";

/** One settings owner for main menu and pause; audio channels never control haptics. */
export function initializeFeedbackControls(): BackgroundMusic {
  const settings = new FeedbackSettings(() => window.localStorage);
  const haptics = getHaptics();
  const music = initializeBackgroundMusic();
  const consent = document.getElementById("menu-music");
  const hasChoice = (): boolean => ["accepted", "declined"].includes(document.documentElement.dataset.musicConsent ?? "");
  // The early prompt's choice must survive handoff even when storage is blocked.
  if (hasChoice()) settings.set("music", document.documentElement.dataset.musicConsent === "accepted");
  const apply = (): void => {
    const musicEnabled = hasChoice() && settings.get("music");
    haptics.setEnabled(settings.get("vibration"));
    document.documentElement.dataset.musicEnabled = String(musicEnabled);
    document.documentElement.dataset.effectsEnabled = String(settings.get("effects"));
    music.setEnabled(musicEnabled);
    for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
      media.muted = !(media.dataset.audioChannel === "music" ? musicEnabled : settings.get("effects"));
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-feedback-setting]")) {
      const name = button.dataset.feedbackSetting as FeedbackSetting;
      const available = name !== "vibration" || haptics.available;
      button.disabled = !available;
      const enabled = name === "music" ? musicEnabled : settings.get(name);
      button.setAttribute("aria-pressed", String(available && enabled));
      const label = button.querySelector(".setting-state");
      if (label !== null) label.textContent = !available ? "НЕДОСТУПНА" : enabled ? "ВКЛ" : "ВЫКЛ";
    }
    for (const hint of document.querySelectorAll("[data-vibration-support]")) hint.textContent = haptics.available ? "" : "Этот браузер не предоставляет доступ к вибрации. Игра работает без неё.";
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-feedback-setting]")) {
    const name = button.dataset.feedbackSetting as FeedbackSetting;
    button.addEventListener("click", () => {
      if (name === "music" && !hasChoice()) return;
      settings.set(name, !settings.get(name));
      if (name === "music" && settings.get(name)) music.unlock();
    });
  }
  consent?.addEventListener("sfb:music-choice", event => {
    const enabled = (event as CustomEvent<unknown>).detail;
    if (typeof enabled !== "boolean" || !hasChoice()) return;
    settings.set("music", enabled);
    if (enabled) music.unlock();
  });
  settings.subscribe(apply); haptics.subscribe(apply);
  new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes].some((node) => node instanceof Element && (node.matches("audio,video") || node.querySelector("audio,video") !== null)))) apply();
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!event.isTrusted || button === null || button.disabled || button.id === "boost-button" || button.id === "slow-mode-button") return;
    haptics.request("menu");
  });
  apply();
  // A choice made before this module finished loading belongs to this page too.
  if (hasChoice() && settings.get("music")) music.unlock();
  return music;
}
