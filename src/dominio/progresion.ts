/**
 * El motor de progresión.
 *
 * Es el corazón de la app y la única parte que decide qué entrenás mañana.
 * Todo acá adentro son funciones puras: reciben datos, devuelven datos, no
 * tocan la base ni la pantalla.
 *
 * La idea del método es vieja y probada, y es la misma a la que llegan todos
 * los sistemas serios de calistenia: **doble progresión**. Se suben
 * repeticiones dentro de una ventana acotada y, recién cuando se llega al
 * techo de esa ventana, se pasa al eslabón siguiente de la cadena — que es la
 * única variable que de verdad equivale a ponerle más peso a la barra.
 *
 * Tres decisiones de diseño que valen la pena explicar, porque parecen
 * detalles y son las que hacen que el motor funcione:
 *
 * 1. **La memoria es suave, no son contadores.** Antes había dos rachas que se
 *    reiniciaban una a la otra, y eso tenía un agujero: una sesión que no era
 *    ni éxito ni fallo las borraba las dos, así que quien quedaba siempre un
 *    poco corto no subía ni bajaba nunca. Una media móvil exponencial siempre
 *    se mueve, así que el motor no se puede trabar.
 *
 * 2. **Quedarse quieto tiene fecha de vencimiento.** Si pasan varias sesiones
 *    con el mismo objetivo, el motor fuerza un cambio. Puede subir, puede
 *    bajar, pero no puede no hacer nada: repetir la misma frase treinta veces
 *    es la forma más rápida de que alguien deje de abrir la app.
 *
 * 3. **Cambiar de eslabón se calcula, no se inventa.** Cada ejercicio sabe qué
 *    fracción del peso del cuerpo mueve, así que cuánto bajar al subir de
 *    nivel sale de una cuenta y no de un número escrito a mano.
 */

import type {
  Avance,
  Cadena,
  Ejercicio,
  Medida,
  Objetivo,
  Serie,
} from './tipos'

// ─── Las constantes del motor ────────────────────────────────────────────
// Están todas acá arriba y son públicas a propósito: la app le muestra sus
// reglas a la persona, y no se puede mostrar lo que está escondido.

/** Por encima de esta señal, el objetivo sube. */
export const SUBE = 0.95

/** Por debajo de esta señal, el objetivo baja. */
export const BAJA = 0.75

/**
 * Cuánto pesa la última sesión sobre la señal. Con 0,5 la memoria efectiva es
 * de unas dos sesiones: la misma inercia de antes, sin los reinicios.
 */
export const SUAVIZADO = 0.5

/** Sesiones seguidas con el mismo objetivo antes de forzar un cambio. */
export const MESETA = 4

/** Sesiones de gracia después de cambiar de eslabón, para no rebotar. */
export const GRACIA = 3

/**
 * Sesiones sosteniendo el techo de la ventana antes de cambiar de eslabón.
 *
 * Es la diferencia entre tocar un techo y dominarlo. Con una sola sesión, un
 * buen día alcanza para mandar a alguien a una palanca que no puede sostener —
 * que es justamente cómo se llegaba antes a la flexión a una mano en cinco
 * semanas.
 */
export const CONSOLIDACION = 2

/**
 * Tope de validez de la fórmula de Brzycki. Más allá de doce repeticiones la
 * relación entre repeticiones y porcentaje del máximo se rompe, así que se
 * satura en vez de devolver un número inventado.
 */
const TOPE_BRZYCKI = 12

/** Segundos de referencia para los isométricos, el equivalente del tope de arriba. */
const REFERENCIA_ISOMETRICA = 12

// ─── Cuánto sube el objetivo ─────────────────────────────────────────────

/**
 * El incremento es proporcional, no fijo.
 *
 * Sumar una repetición sobre cinco es subir un veinte por ciento; sumarla
 * sobre veinte es subir un cinco. Un paso fijo hace que la progresión sea
 * brutal al principio de cada eslabón y despreciable al final.
 */
export function incremento(medida: Medida, cantidad: number): number {
  const proporcion = medida === 'segundos' ? 0.15 : 0.1
  const minimo = medida === 'segundos' ? 3 : 1
  return Math.max(minimo, Math.round(cantidad * proporcion))
}

/**
 * Cómo se nombra una cantidad según su unidad. "Subimos a 25 por serie" no
 * dice lo mismo en una plancha que en una flexión: en una es tiempo y en la
 * otra son repeticiones, y el texto tiene que decir cuál.
 */
export function conUnidad(medida: Medida, cantidad: number): string {
  return medida === 'segundos' ? `${cantidad} segundos` : `${cantidad}`
}

// ─── Cómo salió la sesión ────────────────────────────────────────────────

/**
 * El rendimiento de una sesión, como número continuo alrededor de 1.
 *
 * Antes esto era una clasificación en tres cajones y el del medio no tenía
 * salida. Ahora es una medida: 1 es cumplir el objetivo, más es superarlo,
 * menos es quedarse corto, y todo lo intermedio existe.
 *
 * El volumen total pesa tres cuartos y la peor serie un cuarto. Ese cuarto
 * conserva la intuición correcta —tres series de diez y una de dos no es un
 * objetivo cumplido— sin darle el mando al estimador más ruidoso, que además,
 * por la fatiga que se acumula dentro de la sesión, termina midiendo aguante y
 * no capacidad.
 *
 * Se topea en 1,25 para que una sesión extraordinaria no tape dos malas.
 */
export function rendimientoDeSesion(objetivo: Objetivo, series: Serie[]): number {
  const propuesto = objetivo.series * objetivo.cantidad
  if (propuesto <= 0 || objetivo.cantidad <= 0) return 0

  const logrados = series.map((s) => Math.max(0, s.logrado))
  const volumen = logrados.reduce((suma, n) => suma + n, 0)

  // Las series que faltaron cuentan como cero, así que abandonar a la mitad
  // queda penalizado sin necesidad de una regla aparte.
  const faltantes = objetivo.series - logrados.length
  const peor = faltantes > 0 ? 0 : Math.min(...logrados, Infinity)
  const peorFinal = Number.isFinite(peor) ? peor : 0

  return (
    0.75 * Math.min(volumen / propuesto, 1.25) +
    0.25 * Math.min(peorFinal / objetivo.cantidad, 1.25)
  )
}

/** La cantidad típica que se logró, para saber a qué bajar cuando hay meseta. */
export function logradoTipico(series: Serie[]): number {
  const logrados = series.map((s) => Math.max(0, s.logrado)).sort((a, b) => a - b)
  if (logrados.length === 0) return 0
  const medio = Math.floor(logrados.length / 2)
  if (logrados.length % 2 === 1) return logrados[medio]!
  return Math.round(((logrados[medio - 1] ?? 0) + (logrados[medio] ?? 0)) / 2)
}

// ─── Carga relativa: lo que hace comparables dos ejercicios distintos ────

/**
 * Qué fracción del máximo representa hacer esta cantidad.
 *
 * Para repeticiones es Brzycki, saturada en doce. Para isométricos es la ley
 * de potencia del tiempo hasta el fallo, que es su equivalente: aguantar el
 * doble de tiempo implica bastante menos intensidad relativa.
 */
export function fraccionDelMaximo(medida: Medida, cantidad: number): number {
  if (medida === 'segundos') {
    const segundos = Math.max(cantidad, 3)
    return Math.min(1, Math.cbrt(REFERENCIA_ISOMETRICA / segundos))
  }
  return 1.0278 - 0.0278 * Math.min(Math.max(cantidad, 1), TOPE_BRZYCKI)
}

/**
 * El índice de carga: cuánto está levantando esta persona, en una escala
 * comparable entre ejercicios distintos.
 *
 * Tiene una propiedad que vale oro para la pantalla de progreso: al cambiar de
 * eslabón con la fórmula de recalibración de más abajo, este número queda
 * exactamente igual. O sea que la curva de progreso no se corta ni se desploma
 * justo en el momento de mayor logro, que es lo que le pasa a todo registro
 * crudo de repeticiones cuando se sube de nivel.
 *
 * Es una estimación y la app lo dice: no es una medición del cuerpo de nadie.
 */
export function indiceDeCarga(ejercicio: Ejercicio, cantidad: number): number {
  return ejercicio.ccr / fraccionDelMaximo(ejercicio.medida, cantidad)
}

/** La cantidad de este ejercicio que equivale a un índice de carga dado. */
export function cantidadParaCarga(ejercicio: Ejercicio, carga: number): number {
  if (carga <= 0) return ejercicio.ventana.min
  const fraccion = ejercicio.ccr / carga

  if (ejercicio.medida === 'segundos') {
    if (fraccion <= 0) return ejercicio.ventana.max
    return Math.round(REFERENCIA_ISOMETRICA / Math.pow(fraccion, 3))
  }
  return Math.floor((1.0278 - fraccion) / 0.0278)
}

/**
 * Cuánto hacer del ejercicio nuevo, a partir de lo que se estaba haciendo en
 * el viejo. Es la cuenta que reemplaza al número escrito a mano.
 *
 * Cuando cambia la unidad de medida —de repeticiones a segundos— no hay
 * traducción defendible, así que se entra por el piso de la ventana y se dice.
 */
export function recalibrar(
  desde: Ejercicio,
  cantidad: number,
  hacia: Ejercicio,
): number {
  if (desde.medida !== hacia.medida) return hacia.ventana.min

  const cruda = cantidadParaCarga(hacia, indiceDeCarga(desde, cantidad))
  return acotar(cruda, hacia.ventana.min, hacia.ventana.max)
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo)
}

// ─── La decisión ─────────────────────────────────────────────────────────

/** Qué clase de movimiento hizo el motor. Lo usa la interfaz para destacarlo. */
export type Movimiento =
  | 'subida'
  | 'sostiene'
  | 'bajada'
  | 'nivel-arriba'
  | 'nivel-abajo'
  | 'neutra'

export interface Decision {
  avance: Avance
  /** Qué cambió, en una frase, para poder mostrárselo a la persona. */
  explicacion: string
  movimiento: Movimiento
  /** True si hubo cambio de ejercicio, para destacarlo en la interfaz. */
  cambioDeNivel: boolean
}

/** Lo que el motor necesita saber de una sesión para decidir. */
export interface Evaluacion {
  /** Rendimiento continuo, el que devuelve `rendimientoDeSesion`. */
  rendimiento: number
  /** La cantidad típica lograda, para saber a qué bajar si hay meseta. */
  tipico: number
  /**
   * La sesión no mueve la progresión en ningún sentido. Es lo que pasa con una
   * sesión corta o con un día que la persona marcó como malo: no cuenta ni a
   * favor ni en contra.
   */
  neutra?: boolean
  /**
   * Una sesión floja que no debería contar como fallo, porque hay una razón
   * conocida —dormiste mal, venís cargado— que la explica.
   *
   * El motor decide con muy pocas observaciones. Si una de ellas está
   * contaminada por algo transitorio e identificable, bajarle la exigencia a
   * alguien por eso es un error de medición, no una decisión de entrenamiento.
   * Protegida solo puede ayudar, nunca perjudicar: una sesión buena cuenta
   * igual.
   */
  protegida?: boolean
  /**
   * Cómo se viene sintiendo, de -2 a +2, promediando las últimas sesiones.
   *
   * Frena las subidas cuando la persona viene cumpliendo pero pasándola mal.
   * No vetea entrenamientos ni hace bajar de nivel: solo evita apretar el
   * acelerador en el peor momento posible, que es cuando alguien está a punto
   * de dejar.
   */
  animo?: number
}

interface Contexto {
  cadena: Cadena
  /** Los ejercicios de la cadena, indexados por id. */
  ejercicios: Map<string, Ejercicio>
}

function ejercicioDe(ctx: Contexto, id: string): Ejercicio {
  const ejercicio = ctx.ejercicios.get(id)
  if (!ejercicio) {
    throw new Error(`El ejercicio "${id}" no está en la cadena de ${ctx.cadena.patron}.`)
  }
  return ejercicio
}

function vecino(ctx: Contexto, id: string, salto: 1 | -1): Ejercicio | null {
  const posicion = ctx.cadena.ejercicios.indexOf(id)
  if (posicion === -1) return null
  const destino = ctx.cadena.ejercicios[posicion + salto]
  return destino ? ejercicioDe(ctx, destino) : null
}

/**
 * Decide el próximo paso a partir del avance actual y de cómo salió la sesión.
 *
 * Las reglas, en orden:
 *
 * - La señal se actualiza con el rendimiento de la sesión.
 * - Señal alta y todavía hay techo en la ventana → más repeticiones.
 * - Señal alta y ya se llegó al techo → siguiente eslabón, con la carga
 *   recalculada a partir de lo que la persona demostró.
 * - Señal baja → menos repeticiones y, si ya está en el piso, un eslabón atrás.
 * - Ni una cosa ni la otra → se sostiene… pero no para siempre: a las cuatro
 *   sesiones sin cambios el motor mueve algo sí o sí.
 */
export function siguienteAvance(
  avance: Avance,
  evaluacion: Evaluacion,
  ctx: Contexto,
  ahora: number = Date.now(),
): Decision {
  const actual = ejercicioDe(ctx, avance.ejercicioId)
  const { medida, ventana } = actual
  const cantidad = avance.objetivoActual.cantidad

  // Una sesión neutra no toca nada. Ni la señal, ni el contador de meseta.
  if (evaluacion.neutra) {
    return {
      movimiento: 'neutra',
      cambioDeNivel: false,
      explicacion: 'Sesión registrada. Esta no mueve el plan, ni a favor ni en contra.',
      avance: { ...avance, actualizadoEn: ahora },
    }
  }

  // Protegida quiere decir que una sesión floja no arrastra la señal para
  // abajo. Si salió bien, cuenta como cualquier otra: premiar sí, castigar no.
  const arrastra = !(evaluacion.protegida && evaluacion.rendimiento < avance.senal)
  const senal = arrastra
    ? SUAVIZADO * evaluacion.rendimiento + (1 - SUAVIZADO) * avance.senal
    : avance.senal

  const gracia = Math.max(0, avance.graciaRestante - 1)
  const base = {
    patron: avance.patron,
    senal,
    graciaRestante: gracia,
    actualizadoEn: ahora,
  }

  const sostener = (explicacion: string, movimiento: Movimiento = 'sostiene'): Decision => ({
    movimiento,
    cambioDeNivel: false,
    explicacion,
    avance: {
      ...base,
      ejercicioId: actual.id,
      objetivoActual: { ...avance.objetivoActual },
      sesionesEnObjetivo: avance.sesionesEnObjetivo + 1,
    },
  })

  const ajustar = (nueva: number, explicacion: string, movimiento: Movimiento): Decision => ({
    movimiento,
    cambioDeNivel: false,
    explicacion,
    avance: {
      ...base,
      ejercicioId: actual.id,
      objetivoActual: { series: avance.objetivoActual.series, cantidad: nueva },
      sesionesEnObjetivo: 0,
    },
  })

  const cambiarDeNivel = (
    destino: Ejercicio,
    nueva: number,
    explicacion: string,
    movimiento: Movimiento,
  ): Decision => ({
    movimiento,
    cambioDeNivel: true,
    explicacion,
    avance: {
      ...base,
      ejercicioId: destino.id,
      objetivoActual: { series: destino.series, cantidad: nueva },
      sesionesEnObjetivo: 0,
      graciaRestante: GRACIA,
    },
  })

  /**
   * Volver un eslabón atrás, con dos precauciones contra el rebote.
   *
   * Se entra por la mitad de la ventana y no cerca del techo, porque si no dos
   * buenas sesiones devuelven a la persona al ejercicio que la acaba de
   * superar. Y la gracia es más larga que la de una subida: si algo ya resultó
   * demasiado, volver a probarlo la semana que viene es perder el mes.
   */
  const retroceder = (destino: Ejercicio, cruda: number, explicacion: string): Decision => {
    const medio = Math.round((destino.ventana.min + destino.ventana.max) / 2)
    const nueva = acotar(Math.min(cruda, medio), destino.ventana.min, destino.ventana.max)
    const decision = cambiarDeNivel(destino, nueva, explicacion, 'nivel-abajo')
    return { ...decision, avance: { ...decision.avance, graciaRestante: GRACIA * 2 } }
  }

  // ── Sube ───────────────────────────────────────────────────────────────
  if (senal >= SUBE) {
    // Viene cumpliendo, pero la está pasando mal. Subirle la exigencia ahora
    // es la forma más segura de perderla: se consolida en su lugar.
    if (evaluacion.animo !== undefined && evaluacion.animo < 0) {
      return sostener(
        'Venís cumpliendo, pero las últimas sesiones se te hicieron cuesta arriba. Nos quedamos acá para consolidar.',
      )
    }

    if (cantidad < ventana.max) {
      const nueva = Math.min(cantidad + incremento(medida, cantidad), ventana.max)
      const faltaPoco = nueva >= ventana.max
      return ajustar(
        nueva,
        faltaPoco
          ? `Objetivo cumplido. Subimos a ${conUnidad(medida, nueva)} por serie: es el techo de ${actual.nombre}, y con eso pasás de nivel.`
          : `Objetivo cumplido. Subimos a ${conUnidad(medida, nueva)} por serie.`,
        'subida',
      )
    }

    // Está en el techo de la ventana. Dominar un eslabón no es tocar el techo
    // una vez: es poder repetirlo. Una sola sesión buena puede ser un buen día,
    // y subir de palanca con un buen día es cómo se llega a un ejercicio que no
    // se puede sostener.
    if (avance.graciaRestante > 0 || avance.sesionesEnObjetivo < CONSOLIDACION) {
      const faltan = CONSOLIDACION - avance.sesionesEnObjetivo
      return sostener(
        faltan <= 1
          ? `Llegaste al techo de ${actual.nombre}. Una sesión más así y cambiamos de ejercicio.`
          : `Techo de ${actual.nombre} alcanzado. Lo sostenemos un par de sesiones antes de subir: dominar es poder repetirlo.`,
      )
    }

    const siguiente = vecino(ctx, actual.id, 1)
    if (siguiente) {
      const nueva = recalibrar(actual, cantidad, siguiente)
      return cambiarDeNivel(
        siguiente,
        nueva,
        `Dominaste ${actual.nombre} con ${conUnidad(medida, cantidad)}. Subís a ${siguiente.nombre}, arrancando en ${conUnidad(siguiente.medida, nueva)}.`,
        'nivel-arriba',
      )
    }

    // Último eslabón: no hay adónde subir, así que se suma volumen.
    return ajustar(
      cantidad + incremento(medida, cantidad),
      `Llegaste al final de la cadena de ${ctx.cadena.nombre}. Seguís sumando sobre ${actual.nombre}.`,
      'subida',
    )
  }

  // ── Baja ───────────────────────────────────────────────────────────────
  if (senal <= BAJA) {
    if (cantidad > ventana.min) {
      const nueva = Math.max(cantidad - incremento(medida, cantidad), ventana.min)
      return ajustar(
        nueva,
        `Vienen saliendo cortas. Bajamos a ${conUnidad(medida, nueva)} por serie para recuperar la técnica.`,
        'bajada',
      )
    }

    if (avance.graciaRestante > 0) {
      return sostener(
        `${actual.nombre} todavía te está costando. Le damos un par de sesiones más antes de tocar nada.`,
      )
    }

    const anterior = vecino(ctx, actual.id, -1)
    if (anterior) {
      return retroceder(
        anterior,
        recalibrar(actual, cantidad, anterior),
        `${actual.nombre} todavía te queda grande. Volvemos a ${anterior.nombre} para construir la base.`,
      )
    }

    // Primer eslabón de la cadena: no hay adónde bajar de ejercicio, pero
    // tampoco se puede dejar a alguien pidiéndole para siempre algo que no le
    // sale. Acá el piso de la ventana deja de ser un piso.
    if (cantidad > 1) {
      const nueva = Math.max(1, cantidad - incremento(medida, cantidad))
      return ajustar(
        nueva,
        `Bajamos a ${conUnidad(medida, nueva)} por serie. Es el principio de todo y no hay apuro.`,
        'bajada',
      )
    }

    return sostener(
      'Ya estás en el primer nivel con la carga mínima. Sostené y dale tiempo: esto también es entrenar.',
    )
  }

  // ── Ni una cosa ni la otra ─────────────────────────────────────────────
  // Acá es donde el motor viejo se colgaba. Sostener está bien un par de
  // sesiones —consolidar también es progresar— pero no puede ser para siempre.
  const sesiones = avance.sesionesEnObjetivo + 1
  if (sesiones < MESETA) {
    return sostener('Quedaste cerca. Repetimos el mismo objetivo para consolidarlo.')
  }

  // Meseta. Hay que mover algo.
  if (senal >= (SUBE + BAJA) / 2) {
    // Está muy cerca: se le da el empujón.
    if (cantidad < ventana.max) {
      const nueva = Math.min(cantidad + incremento(medida, cantidad), ventana.max)
      return ajustar(
        nueva,
        `Cuatro sesiones rondando el objetivo sin terminar de cerrarlo. Estás listo igual: subimos a ${conUnidad(medida, nueva)}.`,
        'subida',
      )
    }
    const siguiente = vecino(ctx, actual.id, 1)
    if (siguiente && avance.graciaRestante === 0) {
      const nueva = recalibrar(actual, cantidad, siguiente)
      return cambiarDeNivel(
        siguiente,
        nueva,
        `Estás hace rato en el techo de ${actual.nombre}. Probemos ${siguiente.nombre} con ${conUnidad(siguiente.medida, nueva)}.`,
        'nivel-arriba',
      )
    }
    return sostener(`Seguimos en ${actual.nombre}. La próxima cambiamos.`)
  }

  // Está estancado abajo: el objetivo no es realista. Se lo lleva a lo que la
  // persona está haciendo de verdad.
  const objetivoReal = Math.min(evaluacion.tipico, cantidad - incremento(medida, cantidad))
  const anterior = vecino(ctx, actual.id, -1)
  const piso = anterior ? ventana.min : 1

  if (objetivoReal >= piso) {
    return ajustar(
      objetivoReal,
      `Cuatro sesiones en ${conUnidad(medida, cantidad)} sin llegar. El objetivo era optimista: lo llevamos a ${conUnidad(medida, objetivoReal)}, que es lo que estás haciendo de verdad.`,
      'bajada',
    )
  }

  if (anterior && avance.graciaRestante === 0) {
    return retroceder(
      anterior,
      recalibrar(actual, Math.max(evaluacion.tipico, 1), anterior),
      `${actual.nombre} te está quedando grande hace varias sesiones. Volvemos a ${anterior.nombre}: se progresa más rápido desde un escalón que se domina.`,
    )
  }

  return sostener(
    `Seguimos en ${actual.nombre} con la carga mínima. Hay semanas así, y no borran nada de lo que llevás hecho.`,
  )
}

// ─── Puntos de partida ───────────────────────────────────────────────────

/** Crea el punto de partida de un patrón: primer ejercicio, carga de entrada. */
export function avanceInicial(
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
  ahora: number = Date.now(),
): Avance {
  const primeroId = cadena.ejercicios[0]
  if (!primeroId) {
    throw new Error(`La cadena de ${cadena.patron} está vacía.`)
  }
  const primero = ejercicios.get(primeroId)
  if (!primero) {
    throw new Error(`Falta el ejercicio "${primeroId}".`)
  }

  return {
    patron: cadena.patron,
    ejercicioId: primero.id,
    objetivoActual: { series: primero.series, cantidad: primero.ventana.min },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: ahora,
  }
}

/**
 * Ubica a alguien en la cadena a partir de una sola prueba.
 *
 * Es lo que hace que la app no le proponga flexiones contra la pared a quien
 * ya hace quince completas. La cuenta es la misma que usa el motor para
 * cambiar de nivel: se traduce lo que la persona hizo a índice de carga y se
 * busca el eslabón donde ese índice cae dentro de la ventana de trabajo.
 *
 * Se baja un escalón a propósito. Lo que uno dice que hace siempre está un
 * poco inflado, y arrancar demasiado fácil se corrige solo en dos sesiones,
 * mientras que arrancar demasiado arriba se corrige con una lesión.
 */
export function ubicarEnCadena(
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
  pruebaId: string,
  logrado: number,
  ahora: number = Date.now(),
): Avance {
  const inicial = avanceInicial(cadena, ejercicios, ahora)
  const prueba = ejercicios.get(pruebaId)
  if (!prueba || logrado <= 0) return inicial

  const carga = indiceDeCarga(prueba, logrado)

  // De más difícil a más fácil: el primero donde la persona entra en la
  // ventana de trabajo es su nivel.
  let elegido = 0
  for (let i = cadena.ejercicios.length - 1; i >= 0; i--) {
    const id = cadena.ejercicios[i]
    const ejercicio = id ? ejercicios.get(id) : undefined
    if (!ejercicio) continue
    if (cantidadParaCarga(ejercicio, carga) >= ejercicio.ventana.min) {
      elegido = i
      break
    }
  }

  const seguro = Math.max(0, elegido - 1)
  const id = cadena.ejercicios[seguro]
  const ejercicio = id ? ejercicios.get(id) : undefined
  if (!ejercicio) return inicial

  const cantidad = acotar(
    cantidadParaCarga(ejercicio, carga),
    ejercicio.ventana.min,
    ejercicio.ventana.max,
  )

  return {
    ...inicial,
    ejercicioId: ejercicio.id,
    objetivoActual: { series: ejercicio.series, cantidad },
  }
}

/**
 * Qué porcentaje de la cadena llevás recorrido, contando el ejercicio actual
 * y lo que falta para dominarlo. Sirve para la barra de progreso.
 */
export function porcentajeDeCadena(
  avance: Avance,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): number {
  const total = cadena.ejercicios.length
  if (total === 0) return 0

  const posicion = cadena.ejercicios.indexOf(avance.ejercicioId)
  if (posicion === -1) return 0

  const actual = ejercicios.get(avance.ejercicioId)
  if (!actual) return 0

  const recorrido = actual.ventana.max - actual.ventana.min
  const hecho = avance.objetivoActual.cantidad - actual.ventana.min
  const dentroDelNivel = recorrido > 0 ? Math.min(1, Math.max(0, hecho / recorrido)) : 0

  return Math.round(((posicion + dentroDelNivel) / total) * 100)
}

/**
 * Cuántas sesiones faltan para llegar a un ejercicio, si todo sale bien.
 *
 * Se calcula corriendo el motor en seco contra alguien que cumple siempre. No
 * es una promesa y la pantalla lo dice con esas palabras: es el mejor caso
 * imaginable, y sirve para que la persona vea que el camino existe y tiene
 * forma, no para prometerle una fecha.
 *
 * Devuelve null si el ejercicio no está más adelante en la cadena.
 */
export function proyectar(
  avance: Avance,
  ctx: Contexto,
  hasta: string,
  tope = 600,
): number | null {
  const destino = ctx.cadena.ejercicios.indexOf(hasta)
  const actual = ctx.cadena.ejercicios.indexOf(avance.ejercicioId)
  if (destino === -1 || actual === -1 || destino <= actual) return null

  let corriendo = avance
  for (let sesion = 1; sesion <= tope; sesion++) {
    const objetivo = corriendo.objetivoActual
    const series: Serie[] = Array.from({ length: objetivo.series }, () => ({
      logrado: objetivo.cantidad,
    }))
    const decision = siguienteAvance(
      corriendo,
      { rendimiento: rendimientoDeSesion(objetivo, series), tipico: objetivo.cantidad },
      ctx,
      corriendo.actualizadoEn,
    )
    corriendo = decision.avance
    if (corriendo.ejercicioId === hasta) return sesion
  }
  return null
}

/** El primer ejercicio de la cadena que todavía no se alcanzó. */
export function proximoHitoDeCadena(
  avance: Avance,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): Ejercicio | null {
  const posicion = cadena.ejercicios.indexOf(avance.ejercicioId)
  if (posicion === -1) return null
  const siguiente = cadena.ejercicios[posicion + 1]
  return siguiente ? (ejercicios.get(siguiente) ?? null) : null
}
