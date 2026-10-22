/**
 * El repositorio: la única puerta entre la app y la base.
 *
 * Ningún componente le habla a Dexie directamente. Eso parece burocracia hasta
 * el día que quieras cambiar dónde se guardan los datos: cambiás este archivo
 * y no se entera nadie más.
 */

import {
  desdeCuandoValeLaHora,
  horaDeDormirVigente,
  type DiaDelDiario,
  type HoraDeDormir,
} from '@/dominio/nutricion'
import { db, marcarPendiente, PREFERENCIAS_POR_DEFECTO } from './db'
import type {
  Avance,
  Estado,
  Objetivo,
  Patron,
  Preferencias,
  RegistroEjercicio,
  RegistroRafaga,
  RutinaPropia,
  Sesion,
  SesionEnCurso,
  TipoSesion,
} from '@/dominio/tipos'
import { CADENAS, POR_ID, cadenaDe } from '@/dominio/biblioteca'
import {
  avanceInicial,
  leerLaSesion,
  mueveElPlan,
  pasosQueSiguenTuNivel,
  type Decision,
} from '@/dominio/progresion'
import {
  bajarDeLoColgado,
  bajarPorRequisito,
  eslabonesCerrados,
  ubicarDesdeElAlta,
  type PruebaDelAlta,
} from '@/dominio/apertura'
import { ajusteDelDia, bandaSostenida, cadenasCongeladas } from '@/dominio/estado'
import { animoPorDia, promedioDeAnimos, vitalidadDeAntes } from '@/dominio/vitalidad'
import {
  alCambiarDeNivel,
  cierreDelBorrador,
  destinoDelBorrador,
  normalizarBorrador,
  quedaPorCerrar,
} from '@/dominio/borrador'
import { revisarCopia } from '@/dominio/copia'
import { cuentaComoSesion } from '@/dominio/adherencia'

/** Fecha local en formato AAAA-MM-DD, sin arrastrar la zona horaria de UTC. */
export function fechaISO(fecha: Date = new Date()): string {
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dd(fecha.getMonth() + 1)}-${dd(fecha.getDate())}`
}

export function nuevoId(): string {
  return crypto.randomUUID()
}

// ─── Preferencias ────────────────────────────────────────────────────────

export async function leerPreferencias(): Promise<Preferencias> {
  const guardadas = await db.preferencias.get('unico')
  return { ...PREFERENCIAS_POR_DEFECTO, ...guardadas }
}

export async function guardarPreferencias(cambios: Partial<Preferencias>): Promise<Preferencias> {
  const actuales = await leerPreferencias()
  const nuevas: Preferencias = { ...actuales, ...cambios, id: 'unico' }
  await db.preferencias.put(nuevas)
  await marcarPendiente('preferencias', 'unico')
  return nuevas
}

// ─── Avances ─────────────────────────────────────────────────────────────

/**
 * Devuelve el avance de cada patrón. Los que todavía no existen se completan
 * con el punto de partida de su cadena, calculado al vuelo.
 *
 * Es importante que esta función solamente lea. La usan las pantallas a través
 * de `useLiveQuery`, que corre las consultas en una transacción de solo
 * lectura: si acá adentro se escribiera, la app entera reventaría con un
 * ReadOnlyError la primera vez que alguien la abre. Nada se guarda hasta que
 * hay algo real que guardar — la primera sesión, o un nivel fijado a mano.
 */
export async function leerAvances(): Promise<Map<Patron, Avance>> {
  const guardados = new Map((await db.avances.toArray()).map((a) => [a.patron, a]))
  const mapa = new Map<Patron, Avance>()

  // Se arma en el orden de las cadenas y no en el que devuelve la base: el
  // mapa se recorre para dibujar, y si el orden cambiara entre lecturas las
  // barras de las cadenas bailarían de lugar sin motivo.
  for (const cadena of CADENAS) {
    // Fecha 0 a propósito en el inicial: es un avance que todavía no se guardó
    // nunca, y un Date.now() acá haría que cada lectura devolviera un objeto
    // distinto.
    mapa.set(cadena.patron, guardados.get(cadena.patron) ?? avanceInicial(cadena, POR_ID, 0))
  }

  return mapa
}

export async function leerAvance(patron: Patron): Promise<Avance> {
  const avances = await leerAvances()
  const avance = avances.get(patron)
  if (!avance) throw new Error(`No se pudo preparar el avance de ${patron}.`)
  return avance
}

async function guardarAvance(avance: Avance): Promise<void> {
  await db.avances.put(avance)
  await marcarPendiente('avances', avance.patron)
}

// ─── Chequeo diario ──────────────────────────────────────────────────────

export async function leerEstados(): Promise<Estado[]> {
  return db.estados.orderBy('fecha').toArray()
}

export async function leerEstadoDeHoy(): Promise<Estado | undefined> {
  return db.estados.get(fechaISO())
}

// ─── La sesión a medio hacer ─────────────────────────────────────────────

/**
 * El borrador que haya, vigente o no, sin decidir nada.
 *
 * Antes uno vencido —seis horas sin tocar "Cerrar la sesión"— se borraba acá
 * de paso, sin mostrárselo a nadie, aunque tuviera la sesión entera adentro.
 * Ahora qué hacer con él lo decide `destinoDelBorrador`, en el dominio, y
 * esto solo lee: por eso también se puede usar desde `useLiveQuery`.
 */
export async function leerSesionEnCurso(): Promise<SesionEnCurso | null> {
  return (await db.curso.get('actual')) ?? null
}

/**
 * El borrador vencido que hay que ofrecerle a la persona, o null.
 *
 * Es el que Hoy muestra con "Guardarla" y "Descartarla". Solo lee: la hora
 * entra en la decisión, pero no escribe nada.
 */
export async function leerSesionSinCerrar(): Promise<SesionEnCurso | null> {
  const borrador = await leerSesionEnCurso()
  return borrador && destinoDelBorrador(borrador, Date.now()) === 'ofrecer' ? borrador : null
}

/**
 * "Guardarla": el borrador se cierra como cualquier otra sesión, con lo hecho.
 *
 * Es el mismo camino que "Cerrar la sesión" —`cerrarSesion`, con el borrador
 * borrado en la misma transacción— así que mueve el motor igual que si se
 * hubiera cerrado esa noche, con una diferencia: se guarda desde afuera, y un
 * paso de cadena con menos series que las del objetivo queda a medias y no se
 * lee (`a-medias`). La persona no eligió terminar ahí; eligió otra cosa, o
 * nada. La sesión queda con el día en que se hizo, no con el de hoy, y sin las
 * tres preguntas del final: contestarlas al día siguiente mediría el día
 * siguiente.
 *
 * La usan la placa de una sesión sin cerrar y, desde la reestructura,
 * "Guardarla y empezar" y el cambio de nivel a mano. Todo adentro de una
 * transacción: leer el borrador afuera dejaba que otra pestaña lo cerrara en
 * el medio y la sesión se guardara dos veces.
 *
 * Devuelve null si ya no había borrador (otra pestaña lo cerró o lo descartó).
 *
 * El callback es `async` a propósito, y tiene que seguir siéndolo: Dexie sigue
 * la transacción a través de los `await` solo cuando la función es async. Con
 * una flecha común que devolvía la promesa, el borrado del borrador caía
 * afuera, en una transacción aparte; la de adentro confirmaba sola y todo
 * terminaba en PrematureCommitError, con la sesión ya guardada y la pantalla
 * diciendo "No se pudo guardar".
 */
export async function guardarSesionSinCerrar(): Promise<ResumenSesion | null> {
  return db.transaction('rw', TABLAS_DEL_CIERRE, async () => cerrarBorradorDesdeAfuera())
}

/**
 * El cierre desde afuera, para llamarlo adentro de una transacción que ya
 * incluye `TABLAS_DEL_CIERRE`.
 *
 * `sinLeer` es la cadena que `fijarNivel` está por mover a mano: ver
 * `CierreDeSesion.sinLeer`.
 */
async function cerrarBorradorDesdeAfuera(sinLeer?: Patron): Promise<ResumenSesion | null> {
  const guardado = await leerSesionEnCurso()
  if (!guardado) return null
  // Un borrador cuya sesión ya está en el historial es un resto, no una sesión
  // por guardar: guardarlo duplicaría sus series. Se borra y nada más.
  if (guardado.idDeLaSesion && (await db.sesiones.get(guardado.idDeLaSesion))) {
    await db.curso.delete('actual')
    return null
  }

  const [avances, historial] = await Promise.all([leerAvances(), leerSesiones()])
  const borrador = normalizarBorrador(guardado, avances.values())
  const cierre = cierreDelBorrador(borrador, {
    historial,
    objetivoDe: (ejercicioId) =>
      [...avances.values()].find((a) => a.ejercicioId === ejercicioId)?.objetivoActual,
    desdeAfuera: true,
  })
  // La energía de antes sale del chequeo de ESE día, igual que en Entrenar, y
  // solo si fue la primera sesión de ese día.
  const vitalidadPre = vitalidadDeAntes(
    (await db.estados.get(cierre.fecha))?.energia,
    cierre.fecha,
    historial,
  )

  return cerrarSesion({
    ...cierre,
    ...(vitalidadPre !== undefined ? { vitalidadPre } : {}),
    ...(guardado.idDeLaSesion ? { idDeLaSesion: guardado.idDeLaSesion } : {}),
    ...(sinLeer ? { sinLeer } : {}),
    cierraElBorrador: true,
  })
}

/** Qué pasó al escribir el borrador. */
export type GuardadoDelBorrador = 'guardado' | 'ya-guardada'

/**
 * Escribe el borrador, salvo que su sesión ya esté en el historial.
 *
 * Pasa cuando otra pantalla la cerró mientras esta seguía abierta: la Ficha
 * que cambia de nivel, o "Guardarla" en otra pestaña. Escribirlo otra vez la
 * dejaba lista para guardarse dos veces, con las mismas series. Mirar y
 * escribir van en la misma transacción, así que entre las dos no entra nada.
 */
export async function guardarSesionEnCurso(
  datos: Omit<SesionEnCurso, 'id' | 'actualizadoEn'>,
): Promise<GuardadoDelBorrador> {
  return db.transaction('rw', [db.curso, db.sesiones], async (): Promise<GuardadoDelBorrador> => {
    if (datos.idDeLaSesion && (await db.sesiones.get(datos.idDeLaSesion))) return 'ya-guardada'
    await db.curso.put({ ...datos, id: 'actual', actualizadoEn: Date.now() })
    return 'guardado'
  })
}

export async function descartarSesionEnCurso(): Promise<void> {
  await db.curso.delete('actual')
}

export async function guardarEstado(
  datos: Omit<Estado, 'actualizadoEn'>,
): Promise<Estado> {
  const estado: Estado = { ...datos, actualizadoEn: Date.now() }
  await db.estados.put(estado)
  await marcarPendiente('estados', estado.fecha)
  return estado
}

/**
 * Avisar una molestia, o retirarla, sin tocar el resto del día.
 *
 * Se puede avisar con el chequeo apagado, así que puede no haber fila de hoy:
 * entonces se escribe una con la molestia sola, sin inventar sueño, energía ni
 * músculos —el índice no la lee, ver `contestoElChequeo`—. Si ya había
 * chequeo, se fusiona y las tres respuestas quedan como estaban. La fusión va
 * adentro de una transacción por lo mismo que en el diario: dos toques
 * rápidos leerían la misma fila vieja.
 *
 * Retirarla de una fila que no tenía nada más la borra: una fila sin chequeo
 * y sin molestia no dice nada.
 */
export async function guardarMolestiaDeHoy(molestia: Patron | null): Promise<void> {
  const fecha = fechaISO()
  const operacion = await db.transaction('rw', db.estados, async () => {
    const antes = await db.estados.get(fecha)
    const nueva: Estado = { fecha, actualizadoEn: Date.now() }
    if (antes?.sueno !== undefined) nueva.sueno = antes.sueno
    if (antes?.energia !== undefined) nueva.energia = antes.energia
    if (antes?.musculos !== undefined) nueva.musculos = antes.musculos
    if (antes?.posterior !== undefined) nueva.posterior = antes.posterior
    if (molestia) nueva.molestia = molestia

    const vacia =
      nueva.molestia === undefined &&
      nueva.sueno === undefined &&
      nueva.energia === undefined &&
      nueva.musculos === undefined
    if (vacia) {
      if (!antes) return null
      await db.estados.delete(fecha)
      return 'borrar' as const
    }
    await db.estados.put(nueva)
    return 'guardar' as const
  })
  if (operacion) await marcarPendiente('estados', fecha, operacion)
}

// ─── El diario: comida y sueño ───────────────────────────────────────────

/**
 * Una fila por día, con la fecha de clave.
 *
 * Que la clave sea la fecha y no un id autoincremental es lo que hace que
 * corregir un número del mediodía pise la fila de la mañana en vez de crear
 * una segunda. Es la misma decisión que en `estados`, por el mismo motivo.
 */
export async function leerDiario(): Promise<DiaDelDiario[]> {
  return db.diario.orderBy('fecha').toArray()
}

export async function leerDiaDelDiario(fecha = fechaISO()): Promise<DiaDelDiario | undefined> {
  return db.diario.get(fecha)
}

/**
 * La hora de acostarse que vale hoy: la de hoy o la última de hace poco.
 *
 * Lee solo los días que todavía pueden valer —por la clave, que ya es la
 * fecha, sin índice nuevo— y la regla de cuál gana es de
 * `horaDeDormirVigente`. No escribe nada: la hora de otro día se usa, no se
 * copia a la fila de hoy.
 */
export async function leerHoraDeDormir(fecha = fechaISO()): Promise<HoraDeDormir | null> {
  const recientes = await db.diario
    .where('fecha')
    .between(desdeCuandoValeLaHora(fecha), fecha, true, true)
    .toArray()
  return horaDeDormirVigente(recientes, fecha)
}

/**
 * Guardar un campo del día, sin pisar los otros.
 *
 * El diario se contesta de a pedazos —el sueño a la mañana, la proteína a la
 * noche— así que una escritura que reemplace la fila entera borraría lo de
 * hace seis horas. Por eso esto fusiona, y por eso la fusión va adentro de una
 * transacción: sin ella, dos toques rápidos leen la misma fila vieja y el
 * segundo pisa al primero.
 */
export async function guardarDiaDelDiario(
  campos: Partial<Omit<DiaDelDiario, 'fecha' | 'actualizadoEn'>>,
  fecha = fechaISO(),
): Promise<DiaDelDiario> {
  const dia = await db.transaction('rw', db.diario, async () => {
    const antes = await db.diario.get(fecha)
    const nuevo: DiaDelDiario = { ...antes, ...campos, fecha, actualizadoEn: Date.now() }
    await db.diario.put(nuevo)
    return nuevo
  })
  await marcarPendiente('diario', fecha)
  return dia
}

// ─── Sesiones ────────────────────────────────────────────────────────────

export async function leerSesiones(limite?: number): Promise<Sesion[]> {
  const consulta = db.sesiones.orderBy('finalizadaEn').reverse()
  return limite ? consulta.limit(limite).toArray() : consulta.toArray()
}

export async function leerSesion(id: string): Promise<Sesion | undefined> {
  return db.sesiones.get(id)
}

export async function contarSesiones(): Promise<number> {
  return db.sesiones.count()
}

/**
 * Las sesiones de un día, AAAA-MM-DD, en el orden en que se cerraron.
 *
 * Por el índice `fecha`, que existe desde la primera versión de la base: con
 * varias sesiones por día, Hoy y Tu día las piden sin leer el historial
 * entero. El día es el de la sesión, no el del cierre: una que cruzó la
 * medianoche, o una vencida que se guardó a la mañana, es del día en que se
 * entrenó.
 */
export async function sesionesDelDia(fecha: string): Promise<Sesion[]> {
  return db.sesiones.where('fecha').equals(fecha).sortBy('finalizadaEn')
}

/** Lo que devuelve cerrar una sesión: qué cambió en cada patrón entrenado. */
export interface ResumenSesion {
  sesion: Sesion
  /**
   * `antes` es el avance que el motor evaluó: dónde estaba la cadena antes de
   * esta sesión. No sale del objetivo del registro, que en un día ámbar viene
   * recortado y no es dónde te tenía el motor.
   */
  decisiones: { patron: Patron; decision: Decision; antes: Avance }[]
  /**
   * El número de sesión en la vida de esta persona: las que cuentan
   * (`cuentaComoSesion`), esta incluida. Una movilidad no lo corre: el suyo es
   * el de la última que contó, y su Cierre no lo muestra ni festeja un hito
   * con él (§4.15).
   */
  numeroDeSesion: number
  /**
   * Cuántos pasos seguían tu nivel, hechos o no. Con cero no había nada que
   * leer, y es lo único que el Cierre dice del plan cuando no hay decisiones.
   */
  pasosDeCadena: number
}

export interface CierreDeSesion {
  registros: RegistroEjercicio[]
  duracionSegundos: number
  tipo?: TipoSesion
  nota?: string
  /** Esfuerzo de la sesión entera, 1 a 10. */
  esfuerzo?: number
  vitalidadPre?: number
  vitalidadPost?: number
  /** Cómo se sintió, de -2 a +2. */
  animo?: number
  /** El trabajo metabólico: las ráfagas de los descansos y el bloque del final. */
  rafagas?: RegistroRafaga[]
  /** True si fue una sesión densa. */
  densa?: true
  /**
   * El día de la sesión, AAAA-MM-DD. Si falta, hoy.
   *
   * Hace falta porque una sesión puede cerrarse otro día del que se hizo: la
   * que cruzó la medianoche, o un borrador vencido que se guarda a la mañana
   * siguiente. La sesión es del día en que se entrenó.
   */
  fecha?: string
  /**
   * Si esta sesión es la del borrador de Entrenar. Entonces el borrador se
   * borra adentro de la misma transacción que guarda la sesión.
   *
   * Antes se borraba después, afuera: si el teléfono mataba la app justo en
   * el medio quedaban la sesión guardada y el borrador vivo, y al volver la
   * sesión se cerraba otra vez y la progresión se aplicaba dos veces. El
   * Reloj no lo pide: su sesión no tiene nada que ver con el borrador.
   */
  cierraElBorrador?: true
  /**
   * Cuándo arrancó, para la sesión que no viene del borrador (el Reloj). La
   * del borrador toma la del borrador, que se lee adentro de la transacción.
   */
  iniciadaEn?: number
  /** Ver `CierreDelBorrador.desdeAfuera`: un paso de cadena a medias no se lee. */
  desdeAfuera?: true
  /**
   * El id de la sesión, el mismo que lleva su borrador (`idDeLaSesion`).
   *
   * Con él, cerrar una sesión que otra pantalla ya guardó no guarda otra con
   * las mismas series: lanza `SesionYaGuardada`. Y el borrador que se borra y
   * del que se toman el origen y la hora de inicio es solo el de esta sesión,
   * no el de otra pestaña que escribió encima. Sin id —el Reloj— la sesión
   * lleva uno nuevo.
   */
  idDeLaSesion?: string
  /**
   * Una cadena que este cierre no lee: la que `fijarNivel` está por mover a
   * mano en la misma transacción.
   *
   * Leerla dejaba en el historial un salto que se pisaba enseguida —"Subís
   * a…" un eslabón en el que la persona nunca estuvo, justo cuando eligió
   * otro— y gastaba la lectura del día en una decisión que nadie aplicó. Sus
   * series quedan en la sesión, como volumen.
   */
  sinLeer?: Patron
}

/**
 * La sesión ya estaba en el historial: la guardó otra pantalla —la Ficha al
 * cambiar de nivel, o "Guardarla" en otra pestaña— con lo que tenía su
 * borrador. Guardarla otra vez duplicaría sus series, y con ellas el volumen,
 * los récords y la lectura del día.
 */
export class SesionYaGuardada extends Error {
  constructor() {
    super('Esta sesión ya se guardó desde otra pantalla.')
    this.name = 'SesionYaGuardada'
  }
}

/** Las tablas que toca un cierre, para quien lo envuelve en su propia transacción. */
const TABLAS_DEL_CIERRE = [db.sesiones, db.avances, db.estados, db.preferencias, db.pendientes, db.curso]

/**
 * Cierra una sesión: la guarda y hace avanzar (o retroceder) cada patrón que
 * se haya entrenado, una vez por día. Todo pasa dentro de una transacción, así
 * que o queda registrado entero o no queda nada a medias.
 *
 * Acá es donde el chequeo diario se conecta con el motor. No sube ni baja nada
 * por su cuenta: lo único que hace es evitar que una sesión explicada por un
 * mal día quede anotada como una falla de capacidad. El motor decide con muy
 * pocas observaciones, así que proteger esa observación importa más que
 * cualquier puntaje que se le pueda mostrar a la persona.
 */
export async function cerrarSesion(entrada: CierreDeSesion): Promise<ResumenSesion> {
  const conSeries = entrada.registros.filter((r) => r.series.some((s) => s.logrado > 0))
  const tipo: TipoSesion = entrada.tipo ?? 'plan'

  const dia = entrada.fecha ?? fechaISO()

  const sesion: Sesion = {
    id: entrada.idDeLaSesion ?? nuevoId(),
    fecha: dia,
    finalizadaEn: Date.now(),
    duracionSegundos: entrada.duracionSegundos,
    registros: conSeries,
    tipo,
    ...(entrada.nota ? { nota: entrada.nota } : {}),
    ...(entrada.esfuerzo !== undefined ? { esfuerzo: entrada.esfuerzo } : {}),
    ...(entrada.vitalidadPre !== undefined ? { vitalidadPre: entrada.vitalidadPre } : {}),
    ...(entrada.vitalidadPost !== undefined ? { vitalidadPost: entrada.vitalidadPost } : {}),
    ...(entrada.animo !== undefined ? { animo: entrada.animo } : {}),
    // El fuelle se guarda aparte de los registros, y por eso la lectura de
    // abajo ni lo ve: no hay forma de que una ráfaga toque una decisión del motor.
    ...(entrada.rafagas?.length ? { rafagas: entrada.rafagas } : {}),
    ...(entrada.densa ? { densa: true as const } : {}),
  }

  // Todo adentro de una transacción, las lecturas también. Leer afuera y
  // escribir adentro dejaba una ventana: dos cierres casi juntos (dos pestañas,
  // o un borrador guardado mientras se cerraba otra sesión) leían el mismo
  // historial, no se veían entre sí y leían la misma cadena dos veces en el
  // día. `pendientes` va porque `marcarPendiente` escribe ahí. Adentro solo hay
  // lecturas de Dexie y cuentas puras: nada que espere afuera de la base.
  return db.transaction('rw', TABLAS_DEL_CIERRE, async () => {
    if (entrada.idDeLaSesion && (await db.sesiones.get(sesion.id))) throw new SesionYaGuardada()

    const [avances, estados, historial, preferencias, enLaBase] = await Promise.all([
      leerAvances(),
      leerEstados(),
      leerSesiones(),
      leerPreferencias(),
      entrada.cierraElBorrador ? leerSesionEnCurso() : null,
    ])
    // El borrador de la fila es el de esta sesión si lleva su id, o si es uno
    // viejo, sin id. Si es de otra —otra pestaña que escribió encima—, no se
    // toca: ni se borra ni se le toman el origen y la hora.
    const borrador =
      enLaBase && (enLaBase.idDeLaSesion === undefined || enLaBase.idDeLaSesion === sesion.id)
        ? enLaBase
        : null

    // De dónde salió y a qué hora empezó, del borrador que se está cerrando:
    // lo escribió la sesión mientras corría, y la URL que lo sabía ya no está.
    // Un borrador viejo no tiene ninguno de los dos, y no se inventan: el
    // origen lo deduce `origenDe` al leer, y sin hora de inicio se muestra la
    // de cierre, rotulada como tal.
    const iniciadaEn = borrador?.iniciadaEn ?? entrada.iniciadaEn
    if (iniciadaEn !== undefined) sesion.iniciadaEn = iniciadaEn
    if (borrador?.origen) sesion.origen = borrador.origen

    // El estado del día de la sesión, que es el que Entrenar usó para armarla.
    const ajuste = ajusteDelDia(bandaSostenida(estados, dia))
    // El ánimo de los últimos días con sesión, hoy incluido: el motor dice
    // "las últimas sesiones se te hicieron cuesta arriba", y con la respuesta
    // de hoy sola lo decía después de una sola. Día por día también, para que
    // el motor sepa qué daría repetir la respuesta de hoy antes de prometer.
    const animos = animoPorDia([...historial, sesion])
    const animo = promedioDeAnimos(animos)

    /**
     * La barra cargable, o nada.
     *
     * Los tres campos o ninguno: sin el peso corporal los kilos no se traducen
     * a la escala del motor, sin el tope la app propondría un peso que no
     * existe en la casa de la persona, y sin el paso de disco propondría 1,8
     * kg, que no se puede poner con discos de 2,5. Mientras falte cualquiera,
     * el motor se comporta exactamente como antes de que existieran los kilos
     * — que es el caso de quien entrena con el piso y una barra de dominadas,
     * o sea el caso por defecto.
     */
    const barra =
      preferencias.pesoCorporalKg && preferencias.cargaMaximaKg && preferencias.pasoDeDiscoKg
        ? {
            pesoCorporalKg: preferencias.pesoCorporalKg,
            cargaMaximaKg: preferencias.cargaMaximaKg,
            pasoDeDiscoKg: preferencias.pasoDeDiscoKg,
          }
        : undefined

    // Qué registro lee cada cadena, si ya se leyó hoy, la prefatiga y la
    // decisión del motor: todo en `leerLaSesion`, que es lo mismo que corre la
    // simulación. Acá queda lo que sale de la base.
    const lecturas = leerLaSesion({
      registros: conSeries,
      avances,
      dia,
      historial,
      // Qué tipos de sesión mueven el plan lo decide el motor, no esta capa:
      // está en `mueveElPlan`, con las razones y con un test que las cubre.
      neutra: !mueveElPlan(tipo) || ajuste.neutra,
      congeladas: cadenasCongeladas(estados, dia),
      protegida: ajuste.protegida,
      desdeAfuera: entrada.desdeAfuera === true,
      ...(animo !== undefined ? { animo } : {}),
      animoPorDia: animos,
      ...(preferencias.pesoCorporalKg !== undefined
        ? { pesoCorporalKg: preferencias.pesoCorporalKg }
        : {}),
      contextoDe: (patron) => ({
        cadena: cadenaDe(patron),
        ejercicios: POR_ID,
        ...(barra ? { barra } : {}),
        // Lo que el motor no puede abrir aunque se cumpla: lo colgado sin
        // barra, y la palanca frontal antes de las 3 series de 8 dominadas
        // completas. Se calcula con los avances de antes de esta sesión, así
        // que un objetivo de dominadas que llega a 8 hoy abre la palanca
        // desde la próxima.
        cerrados: eslabonesCerrados(cadenaDe(patron), avances, preferencias.tieneBarra !== false),
      }),
      ahora: sesion.finalizadaEn,
    }).filter((lectura) => lectura.patron !== entrada.sinLeer)
    const decisiones: ResumenSesion['decisiones'] = lecturas.map(({ patron, decision, antes }) => ({
      patron,
      decision,
      antes,
    }))

    // Lo que el motor acaba de decidir se guarda con la sesión, no solo se
    // devuelve para pintar el cierre. Se copia el texto y no una referencia: si
    // mañana cambian las reglas, el historial tiene que seguir diciendo lo que
    // la app dijo esa noche.
    if (decisiones.length > 0) {
      sesion.decisiones = decisiones.map(({ patron, decision }) => ({
        patron,
        movimiento: decision.movimiento,
        explicacion: decision.explicacion,
        cambioDeNivel: decision.cambioDeNivel,
        ...(decision.motivo ? { motivo: decision.motivo } : {}),
        ...(decision.leidaA !== undefined ? { leidaA: decision.leidaA } : {}),
      }))
    }

    await db.sesiones.put(sesion)
    await marcarPendiente('sesiones', sesion.id)
    // Una cadena ya leída hoy no se escribe: su avance queda idéntico, la
    // fecha incluida.
    for (const { decision, guardar } of lecturas) {
      if (guardar) await guardarAvance(decision.avance)
    }
    // Adentro y no después: o quedan la sesión guardada y el borrador borrado,
    // o no queda ninguna de las dos cosas y la sesión sigue en pantalla.
    if (borrador) await db.curso.delete('actual')

    return {
      sesion,
      decisiones,
      // Con `cuentaComoSesion`, como el contador de vida: una movilidad no
      // corre el número (§5.6 A). `historial` es de antes de esta sesión.
      numeroDeSesion:
        historial.filter(cuentaComoSesion).length + (cuentaComoSesion(sesion) ? 1 : 0),
      // Con todos los registros y no solo los que tienen series: un paso de
      // cadena sin hacer sigue siendo un paso de cadena.
      pasosDeCadena: pasosQueSiguenTuNivel(entrada.registros, avances),
    }
  })
}

export async function borrarSesion(id: string): Promise<void> {
  await db.sesiones.delete(id)
  await marcarPendiente('sesiones', id, 'borrar')
}

// ─── Rutinas propias ─────────────────────────────────────────────────────

/**
 * Las rutinas armadas por la persona, de la tocada hace menos a la de hace más.
 *
 * Son decenas como mucho: se ordenan y se agrupan por carpeta en memoria, sin
 * índices nuevos.
 */
export async function leerRutinas(): Promise<RutinaPropia[]> {
  return db.rutinas.orderBy('actualizadaEn').reverse().toArray()
}

export async function leerRutina(id: string): Promise<RutinaPropia | undefined> {
  return db.rutinas.get(id)
}

/**
 * Guarda una rutina, nueva o cambiada, con `actualizadaEn` de ahora.
 *
 * La hora la pone esto y no quien llama: es lo que ordena Mis rutinas, y una
 * pantalla que se olvidara de tocarla dejaría la rutina recién editada al
 * fondo de la lista.
 */
export async function guardarRutina(rutina: RutinaPropia): Promise<RutinaPropia> {
  const guardada: RutinaPropia = { ...rutina, actualizadaEn: Date.now() }
  await db.rutinas.put(guardada)
  await marcarPendiente('rutinas', guardada.id)
  return guardada
}

/**
 * Borra una rutina y la devuelve tal como estaba, para Deshacer.
 *
 * Las sesiones que salieron de ella no se tocan: guardan el nombre en su
 * origen, y el historial sigue diciendo lo que eran.
 */
export async function borrarRutina(id: string): Promise<RutinaPropia | undefined> {
  return db.transaction('rw', [db.rutinas, db.pendientes], async () => {
    const rutina = await db.rutinas.get(id)
    if (!rutina) return undefined
    await db.rutinas.delete(id)
    await marcarPendiente('rutinas', id, 'borrar')
    return rutina
  })
}

/**
 * Deshacer un borrado: la rutina vuelve idéntica, con su id, su carpeta y sus
 * horas. No pasa por `guardarRutina` a propósito: tocar `actualizadaEn` la
 * movería en la lista, y deshacer tiene que dejar todo como estaba.
 */
export async function restaurarRutina(rutina: RutinaPropia): Promise<void> {
  await db.rutinas.put(rutina)
  await marcarPendiente('rutinas', rutina.id)
}

// ─── Ajustes manuales ────────────────────────────────────────────────────

/**
 * Mover el nivel a mano. El motor decide solo, pero vos mandás: si ya hacés
 * dominadas y la app te propone remo australiano, corregís y listo.
 *
 * El ejercicio tiene que ser un eslabón de esa cadena (`CADENAS`), no solo del
 * mismo patrón: una variante o un ejercicio de barra con ese patrón dejaría en
 * el avance un id que la cadena no tiene, y la app ya no sabría dónde estás.
 *
 * Si hay una sesión a medio hacer con trabajo adentro, primero se cierra con
 * lo hecho, desde afuera (`alCambiarDeNivel`): sus series quedan guardadas y
 * las lee el motor que tenía esa sesión, menos la cadena que se está moviendo
 * (`sinLeer`), cuya lectura se pisaría en el acto. Antes se tiraba, porque
 * Entrenar la habría rearmado con el eslabón nuevo y las series del viejo
 * quedaban afuera; tirarla era perderlas igual. Una vacía se tira, que no
 * tiene nada que guardar. Las dos cosas y el nivel nuevo van en una sola
 * transacción.
 */
export async function fijarNivel(patron: Patron, ejercicioId: string): Promise<Avance> {
  const ejercicio = POR_ID.get(ejercicioId)
  if (!ejercicio || !cadenaDe(patron).ejercicios.includes(ejercicioId)) {
    throw new Error(`"${ejercicioId}" no es un eslabón de la cadena de ${patron}.`)
  }

  return db.transaction('rw', TABLAS_DEL_CIERRE, async () => {
    const borrador = await leerSesionEnCurso()
    if (borrador) {
      // La cadena que se mueve acá no se lee en ese cierre: su avance lo
      // escribe esto, dos líneas más abajo.
      if (alCambiarDeNivel(borrador) === 'cerrar') await cerrarBorradorDesdeAfuera(patron)
      else await descartarSesionEnCurso()
    }

    const avance: Avance = {
      patron,
      ejercicioId,
      objetivoActual: { series: ejercicio.series, cantidad: ejercicio.ventana.min },
      senal: 1,
      sesionesEnObjetivo: 0,
      graciaRestante: 0,
      actualizadoEn: Date.now(),
    }
    await guardarAvance(avance)
    return avance
  })
}

export async function ajustarObjetivo(patron: Patron, objetivo: Objetivo): Promise<Avance> {
  // Con otro objetivo, las protegidas de antes no hablan de este.
  const { protegidasSeguidas, ...avance } = await leerAvance(patron)
  void protegidasSeguidas
  const actualizado: Avance = { ...avance, objetivoActual: objetivo, actualizadoEn: Date.now() }
  await guardarAvance(actualizado)
  return actualizado
}

/**
 * La barra de dominadas, que se cambia en Ajustes.
 *
 * Apagarla no es solo una preferencia: lo que estaba colgado baja al último
 * eslabón que no cuelga (`bajarDeLoColgado`), en la misma transacción. Si no,
 * el interruptor diría que el plan no pide nada colgado mientras Hoy sigue
 * mostrando dominadas. Prenderla no mueve nada: el motor sube solo cuando
 * corresponde.
 *
 * El borrador de una sesión a medio hacer no se toca, a diferencia de
 * `fijarNivel`: tirarlo perdería las series de todos los demás ejercicios por
 * uno que, sin barra, no se podía hacer.
 */
export async function cambiarBarraDeDominadas(tieneBarra: boolean): Promise<void> {
  await db.transaction('rw', db.preferencias, db.avances, db.pendientes, async () => {
    await guardarPreferencias({ tieneBarra })
    if (tieneBarra) return
    const ahora = Date.now()
    for (const avance of await db.avances.toArray()) {
      const abajo = bajarDeLoColgado(avance, ahora)
      if (abajo) await guardarAvance(abajo)
    }
  })
}

/**
 * Guarda el punto de partida que salió del test de nivel del alta.
 *
 * Es la única escritura del alta y es lo que evita que alguien que ya hace
 * quince flexiones abra la app y le proponga la pared. La cuenta, con sus
 * techos, es la misma que el alta muestra: `ubicarDesdeElAlta`.
 *
 * Deja escrita también la revisión de los requisitos, vacía: el alta ya ubica
 * con los requisitos de ahora, así que no hay nada que revisar, y sin esto la
 * revisión correría igual en el primer arranque después del alta.
 */
export async function ubicarDesdePrueba(
  pruebas: PruebaDelAlta[],
  tieneBarra: boolean,
): Promise<void> {
  const ahora = Date.now()
  const avances = ubicarDesdeElAlta(pruebas, tieneBarra, ahora)

  await db.transaction('rw', db.avances, db.preferencias, db.pendientes, async () => {
    for (const avance of avances) await guardarAvance(avance)
    await guardarPreferencias({ revisionDeRequisitos: { en: ahora, bajadas: [] } })
  })
}

/**
 * El alta sin prueba: "Prefiero arrancar desde cero".
 *
 * También deja escrita la revisión de los requisitos, vacía, por lo mismo que
 * `ubicarDesdePrueba`: es una instalación nueva y la regla vieja nunca la
 * tocó. Sin esto la revisión corría en el segundo arranque, y a quien entre
 * tanto se hubiera puesto en la palanca a mano desde la ficha —"el motor
 * decide solo, pero vos mandás"— lo bajaba con un aviso que habla de una
 * regla vieja que nunca le tocó.
 */
export async function saltearElAlta(tieneBarra: boolean): Promise<void> {
  const ahora = Date.now()
  await guardarPreferencias({
    altaCompletadaEn: ahora,
    tieneBarra,
    revisionDeRequisitos: { en: ahora, bajadas: [] },
  })
}

/**
 * La revisión única de los eslabones con requisito. Corre al abrir la app.
 *
 * La palanca frontal pide ahora 3 series de 8 dominadas completas, y antes se
 * abría con llegar a ellas; el alta, además, llegó a ubicar ahí a gente con
 * cero dominadas. Quien quedó sentado en la palanca sin cumplir baja una vez
 * al último eslabón abierto (`bajarPorRequisito`), y Hoy le dice por qué
 * hasta la próxima sesión (`avisosDeLaRevision`).
 *
 * Una sola vez por instalación, y eso lo decide `revisionDeRequisitos`: si
 * corriera en cada arranque, un mal día de dominadas que baja el objetivo de
 * 8 echaría de la palanca a quien ya la venía haciendo. Todo en una
 * transacción: o baja y queda anotado, o no pasa nada y se vuelve a intentar
 * en el próximo arranque.
 *
 * No corre antes del alta —no hay nada que revisar, y el alta escribe la
 * revisión vacía— ni con una sesión por cerrar (`quedaPorCerrar`): cambiar el
 * core en medio de la sesión dejaría huérfanas las series ya anotadas, y con
 * una vencida que Hoy ofrece guardar, bajaría el core justo antes de que
 * "Guardarla" sumara las dominadas que lo mantenían. Espera al próximo
 * arranque, que es lo mismo que hace la persona.
 */
export async function revisarRequisitosUnaVez(): Promise<void> {
  await db.transaction(
    'rw',
    [db.preferencias, db.avances, db.pendientes, db.curso],
    async () => {
      const preferencias = await leerPreferencias()
      if (!preferencias.altaCompletadaEn || preferencias.revisionDeRequisitos) return

      const ahora = Date.now()
      const borrador = await db.curso.get('actual')
      // Espera a la sesión que se retoma y también a la vencida que Hoy ofrece
      // guardar: "Guardarla" la cierra con el motor de esa noche, y si esa
      // sesión llevaba las dominadas a 3×8, la palanca ya no tiene por qué
      // cerrarse. Además, guardarla después de la bajada apagaría el aviso
      // de por qué bajó. Una vencida y vacía no frena nada.
      if (borrador && quedaPorCerrar(borrador, ahora)) return

      const { avances, bajadas } = bajarPorRequisito(
        await leerAvances(),
        preferencias.tieneBarra !== false,
        ahora,
      )
      for (const avance of avances) await guardarAvance(avance)
      await guardarPreferencias({ revisionDeRequisitos: { en: ahora, bajadas } })
    },
  )
}

// ─── Copia de seguridad ──────────────────────────────────────────────────

export interface Respaldo {
  version: 4
  exportadoEn: string
  sesiones: Sesion[]
  avances: Avance[]
  estados: Estado[]
  preferencias: Preferencias
  /**
   * El diario de comida y sueño.
   *
   * Entra en la versión 3 y llega tarde: la tabla se agregó en la v4 de la
   * base y esta interfaz se quedó en cuatro tablas, así que durante un tiempo
   * ninguna copia —ni la manual ni la automática— contenía una sola fila del
   * diario. Meses de sueño, proteína y cafeína que no estaban en ningún
   * archivo, sin servidor del que recuperarlos, justo en la función cuyo
   * comentario dice ser "la forma de no perderlos nunca".
   *
   * La regla que esto deja escrita: **cada tabla nueva de Dexie entra acá en
   * el mismo commit que la crea.** No hay ningún mecanismo que lo recuerde,
   * así que lo recuerda el test de ida y vuelta.
   */
  diario: DiaDelDiario[]
  /** Las rutinas propias, desde la versión 4. Entraron con su tabla, en el mismo commit. */
  rutinas: RutinaPropia[]
}

/**
 * Exporta todo a un objeto plano. Mientras no haya sincronización real, este
 * archivo es la forma de pasar tus datos de un dispositivo a otro — y la forma
 * de no perderlos nunca, que importa más.
 */
export async function exportarTodo(): Promise<Respaldo> {
  const [sesiones, avances, estados, preferencias, diario, rutinas] = await Promise.all([
    db.sesiones.toArray(),
    db.avances.toArray(),
    db.estados.toArray(),
    leerPreferencias(),
    db.diario.toArray(),
    db.rutinas.toArray(),
  ])

  return {
    version: 4,
    exportadoEn: new Date().toISOString(),
    sesiones,
    avances,
    estados,
    preferencias,
    diario,
    rutinas,
  }
}

/** Errores de importación que le sirven a la persona, no al programador. */
export class RespaldoInvalido extends Error {}

/**
 * Revisa un archivo fila por fila y lo devuelve en la forma de hoy.
 *
 * La revisión entera está en `revisarCopia`, en el dominio. Antes acá solo se
 * miraba la versión y que hubiera dos listas, y una sesión sin `registros`
 * pasaba y dejaba Hoy y Progreso en blanco para siempre. Una copia vieja se
 * sigue pudiendo leer: lo que no existía cuando se hizo entra vacío.
 */
export function validarRespaldo(dato: unknown): Respaldo {
  const revision = revisarCopia(dato)
  if ('problema' in revision) throw new RespaldoInvalido(revision.problema)
  return revision.copia
}

/**
 * Importa una copia reemplazando lo que haya. Todo o nada: si algo falla, la
 * base queda como estaba.
 *
 * No pregunta nada: esto pisa los datos y la que pregunta es la pantalla.
 * Ajustes muestra lo que trae el archivo al lado de lo que se reemplaza, pide
 * confirmación y guarda antes una copia automática de lo que había
 * (`respaldarAntesDeRestaurar`). Quien llame acá desde otro lado tiene que
 * hacer lo mismo.
 */
export async function importarTodo(respaldo: Respaldo): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.sesiones,
      db.avances,
      db.estados,
      db.preferencias,
      db.pendientes,
      db.curso,
      db.diario,
      db.rutinas,
    ],
    async () => {
      await Promise.all([
        db.sesiones.clear(),
        db.avances.clear(),
        db.estados.clear(),
        db.preferencias.clear(),
        // El diario también se limpia, y no es una formalidad: sin esto,
        // restaurar una copia sobre un teléfono que ya venía usando la app
        // dejaba las filas viejas del diario pegadas a un historial ajeno, con
        // el sueño de una línea de tiempo y las sesiones de otra.
        db.diario.clear(),
        // Y el borrador: viene de un plan que la copia que se está restaurando
        // no conoce, así que retomarlo sería anotar contra otro historial.
        db.curso.clear(),
        // Las rutinas, por lo mismo que el diario: las de antes no pueden
        // quedar pegadas a un historial que no es el suyo.
        db.rutinas.clear(),
        // Y la cola de sincronización, como en `borrarTodo`: nombra filas que
        // ya no existen.
        db.pendientes.clear(),
      ])
      await db.sesiones.bulkPut(respaldo.sesiones)
      await db.avances.bulkPut(respaldo.avances)
      if (respaldo.estados?.length) await db.estados.bulkPut(respaldo.estados)
      if (respaldo.diario?.length) await db.diario.bulkPut(respaldo.diario)
      if (respaldo.rutinas?.length) await db.rutinas.bulkPut(respaldo.rutinas)
      if (respaldo.preferencias) await db.preferencias.put(respaldo.preferencias)
    },
  )
}

/**
 * La carpeta de las copias automáticas, en el almacenamiento privado del
 * sitio. Vive acá y no en `respaldo.ts` porque `borrarTodo` la tiene que
 * borrar, y `respaldo.ts` ya depende de este archivo.
 */
export const CARPETA_DE_COPIAS = 'respaldos'

/**
 * Borra la carpeta de las copias automáticas entera.
 *
 * Sin sistema de archivos privado —o si el navegador no deja abrirlo— tampoco
 * pudo haber copias: se escriben por el mismo camino. Que la carpeta no
 * exista es el resultado buscado, no un error. Cualquier otra falla se
 * propaga, para que la pantalla no diga "Listo" sobre algo que quedó.
 */
async function borrarCopiasAutomaticas(): Promise<void> {
  type Raiz = { removeEntry(nombre: string, opciones?: { recursive?: boolean }): Promise<void> }
  const almacen = (globalThis.navigator as { storage?: { getDirectory?: () => Promise<Raiz> } })
    ?.storage
  if (!almacen?.getDirectory) return

  let raiz: Raiz
  try {
    raiz = await almacen.getDirectory()
  } catch {
    return
  }
  try {
    await raiz.removeEntry(CARPETA_DE_COPIAS, { recursive: true })
  } catch (error) {
    if ((error as { name?: string } | null)?.name !== 'NotFoundError') throw error
  }
}

/**
 * "Borrar todos mis datos": la base y las copias automáticas.
 *
 * Las copias primero. Antes no se tocaban: la carpeta `respaldos` quedaba con
 * el historial, los niveles y las preferencias adentro, y la pantalla decía
 * "No quedó nada". Y van primero por una razón práctica: borrar la base
 * manda al alta en el acto, así que si algo falla tiene que fallar antes,
 * con la persona todavía en Ajustes para leer el error.
 */
export async function borrarTodo(): Promise<void> {
  await borrarCopiasAutomaticas()
  await db.transaction(
    'rw',
    [
      db.sesiones,
      db.avances,
      db.estados,
      db.preferencias,
      db.pendientes,
      db.curso,
      db.diario,
      db.rutinas,
    ],
    async () => {
      await Promise.all([
        db.sesiones.clear(),
        db.avances.clear(),
        db.estados.clear(),
        db.preferencias.clear(),
        db.pendientes.clear(),
        db.curso.clear(),
        // El diario. Sin esto, "Listo. No quedó nada" era mentira: quedaba el
        // registro de qué comió, cuánto durmió y cuánto tomó cada día. De
        // todas las tablas, la que alguien que toca "borrar todo" más quiere
        // que desaparezca.
        db.diario.clear(),
        db.rutinas.clear(),
      ])
    },
  )
}
