import sprite from "./hud-icons.svg?raw";

export function hudArt(icon: "coin" | "heart-full" | "heart-lost"): string {
  return `<svg class="hud-art" viewBox="0 0 64 ${icon === "coin" ? "64" : "60"}" aria-hidden="true" focusable="false"><use href="#hud-icon-${icon}"></use></svg>`;
}

export function initializeHudArt(): void {
  if (document.querySelector("#hud-symbols") === null) {
    const symbols = document.createElement("div");
    symbols.id = "hud-symbols";
    symbols.setAttribute("aria-hidden", "true");
    symbols.innerHTML = sprite;
    document.body.prepend(symbols);
  }
  for (const node of document.querySelectorAll(".coin-emblem, .records-medal, .result-medal")) node.innerHTML = hudArt("coin");
}
