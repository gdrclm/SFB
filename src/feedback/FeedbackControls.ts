import { FeedbackSettings, type FeedbackSetting } from "./FeedbackSettings";
import { getHaptics } from "./Haptics";

/** One settings owner for main menu and pause; audio channels never control haptics. */
export function initializeFeedbackControls(): void {
  const settings = new FeedbackSettings(() => window.localStorage);
  const haptics = getHaptics();
  const apply = (): void => {
    haptics.setEnabled(settings.get("vibration"));
    document.documentElement.dataset.musicEnabled = String(settings.get("music"));
    document.documentElement.dataset.effectsEnabled = String(settings.get("effects"));
    for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
      media.muted = !settings.get(media.dataset.audioChannel === "music" ? "music" : "effects");
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-feedback-setting]")) {
      const name = button.dataset.feedbackSetting as FeedbackSetting;
      const available = name !== "vibration" || haptics.available;
      button.disabled = !available;
      button.setAttribute("aria-pressed", String(available && settings.get(name)));
      const label = button.querySelector(".setting-state");
      if (label !== null) label.textContent = !available ? "НЕДОСТУПНА" : settings.get(name) ? "ВКЛ" : "ВЫКЛ";
    }
    for (const hint of document.querySelectorAll("[data-vibration-support]")) hint.textContent = haptics.available ? "" : "Этот браузер не предоставляет доступ к вибрации. Игра работает без неё.";
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-feedback-setting]")) {
    const name = button.dataset.feedbackSetting as FeedbackSetting;
    button.addEventListener("click", () => { settings.set(name, !settings.get(name)); });
  }
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
}
