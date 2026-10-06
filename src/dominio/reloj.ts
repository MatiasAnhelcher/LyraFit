/**
 * El reloj: tabata y los otros intervalos.
 *
 * ## Qué es un tabata, de verdad
 *
 * Veinte segundos de trabajo, diez de pausa, ocho vueltas. Cuatro minutos
 * exactos. Es el protocolo de Tabata (1996) y la palabra significa eso y nada
 * más — no "cualquier cosa con intervalos", que es como la usa medio rubro.
 * El original se midió a una intensidad del orden del 170% del VO₂máx, o sea
 * **a fondo**: un tabata que se puede sostener cómodo no es un tabata, es una
 * serie larga con pausas.
 *
 * Los otros tres formatos existen porque la gente los usa y son útiles, no
 * porque sean tabatas. Están nombrados por lo que son.
 *
 * ## El puntaje es la PEOR vuelta
 *
 * No el total y no el promedio. Un total premia salir a lo loco y apagarse en
 * la quinta; la peor vuelta premia sostener, que es exactamente lo que el
 * protocolo mide. Es además lo único comparable entre dos sesiones del mismo
 * ejercicio: el total depende de cuántas vueltas aguantaste contando.
 *
 * Es la misma idea que ya usa el resto de la app —la serie peor pesa un cuarto
 * en `rendimientoDeSesion`— llevada al extremo que le corresponde acá.
 *
 * Y con rotación el puntaje es **uno por ejercicio**: el mínimo entre flexiones
 * y sentadillas no es un puntaje, es la noticia de que las flexiones son más
 * duras. Está en `peorPorEjercicio`.
 *
 * ## Por qué esto no le habla al motor
 *
 * Un tabata es trabajo cerca del fallo con recuperación incompleta. Leer eso
 * como capacidad haría bajar de eslabón por series que nadie pidió, que es
 * exactamente la razón por la que existe `TipoSesion: 'fuelle'`. La sesión se
 * guarda con `tipo: 'reloj'` y `mueveElPlan` ya la deja afuera sin que haya que
 * escribir ninguna regla nueva.
 *
 * Eso alcanzaba para el motor y NO alcanzaba para el resto: el registro lleva
 * el id del ejercicio de verdad, así que cuatro lectores más lo habrían leído
 * como una serie. Los cuatro saltean `registro.reloj` ahora, y cada uno tiene
 * su test: `laVezPasada` —que es la vara al lado de cada casillero—,
 * `historicoDeEjercicio`, `recordDe` y `esRecord`, y la línea de base de
 * `hechos`. Lo que sí cuenta es el volumen: ocho vueltas son ocho series.
 */

import type { RegistroEjercicio } from './tipos'

/**
 * Lo que se puede poner en un reloj: un ejercicio de la biblioteca o una ráfaga.
 *
 * Las ráfagas van con el id prefijado porque son dos catálogos distintos, y
 * mezclar los ids sin marca sería pedirle a la pantalla que adivine de dónde
 * sacar el nombre.
 */
export interface Opcion {
  id: string
  nombre: string
  /** El id del ejercicio de la biblioteca, si lo es. Las ráfagas no tienen. */
  ejercicioId?: string
  grupo: 'tuyos' | 'cardio'
  /**
   * Si se mide en segundos y no en repeticiones.
   *
   * Cambia la pregunta de la pausa: a alguien que acaba de hacer una plancha no
   * se le pregunta cuántas hizo. Hizo una, y lo que importa es cuánto aguantó.
   */
  enSegundos: boolean
  /** Lo que se lee mientras se hace, en las ráfagas, que no tienen dibujo. */
  gesto?: string
  /**
   * Lo que va en la columna de la derecha de la fila: la cadena, o "cardio".
   *
   * Con la lista corta es un dato de más; con los cuarenta y siete abiertos es
   * lo que la vuelve una lista y no una pared de nombres, y no cuesta ni un
   * píxel de alto porque esa columna ya estaba ahí.
   */
  etiqueta: string
}

/** Un formato de intervalos: cuánto se trabaja, cuánto se afloja, cuántas veces. */
export interface Formato {
  id: string
  nombre: string
  /** Segundos de trabajo por vuelta. */
  trabajo: number
  /** Segundos de pausa después de cada vuelta. Cero en el EMOM. */
  pausa: number
  vueltas: number
  /** Qué es y para qué sirve, en una línea. */
  nota: string
}

/**
 * Los diez segundos de preparación del principio.
 *
 * No es un adorno: sin eso la primera vuelta arranca con el teléfono todavía en
 * la mano y se pierden tres o cuatro segundos de las veinte, que en un tabata
 * es el 20% de la vuelta. Es el defecto que tiene la mitad de los relojes del
 * rubro.
 */
export const PREPARACION = 10

export const FORMATOS: Formato[] = [
  {
    id: 'tabata',
    nombre: 'Tabata',
    trabajo: 20,
    pausa: 10,
    vueltas: 8,
    nota: 'El de verdad: veinte a fondo, diez de pausa, ocho vueltas. Cuatro minutos y no se puede hablar en el cuarto.',
  },
  {
    id: 'largo',
    nombre: '40 y 20',
    trabajo: 40,
    pausa: 20,
    vueltas: 8,
    nota: 'Vueltas largas, ocho minutos. Entra más trabajo por vuelta y se sostiene mejor con ejercicios de cuerpo entero.',
  },
  {
    id: 'parejo',
    nombre: '30 y 30',
    trabajo: 30,
    pausa: 30,
    vueltas: 10,
    nota: 'Mitad y mitad, diez minutos. Es el que admite ejercicios pesados —dominadas, pistols— sin que la técnica se caiga.',
  },
  {
    id: 'emom',
    nombre: 'EMOM',
    trabajo: 60,
    pausa: 0,
    vueltas: 10,
    nota: 'Una vuelta por minuto: hacés las repeticiones y lo que sobra del minuto es la pausa. Cuanto más rápido, más descansás.',
  },
]

export const FORMATO_POR_ID = new Map(FORMATOS.map((f) => [f.id, f]))

export const FORMATO_POR_DEFECTO = 'tabata'

/** Cuántos ejercicios se pueden poner a rotar. Más que esto no se recuerda. */
export const TOPE_DE_EJERCICIOS = 4

/** Un tramo del reloj: lo que suena, lo que se muestra y cuánto dura. */
export type Tramo =
  | { clase: 'preparacion'; segundos: number }
  | { clase: 'trabajo'; segundos: number; ejercicioId: string; vuelta: number }
  | { clase: 'pausa'; segundos: number; vuelta: number }

/**
 * El plan entero, tramo por tramo.
 *
 * Los ejercicios **rotan por vuelta**: con dos y ocho vueltas da A B A B A B A B.
 * Rotar y no agrupar es deliberado — cuatro vueltas seguidas de flexiones y
 * después cuatro de sentadillas son dos tabatas cortos pegados, y el sentido de
 * alternar es que el músculo que descansa sea otro.
 *
 * La última vuelta no lleva pausa: la pausa está para la vuelta siguiente, y
 * después de la última no hay ninguna. Un reloj que te hace esperar diez
 * segundos al final para decirte que terminaste es un reloj que no entendió
 * para qué sirve la pausa.
 */
export function planDelReloj(formato: Formato, ejercicios: string[]): Tramo[] {
  if (ejercicios.length === 0 || formato.vueltas < 1) return []

  const tramos: Tramo[] = [{ clase: 'preparacion', segundos: PREPARACION }]

  for (let vuelta = 0; vuelta < formato.vueltas; vuelta++) {
    tramos.push({
      clase: 'trabajo',
      segundos: formato.trabajo,
      ejercicioId: ejercicios[vuelta % ejercicios.length]!,
      vuelta,
    })
    const ultima = vuelta === formato.vueltas - 1
    if (formato.pausa > 0 && !ultima) {
      tramos.push({ clase: 'pausa', segundos: formato.pausa, vuelta })
    }
  }

  return tramos
}

/** Cuánto dura todo, en segundos. Para poder decirlo antes de empezar. */
export function duracionDelReloj(formato: Formato, ejercicios: string[]): number {
  return planDelReloj(formato, ejercicios).reduce((total, t) => total + t.segundos, 0)
}

/**
 * El puntaje: la vuelta más floja.
 *
 * `null` quiere decir "esa vuelta no la conté", y se ignora — no es un cero.
 * Si no se contó ninguna, el puntaje es `null` y la pantalla lo dice así: decir
 * cero sería afirmar que no hiciste nada.
 */
export function peorVuelta(logros: readonly (number | null)[]): number | null {
  const contadas = logros.filter((n): n is number => n !== null)
  if (contadas.length === 0) return null
  return Math.min(...contadas)
}

/** Cuántas vueltas quedaron sin contar. La pantalla lo dice si no fueron todas. */
export function vueltasSinContar(logros: readonly (number | null)[]): number {
  return logros.filter((n) => n === null).length
}

/**
 * Lo que la voz canta en cada tramo.
 *
 * Es el canal que de verdad resuelve un tabata: con el pulso a ciento ochenta y
 * las manos en el piso no se mira la pantalla. Por eso dice el NOMBRE del
 * ejercicio y no "ya": el cambio de ejercicio es lo único que no se puede
 * adivinar, y en una rotación pasa cada vuelta.
 *
 * Corto a propósito. Una frase de dos segundos tapa el primer segundo de
 * trabajo, que en una vuelta de veinte es plata.
 */
export function dichoDelTramo(
  tramo: Tramo,
  nombreDelEjercicio: string,
  vueltas: number,
  /**
   * El ejercicio que viene, para cantarlo en la pausa. Se pasa **solo cuando es
   * otro**: en un tabata de un solo ejercicio, anunciarlo en cada una de las
   * siete pausas sería gastar el único canal que queda cuando no se puede
   * mirar la pantalla. El énfasis se gasta.
   */
  nombreQueViene?: string,
): string {
  const nombre = nombreDelEjercicio.trim()
  switch (tramo.clase) {
    case 'preparacion':
      return nombre ? `Preparate. ${nombre}.` : 'Preparate.'
    case 'trabajo':
      if (tramo.vuelta === vueltas - 1) return nombre ? `Última. ${nombre}.` : 'Última.'
      return nombre ? `${nombre}. Ya.` : 'Ya.'
    case 'pausa':
      return nombreQueViene?.trim() ? `Aflojá. Viene ${nombreQueViene.trim()}.` : 'Aflojá.'
  }
}

/** El rótulo del tramo, en pantalla. */
export function rotuloDelTramo(tramo: Tramo): string {
  switch (tramo.clase) {
    case 'preparacion':
      return 'PREPARATE'
    case 'trabajo':
      return 'AHORA'
    case 'pausa':
      return 'AFLOJÁ'
  }
}

/**
 * El puntaje de un ejercicio: su peor vuelta, y cuántas quedaron sin contar.
 */
export interface PuntajeDeEjercicio {
  ejercicioId: string
  /** La peor vuelta de ESE ejercicio. `null` si no se contó ninguna. */
  peor: number | null
  /** Cuántas vueltas le tocaron. */
  vueltas: number
  sinContar: number
}

/**
 * El puntaje, separado por ejercicio.
 *
 * **Un solo número para una rotación sería una cuenta sin sentido.** La peor
 * vuelta es el puntaje de Tabata porque compara vueltas comparables: ocho
 * vueltas del mismo ejercicio. Si en una rotación de flexiones y sentadillas se
 * tomara el mínimo de las ocho, el resultado sería "nueve", y nueve no es un
 * puntaje: es la noticia de que las flexiones son más duras que las sentadillas,
 * que ya se sabía. Peor con un sostén de por medio, donde el mínimo compararía
 * repeticiones con segundos.
 *
 * Así que con un ejercicio hay un número —el clásico— y con varios hay uno por
 * cada uno. El orden es el de la primera vuelta de cada uno, que es el orden en
 * que se eligieron.
 */
export function peorPorEjercicio(
  plan: readonly Tramo[],
  logros: readonly (number | null)[],
): PuntajeDeEjercicio[] {
  const porEjercicio = new Map<string, (number | null)[]>()
  for (const tramo of plan) {
    if (tramo.clase !== 'trabajo') continue
    const previas = porEjercicio.get(tramo.ejercicioId) ?? []
    previas.push(logros[tramo.vuelta] ?? null)
    porEjercicio.set(tramo.ejercicioId, previas)
  }
  return [...porEjercicio.entries()].map(([ejercicioId, suyas]) => ({
    ejercicioId,
    peor: peorVuelta(suyas),
    vueltas: suyas.length,
    sinContar: vueltasSinContar(suyas),
  }))
}

/**
 * La vuelta anterior DEL MISMO EJERCICIO, para precargar la cuenta.
 *
 * Que sea del mismo ejercicio no es un detalle: en una rotación de flexiones y
 * sentadillas, la vuelta anterior a secas es la del otro ejercicio, y precargar
 * veinte sentadillas en el casillero de las flexiones es ofrecerle un número
 * equivocado a alguien que lo va a aceptar con el pulso a ciento ochenta.
 */
export function anteriorDelMismo(
  plan: readonly Tramo[],
  logros: readonly (number | null)[],
  vuelta: number,
): number | undefined {
  const actual = plan.find((t) => t.clase === 'trabajo' && t.vuelta === vuelta)
  if (!actual || actual.clase !== 'trabajo') return undefined
  for (const tramo of [...plan].reverse()) {
    if (tramo.clase !== 'trabajo') continue
    if (tramo.vuelta >= vuelta) continue
    if (tramo.ejercicioId !== actual.ejercicioId) continue
    const logro = logros[tramo.vuelta]
    if (logro !== null && logro !== undefined) return logro
  }
  return undefined
}

/**
 * Dónde se cuentan las repeticiones de una vuelta.
 *
 * En los formatos con pausa, en la pausa. En el EMOM no hay pausa —lo que sobra
 * del minuto es la pausa— así que la cuenta va en la vuelta misma, o no habría
 * ningún momento para anotarla y el formato entero quedaría sin puntaje.
 */
export function cuentaEnLaVuelta(formato: Formato): boolean {
  return formato.pausa === 0
}

/**
 * Cuántos segundos antes del final de la vuelta aparece la cuenta, cuando va
 * adentro de la vuelta.
 *
 * Diez, y por dos razones. La primera es que nadie quiere un `+` y un `−`
 * adelante mientras hace burpees: la cuenta es para el final, cuando ya sabés
 * cuántas hiciste. La segunda es de píxeles —con el dibujo arriba y la cuenta
 * abajo al mismo tiempo, la pantalla no entra en un 320×568— y la salida es la
 * misma: mientras la cuenta está, el dibujo no hace falta.
 */
export const CUENTA_AL_FINAL = 10

/**
 * La última vuelta no tiene pausa, así que no hay dónde contarla: se cuenta al
 * final. Es justo la vuelta que más importa —la más dura, la que suele ser el
 * puntaje— y sin esto quedaba siempre sin contar.
 */
export function vueltaSinPausa(formato: Formato): number | null {
  if (cuentaEnLaVuelta(formato)) return null
  return formato.vueltas - 1
}

/**
 * Lo que queda guardado de un reloj, un registro por ejercicio.
 *
 * ## Las vueltas sin contar van como cero, y hay que decir por qué
 *
 * Una vuelta que no contaste es trabajo que pasó con un número desconocido, y
 * `Serie.logrado` es un número: no hay forma de escribir "no sé cuántas". Van
 * como cero, y eso es seguro porque **todo lector que podría malinterpretarlo
 * saltea los registros del reloj**: la curva de fuerza, la vez pasada, el
 * histórico del ejercicio y los récords. Lo que sí queda corto es el total de
 * repeticiones de esa sesión, y no hay manera de que no quede corto: el número
 * no existe.
 *
 * Lo que el cero sí conserva es el VOLUMEN, que es lo que de verdad se usa: el
 * mapa muscular cuenta `series.length`, y ocho vueltas son ocho series hayas
 * contado o no.
 *
 * Si de un ejercicio no contaste ninguna vuelta, `cerrarSesion` descarta ese
 * registro entero —no hay nada que anotar— y la pantalla del final lo dice en
 * vez de inventar un puntaje.
 *
 * ## Las ráfagas no entran
 *
 * No son ejercicios de la biblioteca: no tienen patrón ni cadena, y meterlas
 * entre los registros sería el error que `Sesion` evita a propósito guardando
 * las ráfagas aparte.
 */
export function registrosDelReloj(
  plan: readonly Tramo[],
  logros: readonly (number | null)[],
  opciones: readonly Opcion[],
): RegistroEjercicio[] {
  const porEjercicio = new Map<string, number[]>()

  for (const tramo of plan) {
    if (tramo.clase !== 'trabajo') continue
    const opcion = opciones.find((o) => o.id === tramo.ejercicioId)
    if (!opcion?.ejercicioId) continue
    const hechas = porEjercicio.get(opcion.ejercicioId) ?? []
    hechas.push(logros[tramo.vuelta] ?? 0)
    porEjercicio.set(opcion.ejercicioId, hechas)
  }

  return [...porEjercicio.entries()].map(([ejercicioId, hechas]) => ({
    ejercicioId,
    // No había objetivo: un tabata no propone un número, propone un tiempo. Se
    // guarda lo logrado como si hubiera sido el objetivo para que el
    // rendimiento dé exactamente 1 y no quede un cero flotando que algún
    // lector futuro lea como un fracaso. Decidir no mueve nada igual: la
    // sesión es `tipo: 'reloj'` y el motor la toma como neutra.
    objetivo: { series: hechas.length, cantidad: Math.max(...hechas, 0) },
    series: hechas.map((logrado) => ({ logrado })),
    reloj: true as const,
  }))
}
