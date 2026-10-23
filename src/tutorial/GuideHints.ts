import type { GuideTip } from "./StagedOpening";
export type TutorialInput = "desktop" | "touch";
export function tutorialInput(): TutorialInput {
  return typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches ? "desktop" : "touch";
}
export function guideHint(tip: GuideTip, input: TutorialInput): { text: string; target: string; seconds: number } | null {
  switch (tip) {
    case "platform": return { text: input === "desktop" ? "Веди курсор ↔" : "Свайпай ↔", target: "world", seconds: 6 };
    case "coin": return { text: "Монеты ускоряют: +1", target: "world", seconds: 5 };
    case "boost": return { text: input === "desktop" ? "ПКМ — BOOST!" : "Нажми BOOST!", target: "#boost-button", seconds: 7 };
    case "combo": return { text: "6 пробитий → BOOST", target: "#boost-button", seconds: 4 };
    case "fork": case "super-heavy": return { text: "Красная — опасно. Облетай!", target: "world", seconds: 6 };
    case "vitality": return { text: "Зелёная: +1 жизнь", target: "world", seconds: 6 };
    case "life": return { text: "−1 жизнь. Ищи зелёную", target: "#lives", seconds: 4 };
    case "time-slow": return { text: "Голубая замедляет", target: "world", seconds: 5 };
    case "annihilation": return { text: input === "desktop" ? "Пробел — очисти экран" : "Нажми — очисти экран", target: "#slow-mode-button", seconds: 8 };
    case "free": return null;
  }
}
