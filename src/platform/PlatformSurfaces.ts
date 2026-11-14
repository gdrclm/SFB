export const SURFACES = ["island", "cloud", "bubble", "storm", "nest", "balloons", "web", "crystal", "hologram", "laser", "honeycomb", "spikes", "magnet", "liquid", "resonance"] as const;
export type PlatformSurface = typeof SURFACES[number];
export interface SurfaceState { hits: number; cells: number; charge: number; infection: number }
export const SURFACE_INFO: Record<PlatformSurface, readonly [string, string, string]> = {
 island: ["Остров", "Разбей слои или пробей с разгоном", "▰"], cloud: ["Облако", "Безопасная мягкая посадка", "☁"],
 bubble: ["Пузырь", "Слабый удар — батут; сильный — боковой порыв", "◯"], storm: ["Грозовая туча", "После разрыва уйди из электрического кольца", "ϟ"],
 nest: ["Гнездо", "Птицы улетят; поймай перо для высокого отскока", "⌁"], balloons: ["Связка шаров", "Лопни три шара — корзина упадёт", "♧"],
 web: ["Паутина", "Ненадолго задержит; BOOST разорвёт быстрее", "⌗"], crystal: ["Кристалл", "Остерегайся осколков после пробития", "◆"],
 hologram: ["Голограмма", "Полосатая прозрачная платформа пропускает насквозь", "▱"], laser: ["Лазерный барьер", "Попади в яркий замок; лучи отбрасывают", "⊕"],
 honeycomb: ["Неоновые соты", "Пробей ячейку — соседние ослабнут", "⬡"], spikes: ["Кристальные шипы", "После пробития выйди из красного кольца", "✹"],
 magnet: ["Магнит", "Притягивает; удерживай направление или разбей", "∩"], liquid: ["Жидкий кристалл", "Растекается; лужа ненадолго вязкая", "≈"],
 resonance: ["Резонанс", "Разрушает соседей с таким же символом", "◎"],
};
export function surfaceHits(surface: PlatformSurface | undefined, seed: number): number {
 return surface === "balloons" ? 3 : surface === "island" && Math.abs(seed) % 4 === 3 ? 3 : 1;
}
export function customSurfaceArt(surface: PlatformSurface | undefined): boolean {
 return surface !== undefined && surface !== "cloud" && surface !== "bubble" && surface !== "crystal";
}
/** These contacts use a lock, cells, a timer or balloon count instead of a speed check. */
export function surfaceUsesStrength(surface:PlatformSurface|undefined):boolean{
 return surface!=="hologram"&&surface!=="laser"&&surface!=="honeycomb"&&surface!=="web"&&surface!=="balloons";
}
