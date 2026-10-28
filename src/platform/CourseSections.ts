import type { WorldPhase, WorldProgression } from "../progression/WorldProgression";
import type { PlatformEncounterTheme } from "./PlatformRoutePlanner";

export type CourseSection = "run-up" | "cascade" | "maneuver" | "loot" | "tension" | "breather" | "climax";
export type CascadeVariant = "wide" | "winding" | "risky";
const sequences: Record<WorldPhase, readonly CourseSection[]> = {
  introduction: ["run-up", "cascade", "breather", "loot", "breather", "maneuver", "breather"],
  development: ["cascade", "breather", "maneuver", "breather", "loot", "cascade", "breather", "tension", "breather"],
  climax: ["climax", "breather", "cascade", "breather", "loot", "breather", "tension", "breather"],
};
const themes: Record<CourseSection, PlatformEncounterTheme> = {
  "run-up": "run-up", cascade: "break-run", maneuver: "trap", loot: "rich-lane",
  tension: "death-tunnel", breather: "breather", climax: "climax",
};
const crystalIntroduction: readonly CourseSection[] = ["maneuver", "breather", "loot", "breather", "tension", "breather", "run-up", "cascade", "breather"];
export function courseSectionAt(phase: WorldPhase, index: number, location: WorldProgression["location"] = "sky"): CourseSection {
  const sequence = location === "crystal" && phase === "introduction" ? crystalIntroduction : sequences[phase];
  return sequence[index % sequence.length] ?? "breather";
}
export function sectionTheme(section: CourseSection): PlatformEncounterTheme { return themes[section]; }
export function sectionForTheme(theme: PlatformEncounterTheme): CourseSection {
  if (theme === "break-run") return "cascade";
  if (theme === "rich-lane" || theme === "bait") return "loot";
  if (theme === "trap" || theme === "chaos" || theme === "deception") return "maneuver";
  if (theme === "danger-lane" || theme === "death-tunnel") return "tension";
  return theme;
}
export function cascadeVariant(phase: WorldPhase): CascadeVariant {
  return phase === "introduction" ? "wide" : phase === "development" ? "winding" : "risky";
}
export function climaxTheme(row: number): PlatformEncounterTheme {
  return (["break-run", "trap", "rich-lane", "death-tunnel", "breather"] as const)[Math.floor(row / 4)] ?? "breather";
}
export function sectionRows(section: CourseSection, progress: WorldProgression): number {
  if (progress.location === "crystal" && progress.phase === "introduction" && ["maneuver", "loot", "tension"].includes(section)) return 8;
  if (section === "climax") return 20;
  if (section === "breather") return 4;
  if (section === "cascade") return progress.phase === "introduction" ? 8 : progress.phase === "development" ? 10 : 12;
  return section === "run-up" || section === "maneuver" ? 8 : 6;
}
