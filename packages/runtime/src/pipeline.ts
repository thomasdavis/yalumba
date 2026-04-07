/** A single stage in the processing pipeline */
export interface PipelineStage<TIn, TOut> {
  readonly name: string;
  execute(input: TIn): Promise<TOut> | TOut;
}

/** Result of running a pipeline */
export interface PipelineResult<T> {
  readonly output: T;
  readonly timings: Map<string, number>;
}

/**
 * Composable pipeline for chaining processing stages.
 * Tracks timing for each stage.
 */
export class Pipeline {
  private readonly stages: PipelineStage<unknown, unknown>[] = [];

  /** Add a stage to the pipeline */
  add<TIn, TOut>(stage: PipelineStage<TIn, TOut>): Pipeline {
    this.stages.push(stage as PipelineStage<unknown, unknown>);
    return this;
  }

  /** Execute the pipeline with an initial input */
  async run<TIn, TOut>(input: TIn): Promise<PipelineResult<TOut>> {
    const timings = new Map<string, number>();
    let current: unknown = input;

    for (const stage of this.stages) {
      const start = performance.now();
      current = await stage.execute(current);
      timings.set(stage.name, performance.now() - start);
    }

    return {
      output: current as TOut,
      timings,
    };
  }

  /** Get the number of stages */
  get length(): number {
    return this.stages.length;
  }
}
