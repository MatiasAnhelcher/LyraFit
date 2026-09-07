/**
 * El chequeo diario y su índice.
 *
 * Tres preguntas, quince segundos: cómo dormiste, cómo está tu energía, cómo
 * andan tus músculos. De ahí sale un índice con línea de base propia.
 *
 * Dos advertencias que valen más que la fórmula:
 *
 * **El uso más valioso de esto no es mostrar un número.** Es impedir que el
 * motor de progresión le baje el objetivo a alguien por dos días malos. El
 * motor decide con muy pocas observaciones; si una está contaminada por algo
 * transitorio y conocido, la decisión es inválida por construcción. Eso cuesta
 * un `if` y elimina el modo de falla más frustrante que puede tener la app.
 *
 * **El silencio es la respuesta correcta la mayoría de los días.** Alrededor
 * de dos tercios de las jornadas de cualquier persona son normales, y una app
 * que encuentra algo para decir todos los días no tiene con qué subir el
 * volumen el día que de verdad importa. Por eso hay banda muerta, umbral de
 * arranque y regla de persistencia: para callarse.
 *
 * Todas las constantes son decisiones de diseño justificadas, no valores
 * validados en un laboratorio. La app no las presenta como si lo fueran.
 */

import type { Estado, Patron } from './tipos'

// ─── Constantes ──────────────────────────────────────────────────────────

/** Ventana lenta: la línea de base. Vida media de unos diez días. */
const LAMBDA_LENTO = 2 / (28 + 1)

/** Ventana rápida: la tendencia. Vida media de dos días y medio. */
const LAMBDA_RAPIDO = 2 / (7 + 1)

/** Piso del desvío: sin esto, alguien muy regular tendría un z enorme por nada. */
const SIGMA_MINIMO = 0.05

/** Techo del desvío, para que un mes caótico no anestesie el índice. */
const SIGMA_MAXIMO = 0.25

/** Tope del peso de una entrada después de un hueco largo. */
const ALFA_MAXIMO = 0.5

/** Entradas mínimas antes de mostrar nada. Por debajo, el denominador es ruido. */
export const ENTRADAS_MINIMAS = 14

/** Días sin registrar después de los cuales la línea de base ya no describe a nadie. */
export const DIAS_PARA_RANCIO = 10

/** Cuántas de las últimas tres entradas tienen que coincidir para actuar. */
export const PERSISTENCIA = 2

// ─── Cálculo ─────────────────────────────────────────────────────────────

export type Banda = 'verde' | 'normal' | 'ambar' | 'rojo'

export interface Lectura {
  banda: Banda
  /** El z combinado. Es interno: la app muestra palabras, no este número. */
  z: number
  /** Cuántas entradas hay. */
  entradas: number
  /** True si hay suficientes datos y son recientes. */
  confiable: boolean
  /** Entradas que faltan para tener línea de base, si todavía no la hay. */
  faltan: number
  /** La zona con molestia puntual, si la hay hoy. Gana sobre todo lo demás. */
  molestia?: Patron
}

/** Normaliza un ítem de 1 a 5 al rango 0-1. */
function normalizar(valor: number): number {
  return (Math.min(Math.max(valor, 1), 5) - 1) / 4
}

/** El compuesto de un día: los tres ítems con el mismo peso. */
export function compuesto(estado: Estado): number {
  return (
    (normalizar(estado.sueno) + normalizar(estado.energia) + normalizar(estado.musculos)) / 3
  )
}

function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`).getTime()
  const b = new Date(`${hasta}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * El peso de una entrada, ajustado por cuántos días pasaron desde la anterior.
 *
 * Sin esto, un hueco de tres semanas y un día de diferencia pesarían igual. Con
 * el tope, una sola entrada después de un hueco largo no puede redefinir sola
 * toda la referencia.
 */
function alfa(lambda: number, dias: number): number {
  return Math.min(1 - Math.pow(1 - lambda, Math.max(1, dias)), ALFA_MAXIMO)
}

function acotar(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/**
 * Recorre el historial y devuelve la lectura de hoy.
 *
 * El estado —media, varianza, tendencia— se recalcula entero cada vez en vez
 * de guardarse. Cinco años de uso son menos de dos mil filas y una pasada
 * lineal: cuesta milisegundos, y a cambio se puede cambiar una constante o
 * corregir un error de la fórmula sin corromper el historial de nadie.
 */
export function leerEstado(historial: Estado[], hoy: string): Lectura {
  const orden = [...historial].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const entradas = orden.length
  const vacia: Lectura = {
    banda: 'normal',
    z: 0,
    entradas,
    confiable: false,
    faltan: Math.max(0, ENTRADAS_MINIMAS - entradas),
  }

  const ultima = orden[orden.length - 1]
  if (!ultima) return vacia

  const molestia = ultima.fecha === hoy ? ultima.molestia : undefined

  if (entradas < ENTRADAS_MINIMAS) return { ...vacia, molestia }
  if (diasEntre(ultima.fecha, hoy) > DIAS_PARA_RANCIO) {
    return { ...vacia, faltan: 5, molestia }
  }

  // Arranque: media de las primeras siete, varianza de las primeras catorce.
  const valores = orden.map(compuesto)
  const primeras7 = valores.slice(0, 7)
  let mu = primeras7.reduce((a, b) => a + b, 0) / primeras7.length
  let rapida = mu

  const primeras14 = valores.slice(0, ENTRADAS_MINIMAS)
  const mediaInicial = primeras14.reduce((a, b) => a + b, 0) / primeras14.length
  let varianza =
    primeras14.reduce((suma, v) => suma + (v - mediaInicial) ** 2, 0) /
    (primeras14.length - 1)

  let z = 0
  for (let i = ENTRADAS_MINIMAS; i < orden.length; i++) {
    const actual = orden[i]!
    const previa = orden[i - 1]!
    const dias = Math.max(1, diasEntre(previa.fecha, actual.fecha))
    const w = valores[i]!

    // El z se calcula ANTES de actualizar el estado. Al revés, la línea de base
    // persigue al dato y todos los z se achican hacia cero.
    const sigma = acotar(Math.sqrt(Math.max(varianza, 0)), SIGMA_MINIMO, SIGMA_MAXIMO)
    const zHoy = acotar((w - mu) / sigma, -4, 4)

    const aLento = alfa(LAMBDA_LENTO, dias)
    const aRapido = alfa(LAMBDA_RAPIDO, dias)
    const muPrevia = mu
    mu = (1 - aLento) * mu + aLento * w
    // La desviación va contra la media PREVIA: usar la nueva sesga la varianza
    // hacia abajo y hace que todo parezca más estable de lo que es.
    varianza = (1 - aLento) * varianza + aLento * (w - muPrevia) ** 2
    rapida = (1 - aRapido) * rapida + aRapido * w

    const zTendencia = acotar((rapida - mu) / sigma, -4, 4)
    z = 0.6 * zHoy + 0.4 * zTendencia
  }

  return { banda: bandaDe(z), z, entradas, confiable: true, faltan: 0, molestia }
}

function bandaDe(z: number): Banda {
  if (z >= 1) return 'verde'
  if (z > -1) return 'normal'
  if (z > -1.5) return 'ambar'
  return 'rojo'
}

/**
 * La banda, exigiendo que se sostenga.
 *
 * Un día malo suelto no cambia el entrenamiento: si lo hiciera, la app estaría
 * reaccionando a ruido y perdería credibilidad rápido. Dos de las últimas tres
 * es la misma filosofía que ya usa el motor de progresión, así que además se
 * explica con las mismas palabras.
 */
export function bandaSostenida(historial: Estado[], hoy: string): Banda {
  const lectura = leerEstado(historial, hoy)
  if (!lectura.confiable) return 'normal'
  if (lectura.banda === 'verde' || lectura.banda === 'normal') return lectura.banda

  const orden = [...historial].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimas = orden.slice(-3)
  const malas = ultimas.filter((e) => {
    const parcial = leerEstado(
      orden.slice(0, orden.indexOf(e) + 1),
      e.fecha,
    )
    return parcial.banda === 'ambar' || parcial.banda === 'rojo'
  }).length

  return malas >= PERSISTENCIA ? lectura.banda : 'normal'
}

/** Cuánto se recorta el objetivo del día cuando la banda es ámbar. */
export const RECORTE_AMBAR = 0.9

export interface AjusteDelDia {
  /** Multiplicador sobre el objetivo. */
  factor: number
  /** True si la sesión no debe contar como fallo. */
  protegida: boolean
  /** True si la sesión no mueve la progresión en ningún sentido. */
  neutra: boolean
  /** Qué decirle a la persona, o null para no decir nada. */
  mensaje: string | null
}

/**
 * Qué hace el índice con el entrenamiento de hoy.
 *
 * Nunca cancela una sesión: si alguien quiere entrenar, entrena — es su cuerpo.
 * Lo único que hace es bajar un poco el objetivo y, sobre todo, evitar que un
 * mal día quede registrado como una falla de capacidad.
 */
export function ajusteDelDia(banda: Banda): AjusteDelDia {
  switch (banda) {
    case 'rojo':
      return {
        factor: RECORTE_AMBAR,
        protegida: true,
        neutra: true,
        mensaje:
          'Venís arrastrando varios días flojos. Si entrenás, la sesión de hoy no cuenta ni a favor ni en contra de tu progresión.',
      }
    case 'ambar':
      return {
        factor: RECORTE_AMBAR,
        protegida: true,
        neutra: false,
        mensaje:
          'Hoy bajamos un poco el objetivo. Si igual lo cumplís, cuenta como cualquier otra sesión.',
      }
    case 'verde':
      return { factor: 1, protegida: false, neutra: false, mensaje: null }
    default:
      // El caso más común, y el que más importa: no pasa nada y no se dice nada.
      return { factor: 1, protegida: false, neutra: false, mensaje: null }
  }
}

/**
 * ¿Hay que congelar una cadena por molestia puntual?
 *
 * Dolor muscular parejo es parte de entrenar. Una molestia en un lugar
 * concreto es otra cosa, y ahí la app no sube ni baja nada en esa cadena hasta
 * que deje de aparecer. No diagnostica: solo deja de empujar.
 */
export function cadenasCongeladas(historial: Estado[], hoy: string): Set<Patron> {
  const recientes = [...historial]
    .filter((e) => {
      const d = diasEntre(e.fecha, hoy)
      return d >= 0 && d <= 6
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const congeladas = new Set<Patron>()
  for (const patron of new Set(recientes.map((e) => e.molestia).filter(Boolean))) {
    const ultimasTres = recientes.slice(0, 3)
    const sigue = ultimasTres.some((e) => e.molestia === patron)
    if (sigue && patron) congeladas.add(patron)
  }
  return congeladas
}
