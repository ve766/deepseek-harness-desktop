declare module '@standard-schema/spec' {
  export type StandardSchemaV1<Input = unknown, Output = Input> = {
    readonly __brand?: 'StandardSchemaV1'
    '~standard-schema': { input: Input; output: Output }
  }
}
