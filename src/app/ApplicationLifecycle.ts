export interface LifecycleApplication {
  start(): Promise<void>;
  dispose(): void;
}

export class ApplicationLifecycle {
  readonly #createApplication: () => LifecycleApplication;
  #application: LifecycleApplication | null = null;

  public constructor(createApplication: () => LifecycleApplication) {
    this.#createApplication = createApplication;
  }

  public async restart(): Promise<void> {
    this.dispose();
    const application = this.#createApplication();
    this.#application = application;

    try {
      await application.start();
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
