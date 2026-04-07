/** SPIR-V scalar types */
export type SpirVScalarType = "void" | "bool" | "u32" | "i32" | "f32" | "f64";

/** SPIR-V type representation */
export type SpirVType =
  | { kind: "scalar"; scalar: SpirVScalarType }
  | { kind: "vector"; element: SpirVScalarType; width: number }
  | { kind: "pointer"; pointee: SpirVType; storage: "function" | "uniform" | "storage" }
  | { kind: "array"; element: SpirVType; length: number };

/** A single SPIR-V operation in the IR */
export interface SpirVOp {
  /** Result ID (SSA) */
  readonly id: number;
  /** Operation name */
  readonly op: string;
  /** Operand IDs */
  readonly operands: readonly number[];
  /** Result type */
  readonly resultType?: SpirVType;
}

/** A function in the SPIR-V module */
export interface SpirVFunction {
  readonly name: string;
  readonly returnType: SpirVType;
  readonly params: readonly SpirVType[];
  readonly body: readonly SpirVOp[];
}
