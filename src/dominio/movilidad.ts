/**
 * La movilidad: doce fichas para moverse antes o después del trabajo.
 *
 * ## Por qué es una colección aparte
 *
 * Por lo mismo que `RAFAGAS`: no es fuerza. Una ficha de movilidad no tiene
 * ventana, ni `ccr`, ni cadena, ni eslabón al que equivalga, así que meterla en
 * `EJERCICIOS` obligaría a inventarle esos números, y el motor, la curva de
 * fuerza y el mapa muscular los leerían como si fueran ciertos. Acá no hay nada
 * que el motor pueda decidir: se hace con la dosis de la ficha, se guarda en
 * `Sesion.movilidad`, aparte de `registros`, y no suma al mapa ni cuenta como
 * sesión (§5.6 A de la reestructura).
 *
 * ## Lo que nunca dice
 *
 * Que previene lesiones. Estirar no lo mostró y el entrenamiento de fuerza sí
 * (Lauersen et al. 2014, metaanálisis), así que la ficha dice para qué sirve
 * con `PARA_QUE_SIRVE` y nada más. El test lo busca en cada texto, como el
 * portón del catálogo.
 *
 * ## De dónde salen los datos
 *
 * Las doce fichas son las M1 a M12 de `catalogo.md` §2, con sus textos, y la
 * tabla por zona es la de §6.4: criterio de kinesiología, que es opinión y no
 * medición, y por eso ningún texto de acá afirma nada del cuerpo.
 */

import type { Equipo, Medida, Sector } from './tipos'

/**
 * Lo que dice la ficha de movilidad debajo de la técnica, en todas las fichas.
 *
 * Una sola frase para las doce, y es esta porque es lo único que se puede
 * decir sin fuente: para qué se hace, no qué evita.
 */
export const PARA_QUE_SIRVE = 'Para moverte con comodidad y llegar al recorrido.'

/** Cuánto se hace de una ficha: las series y la cifra de cada una. */
export interface DosisDeMovilidad {
  series: number
  /** Repeticiones o segundos por serie, según `medida`; por lado si `porLado`. */
  cantidad: number
}

export interface FichaMovilidad {
  /** Kebab-case en castellano, como los de `biblioteca.ts`. No cambia nunca. */
  id: string
  nombre: string
  /**
   * La parte del cuerpo que mueve, como la dice `catalogo.md`: "Muñeca y
   * antebrazo", "Tobillo". Es texto y no un `Sector` porque la movilidad no
   * habla de músculos que se entrenan sino de articulaciones que se mueven, y
   * "columna torácica" no es ninguna de las ocho zonas del mapa.
   */
  zona: string
  /**
   * La cifra que se corre y la que se anota.
   *
   * De un rango de `catalogo.md` se toma lo más bajo, que es como ya lo
   * escriben las tablas de los mixes (`catalogo.md` §3): Piernas pone
   * "sentadilla profunda 2 × 20 s" y "zancada con rotación 4 por lado", y
   * Espalda "pasaje de hombros 1 × 8". La movilidad no progresa, así que no
   * hay techo al que llegar: quien quiere más, lo sube en su rutina.
   */
  dosis: DosisDeMovilidad
  medida: Medida
  /**
   * La cantidad es por lado, como `Ejercicio.porLado`: cada serie se hace dos
   * veces, una con cada lado y "Cambiá de lado" por corte, y la cifra de la
   * dosis vale para cada una. "2 × 30 s por lado" son 30 s de un lado y 30 s
   * del otro, no 15 y 15. Es obligatorio y no `?: true` como en `Ejercicio`
   * porque las doce fichas se escribieron juntas y cada una dice si lo es.
   */
  porLado: boolean
  /**
   * Las zonas con las que va: las de su fila en la tabla de §6.4 más las que
   * nombra el "Cuándo" de `catalogo.md`, llevadas a zonas (empuje es pecho,
   * tracción es espalda, la vertical es hombros, los fondos son brazos, la
   * sentada en L es core y la bisagra es piernas y glúteos). Es lo que sirve
   * para encontrarla por zona en el catálogo.
   *
   * No es la sesión de esa zona: la sesión es `MOVILIDAD_POR_SECTOR`, que
   * elige tres o cuatro y las ordena. Por eso esto puede tener más zonas que la
   * tabla, pero nunca menos (lo verifica el test): una ficha que la tabla pone
   * en Brazos tiene que aparecer al buscar por Brazos.
   */
  cuando: Sector[]
  /**
   * Un estiramiento para después del trabajo. Va en la sesión de movilidad de
   * su zona y en el Final de una rutina, y nunca en una entrada en calor: ni
   * en la de un mix ni en "+ Entrada en calor" del Constructor (§6.3 y §6.4).
   */
  despues?: true
  /**
   * El "Cuándo" de `catalogo.md` como lo lee la ficha, en "cuándo conviene".
   *
   * No está en la lista de campos de §5.1, y se suma porque `cuando` son zonas
   * y el texto dice cosas que una zona no dice: "al empezar cualquier sesión",
   * "antes de pistol, búlgara y patinador". El "o solo" de `catalogo.md` va
   * como "o aparte": la persona nunca es sujeto de un adjetivo con género
   * (§7.1), y "solo" se leía así.
   */
  conviene: string
  /**
   * Lo que hace falta, para agruparla por equipo en el catálogo. Todo lo que
   * piden las doce (pared, marco, toalla) se da por tenido (§6.5), así que
   * ninguna queda afuera por equipo. Tampoco está en la lista de §5.1.
   */
  equipo: Equipo[]
  /** Cómo se hace, en un párrafo: es corta y se lee de un vistazo. */
  tecnica: string
  /** El error común, uno: el que arruina el gesto. */
  error: string
}

/**
 * Las doce fichas, en el orden de `catalogo.md` (M1 a M12).
 *
 * Los ids están congelados desde que se publican, como los de los ejercicios:
 * un id está escrito en cada `Sesion.movilidad`, en cada paso `movilidad` de
 * una rutina y en cada copia de seguridad.
 */
export const MOVILIDAD: FichaMovilidad[] = [
  {
    // M1. La dosis es "2 × 10 balanceos por posición": la técnica pasa por
    // tres posiciones de la mano, así que los 10 van en cada una y la cifra que
    // se anota es la de la serie, como en cualquier otra ficha.
    id: 'munecas-cuatro-patas',
    nombre: 'Muñecas en cuatro patas',
    zona: 'Muñeca y antebrazo',
    dosis: { series: 2, cantidad: 10 },
    medida: 'repeticiones',
    porLado: false,
    cuando: ['pecho', 'hombros', 'brazos', 'core'],
    conviene: 'Antes de empuje, vertical, fondos y sentada en L.',
    equipo: ['nada'],
    tecnica:
      'En cuatro patas, balanceá el peso adelante y atrás con las palmas apoyadas. Repetí con los dedos hacia las rodillas y después con el dorso de la mano apoyado. Suave y sin dolor.',
    error: 'Cargar todo el peso de golpe con los dedos hacia atrás.',
  },
  {
    // M2. "Al empezar cualquier sesión": va con las ocho zonas.
    id: 'gato-vaca',
    nombre: 'Gato y vaca',
    zona: 'Columna',
    dosis: { series: 1, cantidad: 8 },
    medida: 'repeticiones',
    porLado: false,
    cuando: ['pecho', 'espalda', 'hombros', 'brazos', 'core', 'piernas', 'gluteos', 'cuerpo'],
    conviene: 'Al empezar cualquier sesión.',
    equipo: ['nada'],
    tecnica:
      'En cuatro patas, redondeá la espalda empujando el piso lejos. Después dejá bajar el pecho y llevá la mirada adelante. Lento, acompañando la respiración.',
    error: 'Hacerlo rápido y a los tirones.',
  },
  {
    id: 'libro-abierto',
    nombre: 'Libro abierto',
    zona: 'Columna torácica y hombro',
    dosis: { series: 1, cantidad: 6 },
    medida: 'repeticiones',
    porLado: true,
    cuando: ['espalda', 'hombros'],
    conviene: 'Antes de espalda y hombros.',
    equipo: ['nada'],
    tecnica:
      'Acostate de costado con las rodillas dobladas y los brazos estirados adelante. Abrí el brazo de arriba hacia el otro lado, siguiéndolo con la mirada. Las rodillas no se separan.',
    error: 'Despegar las rodillas para girar más.',
  },
  {
    id: 'zancada-rotacion',
    nombre: 'Zancada con rotación',
    zona: 'Cadera y columna torácica',
    dosis: { series: 1, cantidad: 4 },
    medida: 'repeticiones',
    porLado: true,
    cuando: ['piernas', 'gluteos', 'cuerpo'],
    conviene: 'Antes de piernas, glúteos y cuerpo completo.',
    equipo: ['nada'],
    tecnica:
      'Da un paso largo adelante y apoyá las dos manos por dentro del pie de adelante. Girá el pecho y llevá el brazo de ese lado al techo. Volvé y cambiá de pierna.',
    error: 'Dejar caer la rodilla de atrás de golpe al piso.',
  },
  {
    // M5. El marco es una ayuda "si hace falta", no lo que pide: va sin equipo.
    id: 'sentadilla-profunda-sostenida',
    nombre: 'Sentadilla profunda sostenida',
    zona: 'Cadera y tobillo',
    dosis: { series: 2, cantidad: 20 },
    medida: 'segundos',
    porLado: false,
    cuando: ['piernas'],
    conviene: 'Antes de piernas.',
    equipo: ['nada'],
    tecnica:
      'Bajá a la sentadilla más profunda que puedas con los talones apoyados, con una mano en un marco si hace falta. Empujá suave las rodillas hacia afuera con los codos. Respirá y quedate.',
    error: 'Levantar los talones para bajar más.',
  },
  {
    id: 'rodilla-pared',
    nombre: 'Rodilla a la pared',
    zona: 'Tobillo',
    dosis: { series: 1, cantidad: 10 },
    medida: 'repeticiones',
    porLado: true,
    cuando: ['piernas'],
    conviene: 'Antes de pistol, búlgara y patinador.',
    equipo: ['pared'],
    tecnica:
      'Parate frente a la pared con un pie a un palmo de ella. Llevá la rodilla a tocar la pared sin despegar el talón. Si llegás fácil, alejá el pie un poco.',
    error: 'Despegar el talón para llegar.',
  },
  {
    // M7. "Una toalla o una banda": la banda es la otra forma, no un pedido.
    // Va en la movilidad de todo el cuerpo (§6.4), que lleva tracción.
    id: 'pasaje-hombros',
    nombre: 'Pasaje de hombros con toalla',
    zona: 'Hombro',
    dosis: { series: 1, cantidad: 8 },
    medida: 'repeticiones',
    porLado: false,
    cuando: ['espalda', 'hombros', 'brazos', 'cuerpo'],
    conviene: 'Antes de tracción, vertical y fondos.',
    equipo: ['toalla'],
    tecnica:
      'Agarrá una toalla o una banda bien abierta, con los brazos estirados adelante. Pasala por arriba de la cabeza hasta atrás y volvé, sin doblar los codos. Si no pasa, abrí más las manos.',
    error: 'Doblar un codo para forzar el paso.',
  },
  {
    id: 'cadera-90-90',
    nombre: 'Cadera 90/90',
    zona: 'Cadera',
    dosis: { series: 1, cantidad: 6 },
    medida: 'repeticiones',
    porLado: false,
    cuando: ['piernas', 'gluteos'],
    conviene: 'Antes de piernas y glúteos, o aparte.',
    equipo: ['nada'],
    tecnica:
      'Sentate con las dos rodillas dobladas a noventa grados, una adelante y otra al costado. Girá las rodillas hacia el otro lado, sin usar las manos si podés. Pecho alto.',
    error: 'Redondear la espalda para llegar.',
  },
  {
    // M9. `catalogo.md` lo pone después de piernas; la tabla de §6.4 lo suma a
    // la movilidad de core y de glúteos.
    id: 'flexor-cadera-arrodillado',
    nombre: 'Flexor de cadera arrodillado',
    zona: 'Frente de la cadera',
    dosis: { series: 2, cantidad: 30 },
    medida: 'segundos',
    porLado: true,
    cuando: ['core', 'piernas', 'gluteos'],
    despues: true,
    conviene: 'Después de piernas, o aparte.',
    equipo: ['nada'],
    tecnica:
      'Arrodillate con un pie adelante, como en una zancada baja. Apretá el glúteo de la pierna de atrás y llevá la cadera apenas adelante. Tenés que sentirlo adelante del muslo, sin arquear la espalda.',
    error: 'Arquear la espalda baja en vez de apretar el glúteo.',
  },
  {
    // M10. La tabla de §6.4 lo suma a la movilidad de brazos, que lleva fondos.
    id: 'pectoral-marco',
    nombre: 'Pectoral en el marco de la puerta',
    zona: 'Pecho y hombro adelante',
    dosis: { series: 2, cantidad: 30 },
    medida: 'segundos',
    porLado: true,
    cuando: ['pecho', 'brazos'],
    despues: true,
    conviene: 'Después de pecho, o aparte.',
    equipo: ['marco'],
    tecnica:
      'Apoyá el antebrazo en el marco con el codo a la altura del hombro. Girá el cuerpo hacia el otro lado hasta sentir el estiramiento en el pecho. Sin dolor en el hombro.',
    error: 'Subir el codo por encima del hombro y forzar.',
  },
  {
    // M11. "Al empezar o al terminar": va con las ocho zonas, y no lleva
    // `despues` porque también sirve al empezar.
    id: 'perro-cobra',
    nombre: 'Perro boca abajo a cobra',
    zona: 'Parte de atrás de las piernas, hombros y columna',
    dosis: { series: 1, cantidad: 6 },
    medida: 'repeticiones',
    porLado: false,
    cuando: ['pecho', 'espalda', 'hombros', 'brazos', 'core', 'piernas', 'gluteos', 'cuerpo'],
    conviene: 'Al empezar o al terminar.',
    equipo: ['nada'],
    tecnica:
      'Desde la V invertida, llevá la cadera abajo y el pecho adelante hasta quedar con los brazos estirados y la cadera cerca del piso. Volvé a la V empujando el piso. Lento y sin dolor en la espalda baja.',
    error: 'Hundir los hombros hacia las orejas en la cobra.',
  },
  {
    // M12. Después de bisagra, que es piernas y glúteos. Es la única ficha que
    // la tabla de §6.4 no pone en ninguna zona: se llega desde el catálogo y
    // desde el Final de una rutina.
    id: 'isquios-toalla',
    nombre: 'Isquiotibiales con toalla',
    zona: 'Parte de atrás del muslo',
    dosis: { series: 2, cantidad: 30 },
    medida: 'segundos',
    porLado: true,
    cuando: ['piernas', 'gluteos'],
    despues: true,
    conviene: 'Después de bisagra, o aparte.',
    equipo: ['toalla'],
    tecnica:
      'Acostate boca arriba con una toalla pasada por la planta de un pie. Subí la pierna estirada tirando suave de la toalla. La otra pierna queda apoyada.',
    error: 'Doblar la rodilla y tirar fuerte para subir más.',
  },
]

/**
 * La movilidad de cada zona: la tabla de §6.4, tal cual y en su orden. Unos
 * cinco minutos.
 *
 * La usan RÁPIDAS › Movilidad, el chip ancho del mapa, la sección MOVILIDAD de
 * cada Sector, la entrada de los mixes y "+ Entrada en calor" del Constructor.
 * La sesión de una zona lleva todas, también las de `despues`; la entrada en
 * calor, solo las otras (`movilidadParaEntrada`).
 *
 * `cuerpo` es la fila "Todo el cuerpo": es la entrada del mix de Cuerpo
 * completo y la sesión de `?movilidad=todo` (`movilidadDe('todo')`).
 */
export const MOVILIDAD_POR_SECTOR: Readonly<Record<Sector, readonly string[]>> = {
  pecho: ['munecas-cuatro-patas', 'pectoral-marco', 'perro-cobra'],
  espalda: ['gato-vaca', 'libro-abierto', 'pasaje-hombros'],
  hombros: ['munecas-cuatro-patas', 'pasaje-hombros', 'libro-abierto'],
  brazos: ['munecas-cuatro-patas', 'pasaje-hombros', 'pectoral-marco'],
  core: ['gato-vaca', 'perro-cobra', 'flexor-cadera-arrodillado'],
  piernas: ['rodilla-pared', 'sentadilla-profunda-sostenida', 'zancada-rotacion'],
  gluteos: ['cadera-90-90', 'zancada-rotacion', 'flexor-cadera-arrodillado'],
  cuerpo: ['gato-vaca', 'zancada-rotacion', 'pasaje-hombros', 'perro-cobra'],
}

export const MOVILIDAD_POR_ID: ReadonlyMap<string, FichaMovilidad> = new Map(
  MOVILIDAD.map((f) => [f.id, f]),
)

export function buscarMovilidad(id: string): FichaMovilidad | undefined {
  return MOVILIDAD_POR_ID.get(id)
}

/**
 * Si un id es de una ficha de movilidad y no de un ejercicio de fuerza.
 *
 * Los dos viven en el mismo lugar —`PasoDeRutina.ejercicioId`, el catálogo—
 * y el test garantiza que no se pisan, así que alcanza con mirar acá.
 */
export function esFichaDeMovilidad(id: string): boolean {
  return MOVILIDAD_POR_ID.has(id)
}

/**
 * Las fichas de la fila de una zona, en su orden.
 *
 * Una zona que no está (un texto que llegó de una URL o de una copia vieja
 * sin pasar por el tipo) da una lista vacía, y un id que no está se saltea:
 * ninguna de las dos cosas rompe una pantalla.
 */
function fichasDe(sector: Sector): FichaMovilidad[] {
  // `hasOwn` y no `?? []`: "toString" también es una clave del objeto.
  const ids = Object.hasOwn(MOVILIDAD_POR_SECTOR, sector) ? MOVILIDAD_POR_SECTOR[sector] : []
  const encontradas: FichaMovilidad[] = []
  for (const id of ids) {
    const ficha = MOVILIDAD_POR_ID.get(id)
    if (ficha) encontradas.push(ficha)
  }
  return encontradas
}

/**
 * La sesión de movilidad de una zona, con todas sus fichas y en el orden de
 * la tabla.
 *
 * Acepta `'todo'` porque así lo guarda el origen de una movilidad
 * (`{ clase: 'movilidad', sector: Sector | 'todo' }`) y así llega en
 * `?movilidad=todo`; es la misma fila que `cuerpo`.
 */
export function movilidadDe(zona: Sector | 'todo'): FichaMovilidad[] {
  return fichasDe(zona === 'todo' ? 'cuerpo' : zona)
}

/**
 * La movilidad de una entrada en calor: la de esas zonas, sin las de
 * `despues`, sin repetir y en orden (las zonas como vienen, y dentro de cada
 * una, como en la tabla).
 *
 * Una lista de zonas y no una sola porque "+ Entrada en calor" del
 * Constructor suma la movilidad de todas las zonas que trabaja la rutina; un
 * mix pasa la suya sola. Las de `despues` no entran nunca, se pida lo que se
 * pida: son estiramientos para después del trabajo (§6.3).
 */
export function movilidadParaEntrada(sectores: readonly Sector[]): FichaMovilidad[] {
  const vistas = new Set<string>()
  const entrada: FichaMovilidad[] = []
  for (const sector of sectores) {
    for (const ficha of fichasDe(sector)) {
      if (ficha.despues || vistas.has(ficha.id)) continue
      vistas.add(ficha.id)
      entrada.push(ficha)
    }
  }
  return entrada
}
