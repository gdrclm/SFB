export const GameState = {
  Loading: "loading",
  Tutorial: "tutorial",
  Playing: "playing",
  Paused: "paused",
  SlowMode: "slow-mode",
  PhaseTransition: "phase-transition",
  BounceRecovery: "bounce-recovery",
  GameOver: "game-over",
  Results: "results",
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

export class GameStateController {
  #current: GameState = GameState.Loading;

  public get current(): GameState {
    return this.#current;
  }

  public transitionTo(nextState: GameState): void {
    this.#current = nextState;
  }
}
