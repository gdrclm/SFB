export interface LifecycleApplication {
  start(): Promise<void>;
  reset(): Promise<void>;
  dispose(): void;
}

export class ApplicationLifecycle {
  readonly #createApplication: () => LifecycleApplication;
  #application: LifecycleApplication | null = null;

  public constructor(createApplication: () => LifecycleApplication) {
    this.#createApplication = createApplication;
  }

  public async restart(): Promise<void> {
    const application = this.#application ?? this.#createApplication();
    const reusing = this.#application !== null;
    this.#application = application;

    try {
      if (reusing) await application.reset();
      else await application.start();
    } catch (error: unknown) {
      if (this.#application === application) {
        application.dispose();
        this.#application = null;
      }
      throw error;
    }
  }

  public dispose(): void {
    this.#application?.dispose();
    this.#application = null;
  }
}
