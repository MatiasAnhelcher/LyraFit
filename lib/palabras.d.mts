// Los tipos de `palabras.mjs`, para que `palabras.test.ts` la pueda importar
// sin abrirle a TypeScript todo `lib/`.
export declare const PROHIBIDAS: readonly RegExp[]
export declare function loProhibido(texto: string): string | null
