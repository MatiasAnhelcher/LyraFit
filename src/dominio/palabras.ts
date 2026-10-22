/**
 * Lo que la app no dice nunca, en ningún lado.
 *
 * Vivía repetido: una lista en `frases.test.ts` para Lyra y otra en
 * `biblioteca.test.ts` para las fichas, cada una con su criterio. Con tres
 * sesiones por día y líneas nuevas que salen de un dato, una tercera copia
 * habría sido la que se olvida de "te pasaste". Así que la lista es una, acá,
 * y la miran los tests de Lyra, de las fichas y de las líneas.
 *
 * Los portones leen pantallas y no importan TypeScript, así que tienen su
 * copia en `lib/palabras.mjs`. `palabras.test.ts` verifica que las dos sean la
 * misma, letra por letra, y que digan lo mismo de los mismos textos.
 *
 * No se llama `voz.ts` porque `src/voz.ts` ya es el habla.
 *
 * ## Por qué expresiones y no palabras sueltas
 *
 * Porque "te falta" no se puede decir y "Te faltan 7 para llegar a 10" sí: es
 * el hito, y T3 lo deja como está. Y porque `\b` no sirve en castellano: para
 * JavaScript la "á" de "recuperá" no es una letra, así que `\brecuperá\b` no
 * encuentra nunca "recuperá." al final de una frase. Por eso los bordes son
 * `\p{L}` con la bandera `u`.
 */

/** Ni letra ni número antes: la palabra empieza acá. */
const ANTES = '(?<![\\p{L}\\p{N}])'
/** Ni letra ni número después: la palabra termina acá. */
const DESPUES = '(?![\\p{L}\\p{N}])'

/** Una palabra o frase entera. */
const entera = (frase: string) => new RegExp(`${ANTES}${frase}${DESPUES}`, 'iu')
/** Todo lo que empieza así: "fracas" es fracaso, fracasar y fracasaste. */
const raiz = (comienzo: string) => new RegExp(`${ANTES}${comienzo}`, 'iu')

export const PROHIBIDAS: readonly RegExp[] = [
  // Promesas. El motor es lo único que proyecta, y proyecta con una cuenta.
  entera('vas a (lograr|conseguir|poder|tener|llegar|estar)'),
  raiz('garantiz'),
  entera('en (un|dos|tres|seis) (mes|meses|semanas?)'),
  entera('te lo prometo'),
  entera('seguro que'),
  // Culpa, vergüenza y urgencia.
  entera('no aflojes'),
  entera('sin excusas?'),
  entera('vag[oa]s?'),
  entera('rachas?'),
  entera('última oportunidad'),
  entera('te vas a arrepentir'),
  entera('nadie más.*que vos'),
  entera('deberías'),
  entera('(es|fue|por) tu culpa'),
  entera('culpables?'),
  raiz('fracas'),
  entera('débil(es)?'),
  // Lo que suena a reto cuando alguien entrena más de una vez por día.
  entera('demasiad[oa]s?'),
  entera('cuidado'),
  entera('te pasaste'),
  entera('necesitás descansar'),
  raiz('sobreentren'),
  // Lo que falta no se nombra. El hito queda, en plural y en singular ("Te
  // faltan 7 para llegar a 10", "Te falta 1 para llegar a 10"); "te falta"
  // en cualquier otra frase, no.
  entera('no completaste'),
  entera('te faltó'),
  new RegExp(`${ANTES}te falta${DESPUES}(?!\\s*1 para llegar)`, 'iu'),
  entera('atrasad[oa]s?'),
  entera('fallaste'),
  entera('perdiste'),
  // Órdenes sobre el cuerpo y promesas de salud.
  entera('recuperá'),
  entera('quemá'),
  entera('calorías?'),
  raiz('tonific'),
  raiz('previen'),
  entera('48 horas'),
  // La persona no es sujeto de un adjetivo con género, ni de un color.
  entera('cansad[oa]s?'),
  entera('estás en ámbar'),
  entera('estás en rojo'),
]

/** Lo primero de `PROHIBIDAS` que dice este texto, o null si no dice nada. */
export function loProhibido(texto: string): string | null {
  for (const expresion of PROHIBIDAS) {
    const encontrado = expresion.exec(texto)
    if (encontrado) return encontrado[0]
  }
  return null
}
