/**
 * El repositorio: la única puerta entre la app y la base.
 *
 * Ningún componente le habla a Dexie directamente. Eso parece burocracia hasta
 * el día que quieras cambiar dónde se guardan los datos: cambiás este archivo
 * y no se entera nadie más.
 */

import { db, marcarPendiente, PREFERENCIAS_POR_DEFECTO } from './db'
import type {
  Avance,
  Estado,
  Objetivo,
  Patron,
  Preferencias,
  RegistroEjercicio,
  Sesion,
  TipoSesion,
} from '@/dominio/tipos'
import { CADENAS, POR_ID, cadenaDe } from '@/dominio/biblioteca'
import {
  avanceInicial,
  logradoTipico,
  rendimientoDeSesion,
  siguienteAvance,
  ubicarEnCadena,
  type Decision,
} from '@/dominio/progresion'
import { ajusteDelDia, bandaSostenida, cadenasCongeladas } from '@/dominio/estado'
import { animoReciente } from '@/dominio/vitalidad'

/** Fecha local en formato AAAA-MM-DD, sin arrastrar la zona horaria de UTC. */
export function fechaISO(fecha: Date = new Date()): string {
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dd(fecha.getMonth() + 1)}-${dd(fecha.getDate())}`
}

function nuevoId(): string {
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
  const guardados = await db.avances.toArray()
  const mapa = new Map<Patron, Avance>(guardados.map((a) => [a.patron, a]))

  for (const cadena of CADENAS) {
    if (!mapa.has(cadena.patron)) {
      // Fecha 0 a propósito: es un avance que todavía no se guardó nunca, y un
      // Date.now() acá haría que cada lectura devolviera un objeto distinto.
      mapa.set(cadena.patron, avanceInicial(cadena, POR_ID, 0))
    }
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

export async function guardarEstado(
  datos: Omit<Estado, 'actualizadoEn'>,
): Promise<Estado> {
  const estado: Estado = { ...datos, actualizadoEn: Date.now() }
  await db.estados.put(estado)
  await marcarPendiente('estados', estado.fecha)
  return estado
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

/** Lo que devuelve cerrar una sesión: qué cambió en cada patrón entrenado. */
export interface ResumenSesion {
  sesion: Sesion
  decisiones: { patron: Patron; decision: Decision }[]
  /** El número de sesión en la vida de esta persona. */
  numeroDeSesion: number
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
}

/**
 * Cierra una sesión: la guarda y hace avanzar (o retroceder) cada patrón que
 * se haya entrenado. Todo pasa dentro de una transacción, así que o queda
 * registrado entero o no queda nada a medias.
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

  const sesion: Sesion = {
    id: nuevoId(),
    fecha: fechaISO(),
    finalizadaEn: Date.now(),
    duracionSegundos: entrada.duracionSegundos,
    registros: conSeries,
    tipo,
    ...(entrada.nota ? { nota: entrada.nota } : {}),
    ...(entrada.esfuerzo !== undefined ? { esfuerzo: entrada.esfuerzo } : {}),
    ...(entrada.vitalidadPre !== undefined ? { vitalidadPre: entrada.vitalidadPre } : {}),
    ...(entrada.vitalidadPost !== undefined ? { vitalidadPost: entrada.vitalidadPost } : {}),
    ...(entrada.animo !== undefined ? { animo: entrada.animo } : {}),
  }

  const [avances, estados, historial] = await Promise.all([
    leerAvances(),
    leerEstados(),
    leerSesiones(),
  ])

  const hoy = fechaISO()
  const ajuste = ajusteDelDia(bandaSostenida(estados, hoy))
  const congeladas = cadenasCongeladas(estados, hoy)
  const animo = entrada.animo ?? animoReciente(historial)

  const decisiones: ResumenSesion['decisiones'] = []

  for (const registro of conSeries) {
    const ejercicio = POR_ID.get(registro.ejercicioId)
    if (!ejercicio) continue

    const avance = avances.get(ejercicio.patron)
    // Solo progresa el patrón si se entrenó el ejercicio que tocaba. Meter una
    // flexión suelta un domingo no debería mover el plan.
    if (!avance || avance.ejercicioId !== ejercicio.id) continue

    // Una sesión corta cuenta para la adherencia y no para la progresión: seis
    // minutos no dicen nada sobre si alguien está listo para el eslabón que
    // sigue, y castigar por haber hecho algo es la peor lección posible.
    const neutra = tipo === 'corta' || ajuste.neutra || congeladas.has(ejercicio.patron)

    const decision = siguienteAvance(
      avance,
      {
        rendimiento: rendimientoDeSesion(registro.objetivo, registro.series),
        tipico: logradoTipico(registro.series),
        neutra,
        protegida: ajuste.protegida,
        ...(animo !== undefined ? { animo } : {}),
      },
      { cadena: cadenaDe(ejercicio.patron), ejercicios: POR_ID },
    )

    decisiones.push({ patron: ejercicio.patron, decision })
  }

  await db.transaction('rw', db.sesiones, db.avances, db.pendientes, async () => {
    await db.sesiones.put(sesion)
    await marcarPendiente('sesiones', sesion.id)
    for (const { decision } of decisiones) {
      await guardarAvance(decision.avance)
    }
  })

  return { sesion, decisiones, numeroDeSesion: historial.length + 1 }
}

export async function borrarSesion(id: string): Promise<void> {
  await db.sesiones.delete(id)
  await marcarPendiente('sesiones', id, 'borrar')
}

// ─── Ajustes manuales ────────────────────────────────────────────────────

/**
 * Mover el nivel a mano. El motor decide solo, pero vos mandás: si ya hacés
 * dominadas y la app te propone remo australiano, corregís y listo.
 */
export async function fijarNivel(patron: Patron, ejercicioId: string): Promise<Avance> {
  const ejercicio = POR_ID.get(ejercicioId)
  if (!ejercicio || ejercicio.patron !== patron) {
    throw new Error(`"${ejercicioId}" no pertenece a la cadena de ${patron}.`)
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
}

export async function ajustarObjetivo(patron: Patron, objetivo: Objetivo): Promise<Avance> {
  const avance = await leerAvance(patron)
  const actualizado: Avance = { ...avance, objetivoActual: objetivo, actualizadoEn: Date.now() }
  await guardarAvance(actualizado)
  return actualizado
}

/**
 * Guarda el punto de partida que salió del test de nivel del alta.
 *
 * Es la única escritura del alta y es lo que evita que alguien que ya hace
 * quince flexiones abra la app y le proponga la pared.
 */
export async function ubicarDesdePrueba(
  pruebas: { patron: Patron; ejercicioId: string; logrado: number }[],
): Promise<void> {
  const ahora = Date.now()
  const avances = pruebas.map(({ patron, ejercicioId, logrado }) =>
    ubicarEnCadena(cadenaDe(patron), POR_ID, ejercicioId, logrado, ahora),
  )

  await db.transaction('rw', db.avances, db.pendientes, async () => {
    for (const avance of avances) await guardarAvance(avance)
  })
}

// ─── Copia de seguridad ──────────────────────────────────────────────────

export interface Respaldo {
  version: 2
  exportadoEn: string
  sesiones: Sesion[]
  avances: Avance[]
  estados: Estado[]
  preferencias: Preferencias
}

/**
 * Exporta todo a un objeto plano. Mientras no haya sincronización real, este
 * archivo es la forma de pasar tus datos de un dispositivo a otro — y la forma
 * de no perderlos nunca, que importa más.
 */
export async function exportarTodo(): Promise<Respaldo> {
  const [sesiones, avances, estados, preferencias] = await Promise.all([
    db.sesiones.toArray(),
    db.avances.toArray(),
    db.estados.toArray(),
    leerPreferencias(),
  ])

  return { version: 2, exportadoEn: new Date().toISOString(), sesiones, avances, estados, preferencias }
}

/** Errores de importación que le sirven a la persona, no al programador. */
export class RespaldoInvalido extends Error {}

export function validarRespaldo(dato: unknown): Respaldo {
  if (typeof dato !== 'object' || dato === null) {
    throw new RespaldoInvalido('El archivo no tiene el formato de una copia de LyraFit.')
  }

  const posible = dato as Omit<Partial<Respaldo>, 'version'> & { version?: number }

  if (posible.version !== 1 && posible.version !== 2) {
    throw new RespaldoInvalido('La copia es de una versión que esta app todavía no entiende.')
  }
  if (!Array.isArray(posible.sesiones) || !Array.isArray(posible.avances)) {
    throw new RespaldoInvalido('A la copia le faltan las sesiones o los avances.')
  }

  // Una copia de la versión 1 se puede leer igual: le falta el chequeo diario
  // y el tipo de sesión, y las dos cosas tienen un valor por defecto sensato.
  return {
    ...posible,
    version: 2,
    estados: posible.estados ?? [],
    sesiones: posible.sesiones.map((s) => ({ ...s, tipo: s.tipo ?? 'plan' })),
  } as Respaldo
}

/**
 * Importa una copia reemplazando lo que haya. Se pide confirmación explícita
 * en la pantalla antes de llamar acá: esto pisa los datos.
 */
export async function importarTodo(respaldo: Respaldo): Promise<void> {
  await db.transaction(
    'rw',
    db.sesiones,
    db.avances,
    db.estados,
    db.preferencias,
    db.pendientes,
    async () => {
      await Promise.all([
        db.sesiones.clear(),
        db.avances.clear(),
        db.estados.clear(),
        db.preferencias.clear(),
      ])
      await db.sesiones.bulkPut(respaldo.sesiones)
      await db.avances.bulkPut(respaldo.avances)
      if (respaldo.estados?.length) await db.estados.bulkPut(respaldo.estados)
      if (respaldo.preferencias) await db.preferencias.put(respaldo.preferencias)
    },
  )
}

export async function borrarTodo(): Promise<void> {
  await db.transaction(
    'rw',
    db.sesiones,
    db.avances,
    db.estados,
    db.preferencias,
    db.pendientes,
    async () => {
      await Promise.all([
        db.sesiones.clear(),
        db.avances.clear(),
        db.estados.clear(),
        db.preferencias.clear(),
        db.pendientes.clear(),
      ])
    },
  )
}
