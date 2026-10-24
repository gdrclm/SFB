import type { FixedSimulationSystem } from "./FixedStepRunner";
interface Tick { fixedUpdate(seconds: number, realSeconds?: number): void; }
/** Resolve physical contacts before rewards and recycling. Keep this order in one place. */
export class WorldStep implements FixedSimulationSystem {
  public constructor(
    private readonly ball: Tick,
    private readonly collisions: Tick,
    private readonly coins: Tick,
    private readonly coinCleanup: Tick,
    private readonly platforms: Tick,
    private readonly continuing: () => boolean = () => true,
  ) {}
  public fixedUpdate(seconds: number, realSeconds = seconds): void {
    this.ball.fixedUpdate(seconds, realSeconds);
    this.collisions.fixedUpdate(seconds, realSeconds);
    if (!this.continuing()) return;
    this.coins.fixedUpdate(seconds, realSeconds);
    this.coinCleanup.fixedUpdate(seconds, realSeconds);
    this.platforms.fixedUpdate(seconds, realSeconds);
  }
}
