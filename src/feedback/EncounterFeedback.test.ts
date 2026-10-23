import { expect, it } from "vitest";
import { encounterMood } from "./EncounterFeedback";

it("distinguishes trap, reward and break encounters without presenting mixed rows as safe", () => {
  expect(encounterMood("bait")).toBe("trap");
  expect(encounterMood("trap")).toBe("trap"); expect(encounterMood("deception")).toBe("trap");
  expect(encounterMood("death-tunnel")).toBe("danger"); expect(encounterMood("danger-lane")).toBe("danger");
  expect(encounterMood("rich-lane")).toBe("reward"); expect(encounterMood("break-run")).toBe("shatter");
  expect(encounterMood("chaos")).toBe("neutral");
});
