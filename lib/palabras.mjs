/**
 * Lo que la app no dice nunca, para los portones que leen pantallas.
 *
 * Es la copia de `src/dominio/palabras.ts`, que es donde está explicada.
 * Existe porque los portones son JavaScript suelto y no compilan TypeScript;
 * `palabras.test.ts` verifica que las dos listas sean la misma, letra por
 * letra, y que digan lo mismo de los mismos textos. Si cambiás una, cambiá
 * la otra: el test no te deja olvidarte.
 */

const ANTES = '(?<![\\p{L}\\p{N}])'
const DESPUES = '(?![\\p{L}\\p{N}])'

const entera = (frase) => new RegExp(`${ANTES}${frase}${DESPUES}`, 'iu')
const raiz = (comienzo) => new RegExp(`${ANTES}${comienzo}`, 'iu')

export const PROHIBIDAS = [
  entera('vas a (lograr|conseguir|poder|tener|llegar|estar)'),
  raiz('garantiz'),
  entera('en (un|dos|tres|seis) (mes|meses|semanas?)'),
  entera('te lo prometo'),
  entera('seguro que'),
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
  entera('demasiad[oa]s?'),
  entera('cuidado'),
  entera('te pasaste'),
  entera('necesitás descansar'),
  raiz('sobreentren'),
  entera('no completaste'),
  entera('te faltó'),
  new RegExp(`${ANTES}te falta${DESPUES}(?!\\s*1 para llegar)`, 'iu'),
  entera('atrasad[oa]s?'),
  entera('fallaste'),
  entera('perdiste'),
  entera('recuperá'),
  entera('quemá'),
  entera('calorías?'),
  raiz('tonific'),
  raiz('previen'),
  entera('48 horas'),
  entera('cansad[oa]s?'),
  entera('estás en ámbar'),
  entera('estás en rojo'),
]

/** Lo primero de `PROHIBIDAS` que dice este texto, o null si no dice nada. */
export function loProhibido(texto) {
  for (const expresion of PROHIBIDAS) {
    const encontrado = expresion.exec(texto)
    if (encontrado) return encontrado[0]
  }
  return null
}
