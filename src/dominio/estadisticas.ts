/**
 * Estadísticas derivadas del historial.
 *
 * Funciones puras sobre las sesiones ya guardadas. No hay ningún número
 * guardado en la base que después pueda quedar desactualizado: todo se calcula
 * a partir de lo que efectivamente entrenaste.
 *
 * Dos cosas que estaban acá y ya no están, porque hacían más mal que bien:
 *
 * - **El "volumen"** sumaba repeticiones con segundos. Veinticinco segundos de
 *   plancha más diez flexiones daban treinta y cinco de algo que no existe. Era
 *   la tercera cifra de la pantalla principal y el eje de todos los gráficos.
 *   Lo reemplaza el conteo de series, que sí es comparable, y el índice de
 *   carga, que sí dice algo sobre fuerza.
 *
 * - **La racha de días.** Estaba rota —contaba días de calendario con hueco
 *   máximo de dos, y las rutinas de la app tienen huecos de tres y cuatro, así
 *   que alguien impecable durante dos meses veía un tres— pero el problema no
 *   era el cálculo. En una app de fuerza el descanso es parte del programa, y
 *   una racha diaria premia exactamente lo que no hay que hacer. Lo que la
 *   reemplaza vive en `adherencia.ts`.
 */

import type { Objetivo, Patron, Serie, Sesion } from './tipos'
import { POR_ID } from './biblioteca'
import { indiceDeCarga } from './progresion'
import { diasEntre, lunesDe, sumarDias } from './adherencia'

/**
 * Las series sin la de cierre.
 *
 * La serie de cierre se hace al final, al sesenta por ciento y sobre el
 * ejercicio más fácil de la sesión, y la app la anota con el número propuesto
 * sin preguntar: nunca se midió. Contarla como capacidad es inventar un dato.
 *
 * El caso que lo vuelve grave no es raro, es el peor: alguien que pidió quince
 * y logró 4-3-3 recibe una serie de cierre de 9, y sin este filtro esa persona
 * ve "tu mejor serie: 9" y, la sesión siguiente, un "antes 9" en Hoy. Se le
 * pone como vara un número que nunca hizo, justo el día que la está pasando
 * mal.
 *
 * La regla que ordena todo esto: **el volumen la cuenta, la capacidad no.**
 * Cuántas series hiciste hoy la incluye, porque es trabajo real y por eso se
 * guarda. Cuánto podés hacer, no.
 */
function sinCierre(series: Serie[]): Serie[] {
  return series.filter((s) => !s.cierre)
}

/** Cuántas series se completaron en una sesión. Es la unidad comparable. */
export function seriesDeSesion(sesion: Sesion): number {
  return sesion.registros.reduce((total, r) => total + r.series.length, 0)
}

export function seriesPorPatron(sesion: Sesion): Record<Patron, number> {
  const acumulado: Record<Patron, number> = { empuje: 0, traccion: 0, piernas: 0, core: 0, bisagra: 0 }

  for (const registro of sesion.registros) {
    const ejercicio = POR_ID.get(registro.ejercicioId)
    if (!ejercicio) continue
    acumulado[ejercicio.patron] += registro.series.length
  }
  return acumulado
}

/**
 * Repeticiones totales de una sesión, contando solo lo que se mide en
 * repeticiones. Los sostenes tienen su propia cuenta porque son otra cosa.
 */
export function repeticionesDeSesion(sesion: Sesion): number {
  return sumarPorMedida(sesion, 'repeticiones')
}

/** Segundos de sostén de una sesión. */
export function segundosDeSesion(sesion: Sesion): number {
  return sumarPorMedida(sesion, 'segundos')
}

function sumarPorMedida(sesion: Sesion, medida: 'repeticiones' | 'segundos'): number {
  return sesion.registros.reduce((total, registro) => {
    const ejercicio = POR_ID.get(registro.ejercicioId)
    if (!ejercicio || ejercicio.medida !== medida) return total
    return total + registro.series.reduce((suma, serie) => suma + serie.logrado, 0)
  }, 0)
}

export interface ResumenSemana {
  /** Lunes de esa semana, en formato AAAA-MM-DD. */
  semana: string
  sesiones: number
  series: number
  minutos: number
}

/** Agrupa el historial por semana, de la más vieja a la más nueva. */
export function porSemana(sesiones: Sesion[]): ResumenSemana[] {
  const mapa = new Map<string, ResumenSemana>()

  for (const sesion of sesiones) {
    const semana = lunesDe(sesion.fecha)
    const actual = mapa.get(semana) ?? { semana, sesiones: 0, series: 0, minutos: 0 }
    actual.sesiones += 1
    actual.series += seriesDeSesion(sesion)
    actual.minutos += Math.round(sesion.duracionSegundos / 60)
    mapa.set(semana, actual)
  }

  return [...mapa.values()].sort((a, b) => a.semana.localeCompare(b.semana))
}

export interface PuntoHistorico {
  fecha: string
  /** La mejor serie de ese día para ese ejercicio. */
  mejor: number
  /** Cuántas series se hicieron. */
  series: number
}

/** La evolución de un ejercicio puntual a lo largo del tiempo. */
export function historicoDeEjercicio(
  sesiones: Sesion[],
  ejercicioId: string,
): PuntoHistorico[] {
  const puntos: PuntoHistorico[] = []

  for (const sesion of [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    for (const registro of sesion.registros) {
      if (registro.ejercicioId !== ejercicioId) continue
      // El reloj no entra en el histórico: una vuelta de veinte segundos y una
      // serie de tres minutos son el mismo ejercicio y no la misma medida, y
      // mezclarlas haría caer la línea el día que hiciste un tabata.
      if (registro.reloj) continue
      const logros = sinCierre(registro.series).map((s) => s.logrado)
      if (logros.length === 0) continue
      puntos.push({
        fecha: sesion.fecha,
        mejor: Math.max(...logros),
        series: logros.length,
      })
    }
  }

  return puntos
}


/**
 * La vez pasada: qué hiciste la última vez que te tocó este ejercicio.
 *
 * Es el dato más barato de la app y el que más se usa. Sin él, la segunda
 * sesión se siente idéntica a la primera: los mismos ejercicios, los mismos
 * casilleros vacíos, la misma pantalla. Con él, cada casillero tiene una vara
 * al lado, y la vara la puso la persona.
 *
 * Vale la pena decir por qué esto no es una recompensa. No hay nada que ganar
 * ni ninguna insignia: es información sobre la propia competencia, que es
 * justo la clase de feedback que construye motivación intrínseca en vez de
 * erosionarla. Y sirve incluso cuando la comparación sale mal, porque el
 * número de al lado explica por qué hoy costó más.
 *
 * Devuelve null cuando no hay con qué comparar, que es el caso más importante:
 * la primera vez la app no inventa una vara.
 */
export interface VezPasada {
  fecha: string
  /** Días desde entonces. Cero significa hoy mismo. */
  hace: number
  /** Lo logrado en cada serie, en orden y tal como quedó registrado. */
  logros: number[]
  /** El objetivo que tenía ese día, para saber si lo cumplió o no. */
  objetivo: Objetivo
  /** La mejor serie de ese día. */
  mejor: number
  /**
   * Los kilos que llevaba, si llevaba.
   *
   * Sin esto, cada sesión con barra empieza en cero y hay que tocar el más
   * ocho veces para volver a veinte kilos — por ejercicio. El número que
   * importa es el más alto del día: si una serie se hizo más liviana porque
   * ya no salía, la vara sigue siendo lo que se levantó.
   */
  kg?: number
}

export function laVezPasada(
  sesiones: Sesion[],
  ejercicioId: string,
  hoy: string,
): VezPasada | null {
  // De la más nueva a la más vieja: la primera que tenga el ejercicio gana.
  const ordenadas = [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha))

  for (const sesion of ordenadas) {
    for (const registro of sesion.registros) {
      if (registro.ejercicioId !== ejercicioId) continue
      // Y el reloj tampoco es "la vez pasada". Es el dato más usado de la app
      // —la vara que aparece al lado de cada casillero— y si la vara la pusiera
      // un tabata, la próxima sesión compararía tres series completas contra
      // cuatro vueltas de veinte segundos. La vara tiene que ser la última vez
      // que hiciste ESTO, no la última vez que lo hiciste contra el reloj.
      if (registro.reloj) continue
      const logros = sinCierre(registro.series)
        .map((s) => s.logrado)
        .filter((n) => n > 0)
      if (logros.length === 0) continue
      const kilos = sinCierre(registro.series)
        .map((s) => s.kg ?? 0)
        .filter((n) => n > 0)
      return {
        fecha: sesion.fecha,
        hace: diasEntre(sesion.fecha, hoy),
        logros,
        objetivo: registro.objetivo,
        mejor: Math.max(...logros),
        ...(kilos.length > 0 ? { kg: Math.max(...kilos) } : {}),
      }
    }
  }

  return null
}

/**
 * Cómo se lee "hace tanto" en el idioma de alguien que entrena tres veces por
 * semana. Nadie dice "hace 1 día": dice "ayer". Y arriba de un mes el número
 * exacto de días deja de significar algo.
 */
export function haceCuanto(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 14) return 'hace una semana'
  if (dias < 31) return `hace ${Math.round(dias / 7)} semanas`
  if (dias < 60) return 'hace un mes'
  return `hace ${Math.round(dias / 30)} meses`
}

/** El récord personal de un ejercicio: la mejor serie que registraste. */
export function recordDe(sesiones: Sesion[], ejercicioId: string): number {
  const puntos = historicoDeEjercicio(sesiones, ejercicioId)
  if (puntos.length === 0) return 0
  return Math.max(...puntos.map((p) => p.mejor))
}

export interface PuntoDeFuerza {
  fecha: string
  /** El índice de carga de la mejor serie del día en esta cadena. */
  carga: number
  ejercicioId: string
  /** Si esa mejor serie llevaba discos. */
  conDiscos: boolean
  /**
   * La mejor serie con discos del día, si hubo alguna. Entrenar deja sumar o
   * sacar peso en medio de la sesión, así que el día en que entran los discos
   * la mejor serie puede ser una de antes, sin peso.
   */
  conDiscosLaMejor?: { carga: number; ejercicioId: string }
}

/**
 * La curva de fuerza de una cadena, en índice de carga.
 *
 * Es el gráfico que antes no se podía dibujar. El registro crudo de
 * repeticiones se desploma cada vez que se cambia de eslabón —pasás de hacer
 * quince a hacer seis— y muestra un retroceso justo en el momento de mayor
 * logro. El índice de carga hace comparables ejercicios distintos, así que la
 * línea sube parejo a través de toda la cadena.
 *
 * Es una estimación, y en la pantalla se dice.
 *
 * Los discos cuentan: con `pesoCorporalKg`, cada serie se mide con su propia
 * carga, y gana la mejor serie y no la de más repeticiones, porque los kilos
 * cambian de una serie a otra. Sin peso corporal no hay cómo pasar kilos a
 * esta escala y la serie con discos vale lo mismo que sin ellos.
 */
export function curvaDeFuerza(sesiones: Sesion[], patron: Patron, pesoCorporalKg?: number): PuntoDeFuerza[] {
  const porDia = new Map<string, PuntoDeFuerza>()

  for (const sesion of sesiones) {
    for (const registro of sesion.registros) {
      const ejercicio = POR_ID.get(registro.ejercicioId)
      if (!ejercicio || ejercicio.patron !== patron) continue
      // La bajada es volumen en un eslabón ya dominado: no es la mejor marca
      // del día aunque el índice le dé más alto, y darle el punto atribuiría la
      // sesión al ejercicio equivocado.
      if (registro.bajada) continue
      // Y el reloj tampoco: veinte segundos a fondo con recuperación
      // incompleta son trabajo real, pero no una medida de lo que podés mover.
      // Meterlo en la curva haría subir la línea en un día que midió otra cosa.
      if (registro.reloj) continue

      for (const serie of sinCierre(registro.series)) {
        if (serie.logrado <= 0) continue
        const carga = indiceDeCarga(ejercicio, serie.logrado, {
          ...(serie.kg !== undefined ? { kg: serie.kg } : {}),
          ...(pesoCorporalKg !== undefined ? { pesoCorporalKg } : {}),
        })
        const previo = porDia.get(sesion.fecha)
        const conDiscos = (serie.kg ?? 0) > 0
        const conDiscosLaMejor =
          conDiscos && !(previo?.conDiscosLaMejor && previo.conDiscosLaMejor.carga >= carga)
            ? { carga, ejercicioId: ejercicio.id }
            : previo?.conDiscosLaMejor
        const mejor = !previo || carga > previo.carga ? { carga, ejercicioId: ejercicio.id, conDiscos } : previo
        porDia.set(sesion.fecha, {
          fecha: sesion.fecha,
          carga: mejor.carga,
          ejercicioId: mejor.ejercicioId,
          conDiscos: mejor.conDiscos,
          ...(conDiscosLaMejor ? { conDiscosLaMejor } : {}),
        })
      }
    }
  }

  return [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/**
 * Las semanas que se dibujan en Progreso: los lunes de las últimas `cuantas`,
 * de la más vieja a la de hoy.
 *
 * Arrancan en la semana de la primera sesión si es más nueva que eso: quien
 * entrena hace tres semanas ve tres columnas y no nueve semanas vacías antes
 * de haber empezado. Las semanas del medio sin sesiones SÍ están, vacías: un
 * mes de vacaciones es un hueco en el eje, no algo que se pliega y desaparece.
 *
 * Siempre trae por lo menos la semana de hoy, aunque la primera sesión tenga
 * una fecha más nueva: pasa con el reloj del teléfono adelantado o con un
 * viaje hacia el oeste, y sin esta semana la pantalla no tendría eje.
 */
export function ultimasSemanas(hoy: string, cuantas: number, primera?: string): string[] {
  const actual = lunesDe(hoy)
  const desdeHoy = sumarDias(actual, -7 * (cuantas - 1))
  const desde = primera ? lunesDe(primera) : desdeHoy
  const inicio = desde > actual ? actual : desde > desdeHoy ? desde : desdeHoy
  const semanas: string[] = []
  for (let lunes = inicio; lunes <= actual; lunes = sumarDias(lunes, 7)) semanas.push(lunes)
  return semanas
}

/** El cambio de eslabón que empezó en una semana. */
export interface CambioDeEslabon {
  /** El ejercicio que venías haciendo. */
  de: string
  /** Tu última marca en ese ejercicio, antes de cambiar. */
  cargaAntes: number
  /** El ejercicio con el que terminó la semana. */
  a: string
}

export interface SemanaDeFuerza {
  /** Lunes de esa semana, en formato AAAA-MM-DD. */
  semana: string
  /** El índice de carga de la mejor serie de la semana en esta cadena. */
  carga: number
  /** El ejercicio de esa mejor serie. */
  ejercicioId: string
  /** Si esa mejor serie llevaba discos. */
  conDiscos: boolean
  /** Si en esta semana cambiaste de eslabón. */
  cambio?: CambioDeEslabon
  /** Si en esta semana le sumaste discos al mismo ejercicio. */
  discos?: DiscosNuevos
}

/** El primer día con discos en un ejercicio que venías haciendo sin peso. */
export interface DiscosNuevos {
  /** Ese día, en formato AAAA-MM-DD. */
  desde: string
  /** El ejercicio al que se los sumaste. */
  ejercicioId: string
  /** Tu última marca sin discos, antes de ese día. */
  cargaAntes: number
  /** Tu mejor serie con discos de ese día. */
  carga: number
}

/**
 * La fuerza de una cadena por semana: la mejor marca de cada una.
 *
 * Es `curvaDeFuerza` agrupada por semana, así que hereda sus filtros —ni la
 * serie de cierre, ni la bajada, ni el reloj— y su escala. Devuelve una
 * entrada por cada lunes de `semanas`, en el mismo orden, y `null` en las
 * semanas en que esta cadena no se entrenó: la columna queda vacía, no en cero,
 * porque no entrenar no es haber perdido fuerza.
 *
 * El cambio de eslabón se busca día por día y no en la mejor marca: el día del
 * salto hacés el eslabón viejo en su techo, y el nuevo arranca casi siempre un
 * poco más abajo en esta escala. Si los dos caen en la misma semana, la mejor
 * marca es la del viejo, y mirarla correría el cambio a la semana siguiente.
 * Se compara contra el día anterior aunque caiga antes de `semanas`, así que
 * el cambio de la primera columna también se ve.
 *
 * Los discos, igual y por la misma razón: el día que llegás al techo del
 * último eslabón lo hacés sin peso, y si los discos entran después en esa
 * semana, la mejor marca sigue siendo la de sin peso. Entran el primer día
 * con alguna serie con discos, aunque la mejor de ese día sea sin peso.
 */
export function fuerzaPorSemana(
  sesiones: Sesion[],
  patron: Patron,
  semanas: string[],
  pesoCorporalKg?: number,
): (SemanaDeFuerza | null)[] {
  const mejores = new Map<string, SemanaDeFuerza>()
  const cambios = new Map<string, CambioDeEslabon>()
  const discos = new Map<string, DiscosNuevos>()
  let anterior: PuntoDeFuerza | undefined
  for (const punto of curvaDeFuerza(sesiones, patron, pesoCorporalKg)) {
    const semana = lunesDe(punto.fecha)
    if (anterior && anterior.ejercicioId !== punto.ejercicioId) {
      // El primer cambio de la semana dice de dónde venías; el último, adónde
      // llegaste. Ir y volver en la misma semana no es un cambio.
      const ya = cambios.get(semana)
      cambios.set(
        semana,
        ya ? { ...ya, a: punto.ejercicioId } : { de: anterior.ejercicioId, cargaAntes: anterior.carga, a: punto.ejercicioId },
      )
    } else if (
      anterior &&
      punto.conDiscosLaMejor &&
      !anterior.conDiscosLaMejor &&
      punto.conDiscosLaMejor.ejercicioId === anterior.ejercicioId &&
      !discos.has(semana)
    ) {
      discos.set(semana, {
        desde: punto.fecha,
        ejercicioId: punto.conDiscosLaMejor.ejercicioId,
        cargaAntes: anterior.carga,
        carga: punto.conDiscosLaMejor.carga,
      })
    }
    anterior = punto

    const previa = mejores.get(semana)
    if (!previa || punto.carga > previa.carga) {
      mejores.set(semana, { semana, carga: punto.carga, ejercicioId: punto.ejercicioId, conDiscos: punto.conDiscos })
    }
  }
  return semanas.map((s) => {
    const mejor = mejores.get(s)
    if (!mejor) return null
    const cambio = cambios.get(s)
    const conDiscos = discos.get(s)
    return {
      ...mejor,
      ...(cambio && cambio.de !== cambio.a ? { cambio } : {}),
      ...(conDiscos ? { discos: conDiscos } : {}),
    }
  })
}

export interface Totales {
  sesiones: number
  series: number
  minutos: number
  repeticiones: number
  segundos: number
}

export function totales(sesiones: Sesion[]): Totales {
  return {
    sesiones: sesiones.length,
    series: sesiones.reduce((suma, s) => suma + seriesDeSesion(s), 0),
    minutos: Math.round(sesiones.reduce((suma, s) => suma + s.duracionSegundos, 0) / 60),
    repeticiones: sesiones.reduce((suma, s) => suma + repeticionesDeSesion(s), 0),
    segundos: sesiones.reduce((suma, s) => suma + segundosDeSesion(s), 0),
  }
}

export { lunesDe }
