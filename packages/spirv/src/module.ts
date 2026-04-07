import type { SpirVFunction, SpirVOp, SpirVType } from "./types.js";

/**
 * Represents a SPIR-V module — a collection of functions and declarations.
 * This is the IR that gets lowered to C code or directly to SPIR-V binary.
 */
export class SpirVModule {
  readonly functions: SpirVFunction[] = [];
  private nextId = 1;

  /** Allocate a new SSA ID */
  allocId(): number {
    return this.nextId++;
  }

  /** Add a function to the module */
  addFunction(fn: SpirVFunction): void {
    this.functions.push(fn);
  }

  /** Find a function by name */
  getFunction(name: string): SpirVFunction | undefined {
    return this.functions.find((f) => f.name === name);
  }

  /** Get all operations across all functions */
  allOps(): SpirVOp[] {
    return this.functions.flatMap((f) => f.body);
  }

  /** Get the current ID counter (useful for serialization) */
  get idBound(): number {
    return this.nextId;
  }
}
