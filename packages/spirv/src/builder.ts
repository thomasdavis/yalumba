import type { SpirVOp, SpirVType, SpirVFunction } from "./types.js";
import { SpirVModule } from "./module.js";

/**
 * Fluent builder for constructing SPIR-V IR.
 * Provides a TypeScript DSL for defining compute kernels.
 */
export class SpirVBuilder {
  private readonly module: SpirVModule;
  private currentOps: SpirVOp[] = [];
  private currentParams: SpirVType[] = [];

  constructor(module?: SpirVModule) {
    this.module = module ?? new SpirVModule();
  }

  /** Define a constant value */
  constant(type: SpirVType, value: number): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpConstant", operands: [value], resultType: type });
    return id;
  }

  /** Load from a pointer */
  load(pointer: number, type: SpirVType): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpLoad", operands: [pointer], resultType: type });
    return id;
  }

  /** Store to a pointer */
  store(pointer: number, value: number): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpStore", operands: [pointer, value] });
    return id;
  }

  /** Add two values */
  add(a: number, b: number, type: SpirVType): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpIAdd", operands: [a, b], resultType: type });
    return id;
  }

  /** Multiply two values */
  mul(a: number, b: number, type: SpirVType): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpIMul", operands: [a, b], resultType: type });
    return id;
  }

  /** Bitwise AND */
  bitwiseAnd(a: number, b: number, type: SpirVType): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpBitwiseAnd", operands: [a, b], resultType: type });
    return id;
  }

  /** Shift right */
  shiftRight(value: number, amount: number, type: SpirVType): number {
    const id = this.module.allocId();
    this.currentOps.push({ id, op: "OpShiftRightLogical", operands: [value, amount], resultType: type });
    return id;
  }

  /** Begin a function definition */
  beginFunction(name: string, returnType: SpirVType, params: SpirVType[]): void {
    this.currentOps = [];
    this.currentParams = params;
  }

  /** End the current function and add it to the module */
  endFunction(name: string, returnType: SpirVType): void {
    const fn: SpirVFunction = {
      name,
      returnType,
      params: this.currentParams,
      body: [...this.currentOps],
    };
    this.module.addFunction(fn);
    this.currentOps = [];
    this.currentParams = [];
  }

  /** Get the constructed module */
  build(): SpirVModule {
    return this.module;
  }
}
