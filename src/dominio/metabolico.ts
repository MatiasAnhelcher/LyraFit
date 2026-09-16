/**
 * El fuelle: el trabajo metabólico que entra en los huecos de la sesión.
 *
 * ## De dónde sale
 *
 * De una queja concreta y correcta: una sesión de fuerza pura es media hora
 * parado mirando un arco vaciarse. Con los ejercicios avanzados el descanso
 * dura ciento cincuenta o ciento ochenta segundos, y son cuatro cadenas por
 * tres series: el tiempo quieto es más que el tiempo en movimiento.
 *
 * ## La corrección que hay que hacer, y no esconder
 *
 * La intuición de "aprovechar el descanso" suele venir acompañada de una idea
 * dada vuelta: que saltar durante el descanso ayuda a recuperar. Es al revés.
 * Lo que resintetiza la fosfocreatina durante el descanso es **el descanso**, y
 * un salto de sentadilla es igual de dependiente de fosfocreatina que la serie
 * que acaba de terminar. Llenar el hueco a lo bruto no es densidad: es pagar
 * fuerza para transpirar.
 *
 * La idea igual es buena, pero en su forma investigada —lo que la literatura
 * llama *cardio-acceleration*—, que tiene dos condiciones y las dos están acá
 * adentro convertidas en aritmética:
 *
 * 1. **El piso de recuperación es intocable.** La ráfaga sale de lo que SOBRA
 *    por encima del piso, nunca de adentro del piso. Un descanso de sesenta
 *    segundos no tiene relleno; uno de ciento cincuenta tiene cuarenta y cinco
 *    de ráfaga y todavía deja ciento cinco de descanso verdadero.
 *
 *    Eso tiene una consecuencia que no hubo que programar: **cuanto más
 *    avanzado el ejercicio, más largo su descanso y más lugar para el relleno.**
 *    El principiante, que es el que menos margen de recuperación tiene, casi no
 *    recibe ráfagas. La gradualidad sale sola de la resta.
 *
 * 2. **La ráfaga no puede cargar el patrón que viene.** Saltos de sentadilla
 *    antes de una serie de sentadillas no es densidad, es sabotaje — y en esta
 *    app es peor que en cualquier otra, porque el motor de progresión lee
 *    repeticiones para decidir de nivel: leería menos repeticiones y bajaría de
 *    eslabón a alguien que no perdió fuerza, solo la gastó tres minutos antes.
 *
 * Por eso esto es dominio puro y no una opción de la pantalla de entrenar: es
 * una regla del entrenamiento, y las reglas de esta app viven donde se pueden
 * verificar con un test que corre en milisegundos.
 */

import type { Patron } from './tipos'

/** Un movimiento metabólico. No progresa, no tiene ventana y no es una cadena. */
export interface Rafaga {
  id: string
  nombre: string
  /**
   * Qué patrones carga. Es el campo que hace computable "no compite": si el
   * patrón que viene está acá adentro, esta ráfaga no puede ir en ese descanso.
   */
  carga: Patron[]
  /**
   * Qué hace falta para poder hacerla. Sin esto, la lista que se le ofrece a
   * alguien en un departamento con vecinos abajo incluiría burpees.
   */
  requiere?: 'escalon' | 'salto'
  /** Cuán duro pega. 1 se puede hacer hablando, 3 no. */
  intensidad: 1 | 2 | 3
  /** Qué es y a qué ritmo, en una línea. Es lo que se lee durante la ráfaga. */
  gesto: string
}

/**
 * Las ráfagas.
 *
 * Ocho, y ninguna necesita comprar nada: el equipamiento máximo es un escalón,
 * un cajón o una silla firme. Están repartidas a propósito entre las cuatro
 * cargas posibles, porque la regla de "no compite" deja sin candidatas a
 * cualquier patrón que no tenga alternativas — y un descanso sin ráfaga
 * disponible no es un error visible, es una función que calladamente no hace
 * nada. Hay un test que comprueba que cada patrón tenga siempre al menos una,
 * con cada combinación de equipo.
 *
 * Ninguna carga tracción a propósito, y no es un olvido: colgarse de algo es lo
 * único que no se puede hacer a media intensidad sin agarre, y el agarre es
 * justamente lo que limita la serie de dominadas que viene después.
 */
export const RAFAGAS: Rafaga[] = [
  {
    id: 'marcha-alta',
    nombre: 'Marcha alta en el lugar',
    carga: ['piernas'],
    intensidad: 1,
    gesto: 'Caminá en el lugar levantando la rodilla hasta la cadera, sin despegar del piso.',
  },
  {
    id: 'sombra',
    nombre: 'Boxeo de sombra',
    carga: ['empuje', 'core'],
    intensidad: 1,
    gesto: 'Golpes rectos alternados, rotando el tronco, con los pies livianos.',
  },
  {
    id: 'escalador',
    nombre: 'Escalador',
    carga: ['core', 'empuje'],
    intensidad: 2,
    gesto: 'En posición de plancha, llevá una rodilla al pecho y cambiá, sin subir la cadera.',
  },
  {
    id: 'paso-al-cajon',
    nombre: 'Subidas al cajón',
    carga: ['piernas'],
    requiere: 'escalon',
    intensidad: 2,
    gesto: 'Subí y bajá del escalón alternando la pierna que empuja, sin saltar.',
  },
  {
    id: 'rodillas-al-pecho',
    nombre: 'Rodillas al pecho',
    carga: ['core', 'piernas'],
    requiere: 'salto',
    intensidad: 2,
    gesto: 'Trote en el lugar llevando las rodillas alto y rápido.',
  },
  {
    id: 'salto-tijera',
    nombre: 'Saltos de tijera',
    carga: ['piernas'],
    requiere: 'salto',
    intensidad: 2,
    gesto: 'Abrí piernas y brazos al mismo tiempo y volvé, a ritmo parejo.',
  },
  {
    id: 'salto-sentadilla',
    nombre: 'Saltos de sentadilla',
    carga: ['piernas'],
    requiere: 'salto',
    intensidad: 3,
    gesto: 'Bajá a media sentadilla y saltá; caé blando y encadená.',
  },
  {
    id: 'burpee',
    nombre: 'Burpees',
    carga: ['empuje', 'piernas', 'core'],
    requiere: 'salto',
    intensidad: 3,
    gesto: 'Al piso, plancha, arriba y salto. Es la más dura de todas: administrala.',
  },
]

export const RAFAGA_POR_ID = new Map(RAFAGAS.map((r) => [r.id, r]))

/**
 * Los segundos de descanso que no se tocan nunca.
 *
 * Un minuto no alcanza para resintetizar toda la fosfocreatina —hacen falta
 * dos o tres para estar cerca del ciento por ciento— pero sí es el punto donde
 * la curva ya subió la mayor parte. Por debajo de eso, meter movimiento no es
 * densidad: es recortarle la serie siguiente.
 */
export const PISO_DE_RECUPERACION = 60

/** Lo más larga que puede ser una ráfaga, por dura que sea la sesión. */
export const TOPE_DE_RAFAGA = 45

/** Y lo más corta. Menos que esto no alcanza ni para entrar en ritmo. */
export const MINIMO_DE_RAFAGA = 20

/** El tope cuando la densidad está en suave: la mitad del tiempo y sin intensidad 3. */
export const TOPE_SUAVE = 30

/** Cuánto aprieta el fuelle. Apagada deja la sesión exactamente como estaba. */
export type Densidad = 'apagada' | 'suave' | 'fuerte'

/** Lo que hay donde entrena. Los dos vienen de Preferencias. */
export interface Equipo {
  puedeSaltar?: boolean
  tieneEscalon?: boolean
}

/**
 * Cuántos segundos de ráfaga entran en un descanso de esta duración.
 *
 * Es una resta y no una fracción a propósito. Con una fracción —"el treinta por
 * ciento del descanso"— un descanso corto igual perdería tiempo de
 * recuperación, que es exactamente lo que no puede pasar. Con la resta, el
 * descanso corto simplemente no tiene lugar y devuelve cero.
 */
export function segundosDeRafaga(descansoSegundos: number, densidad: Densidad): number {
  if (densidad === 'apagada') return 0
  const sobra = descansoSegundos - PISO_DE_RECUPERACION
  if (sobra < MINIMO_DE_RAFAGA) return 0
  return Math.min(sobra, densidad === 'suave' ? TOPE_SUAVE : TOPE_DE_RAFAGA)
}

/** Las ráfagas que esta persona puede hacer donde entrena, a esta densidad. */
export function rafagasDisponibles(equipo: Equipo, densidad: Densidad): Rafaga[] {
  if (densidad === 'apagada') return []
  return RAFAGAS.filter((rafaga) => {
    if (rafaga.requiere === 'salto' && !equipo.puedeSaltar) return false
    if (rafaga.requiere === 'escalon' && !equipo.tieneEscalon) return false
    if (densidad === 'suave' && rafaga.intensidad === 3) return false
    return true
  })
}

/**
 * Qué ráfaga va en este descanso, y por cuánto tiempo.
 *
 * Devuelve `null` cuando no entra ninguna, que es un resultado legítimo y
 * frecuente: descanso corto, densidad apagada, o todas las candidatas cargan el
 * patrón que viene. La pantalla tiene que saber mostrar un descanso pelado.
 *
 * `indice` es cuántas ráfagas van hechas en la sesión, y solo sirve para rotar:
 * tres descansos seguidos con el mismo movimiento se leen una vez y después son
 * mobiliario, igual que pasaba con la indicación de técnica.
 */
export function rafagaDelDescanso(entrada: {
  descansoSegundos: number
  /** El patrón de la serie que viene DESPUÉS de este descanso. */
  patronQueViene: Patron
  equipo: Equipo
  densidad: Densidad
  indice: number
}): { rafaga: Rafaga; segundos: number } | null {
  const segundos = segundosDeRafaga(entrada.descansoSegundos, entrada.densidad)
  if (segundos === 0) return null

  const candidatas = rafagasDisponibles(entrada.equipo, entrada.densidad).filter(
    (rafaga) => !rafaga.carga.includes(entrada.patronQueViene),
  )
  if (candidatas.length === 0) return null

  const elegida = candidatas[Math.abs(entrada.indice) % candidatas.length]!
  return { rafaga: elegida, segundos }
}

/**
 * El bloque de fuelle: el trabajo metabólico continuo, después de la fuerza.
 *
 * Va DESPUÉS de las series y ANTES de la serie de cierre, y el orden no es un
 * detalle de implementación. `docs/estrategia-2026.md` §2.4 dice que "terminá
 * fuerte" está contradicho por la regla del pico y el final, y la serie de
 * cierre existe justamente para que la sesión no termine en el punto más duro.
 * Un bloque metabólico al final rompería una decisión ya tomada y escrita.
 * Puesto antes, la sesión tiene su pico de exigencia **y** termina en algo que
 * se puede sostener.
 */
export interface PasoDeFuelle {
  rafaga: Rafaga
  segundos: number
  /** El descanso que va después de esta ráfaga. Cero en la última. */
  descansoSegundos: number
}

/** Cuánto dura una vuelta del bloque, en segundos de trabajo. */
export const TRABAJO_DEL_BLOQUE = 40
export const PAUSA_DEL_BLOQUE = 20

/**
 * Cuánto dura el bloque después de la fuerza. Fijo, no calculado.
 *
 * Esto antes se dimensionaba para que la sesión llegara a la duración que la
 * persona hubiera pedido, y ese era el error de fondo: la app terminaba
 * optimizando "que la sesión dure una hora" en vez de "que la sesión sirva".
 * Con veintiún minutos de fuerza —alguien en los primeros eslabones— el bloque
 * daba veintiún minutos: un minuto de metabólico por cada minuto de fuerza,
 * justo para quien menos lo tolera.
 *
 * El efecto de interferencia escala con la DURACIÓN y la frecuencia del trabajo
 * de resistencia, no con su mera presencia (Wilson, 2012). Ocho a doce minutos
 * quedan lejos de esa dosis; treinta y cinco, no. Y la pérdida de grasa sale
 * del balance semanal, no del finisher: pagarla con recuperación cuesta fuerza,
 * que cuesta músculo, que es el tejido que sostiene el gasto de reposo.
 */
export const MINUTOS_DEL_BLOQUE: Record<Exclude<Densidad, 'apagada'>, number> = {
  suave: 8,
  fuerte: 12,
}

/**
 * Y el tope de un día de fuelle, que es una sesión entera de acondicionamiento.
 *
 * Existe porque su ausencia produjo el peor defecto que tuvo esto: el día de
 * fuelle no pasaba por ningún tope y tomaba la duración pedida menos seis. Con
 * "lo más largo que dé" —noventa minutos— armaba un bloque de **ochenta y
 * cuatro vueltas**: una hora y media de saltos y burpees encadenados. No lo
 * encontró ningún test porque todos miraban el bloque de después de la fuerza,
 * que sí tenía tope. Lo encontró alguien usando la app.
 */
export const TOPE_DEL_DIA_DE_FUELLE = 30

/**
 * Cuántos minutos de bloque van después de una sesión de fuerza.
 *
 * Dos límites, y el segundo es el que importa: **nunca más de un tercio de lo
 * que duró la fuerza.** Un finisher más largo que eso deja de ser un finisher y
 * pasa a ser una segunda sesión pegada a la primera, en el peor momento posible
 * —con el glucógeno ya bajo— y para alguien cuyo objetivo primario es fuerza.
 */
export function minutosDelBloque(minutosDeFuerza: number, densidad: Densidad): number {
  if (densidad === 'apagada') return 0
  const tope = MINUTOS_DEL_BLOQUE[densidad]
  return Math.max(4, Math.min(tope, Math.round(minutosDeFuerza / 3)))
}

/** Y cuántos dura el día de fuelle, que no tiene fuerza adelante que proteger. */
export function minutosDelDiaDeFuelle(densidad: Densidad): number {
  if (densidad === 'apagada') return 0
  return densidad === 'suave' ? 20 : TOPE_DEL_DIA_DE_FUELLE
}

/**
 * Arma el bloque a partir de los minutos que se le quieran dar.
 *
 * Alterna las ráfagas disponibles en orden para que dos seguidas no carguen lo
 * mismo cuando se puede evitar, y corta cuando se acabó el tiempo. Acá no
 * existe la regla de "no compite": el bloque es lo último que se hace con el
 * cuerpo fresco, no hay ninguna serie después que proteger.
 */
export function bloqueDeFuelle(
  minutos: number,
  equipo: Equipo,
  densidad: Densidad,
): PasoDeFuelle[] {
  const disponibles = rafagasDisponibles(equipo, densidad)
  if (disponibles.length === 0 || minutos <= 0) return []

  const trabajo = densidad === 'suave' ? TOPE_SUAVE : TRABAJO_DEL_BLOQUE
  const ciclo = trabajo + PAUSA_DEL_BLOQUE
  // El tope va ACÁ adentro y no solo en quien llama, porque el defecto de las
  // ochenta y cuatro vueltas fue exactamente eso: un camino que no pasaba por
  // el tope de afuera. Una función que puede devolver una hora y media de
  // burpees tiene que negarse sola.
  const pedidos = Math.min(minutos, TOPE_DEL_DIA_DE_FUELLE)
  const vueltas = Math.max(1, Math.floor((pedidos * 60) / ciclo))

  // De más dura a más liviana no: al revés. El bloque arranca con lo que se
  // puede sostener y deja lo más duro para cuando ya entraste en calor, que es
  // el mismo criterio con el que el core va último en la rutina.
  const orden = [...disponibles].sort((a, b) => a.intensidad - b.intensidad)

  return Array.from({ length: vueltas }, (_, i) => ({
    rafaga: orden[i % orden.length]!,
    segundos: trabajo,
    descansoSegundos: i === vueltas - 1 ? 0 : PAUSA_DEL_BLOQUE,
  }))
}
