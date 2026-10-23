export interface LifecycleApplication {
  start(guided?: boolean): Promise<void>;
  reset(guided?: boolean): Promise<void>;
  dispose(): void;
}

export class ApplicationLifecycle {
  readonly #createApplication: () => LifecycleApplication;
  #application: LifecycleApplication | null = null;

  public constructor(createApplication: () => LifecycleApplication) {
    this.#createApplication = createApplication;
  }

  public async restart(guided?: boolean): Promise<void> {
    const application = this.#application ?? this.#createApplication();
    const reusing = this.#application !== null;
    this.#application = application;

    try {
      if (reusing) { if (guided === undefined) await application.reset(); else await application.reset(guided); }
      else { if (guided === undefined) await application.start(); else await application.start(guided); }
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
