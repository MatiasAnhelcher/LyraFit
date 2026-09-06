/**
 * Tipos del dominio.
 *
 * Todo el vocabulario de la app vive acá y está en castellano a propósito:
 * cuando el código habla el mismo idioma que el entrenamiento, se lee sin
 * traducir mentalmente cada vez.
 */

/** Los cuatro patrones de movimiento sobre los que se arma el entrenamiento. */
export type Patron = 'empuje' | 'traccion' | 'piernas' | 'core'

/**
 * Un ejercicio se mide por repeticiones (flexiones) o por tiempo de sostén
 * (plancha, palanca). Cambia la unidad, no la lógica de progresión.
 */
export type Medida = 'repeticiones' | 'segundos'

/** Cuánto hay que hacer de un ejercicio para considerarlo dominado. */
export interface Objetivo {
  series: number
  /** Repeticiones o segundos por serie, según la medida del ejercicio. */
  cantidad: number
}

export interface Ejercicio {
  id: string
  nombre: string
  patron: Patron
  medida: Medida
  /**
   * Posición dentro de su cadena de progresión, empezando en 1.
   * Es lo que permite avanzar y retroceder de nivel sin listas sueltas.
   */
  nivel: number
  /** Una línea que explica de qué se trata el ejercicio. */
  resumen: string
  /** Cómo se ejecuta, paso a paso. */
  tecnica: string[]
  /** Los errores que aparecen siempre y arruinan el ejercicio. */
  erroresComunes: string[]
  /** Qué hay que lograr para pasar al siguiente nivel de la cadena. */
  objetivo: Objetivo
  /** Con cuánto se arranca al llegar recién a este nivel. */
  entrada: Objetivo
  /** Segundos de descanso sugeridos entre series. */
  descansoSegundos: number
}

/**
 * Una cadena de progresión: los ejercicios de un patrón ordenados de más
 * accesible a más exigente. Es la columna vertebral de la app.
 */
export interface Cadena {
  patron: Patron
  nombre: string
  descripcion: string
  /** Ids de ejercicios, ordenados por nivel ascendente. */
  ejercicios: string[]
}

/** Una serie efectivamente realizada y registrada. */
export interface Serie {
  /** Repeticiones o segundos logrados. */
  logrado: number
  /** Esfuerzo percibido del 1 al 10. Opcional: se puede registrar sin esto. */
  esfuerzo?: number
}

/** El registro de un ejercicio dentro de una sesión de entrenamiento. */
export interface RegistroEjercicio {
  ejercicioId: string
  /** El objetivo que tenía propuesto para esa sesión. */
  objetivo: Objetivo
  series: Serie[]
}

/** Una sesión de entrenamiento completa. */
export interface Sesion {
  id: string
  /** Fecha en formato ISO (AAAA-MM-DD), para poder ordenar y agrupar. */
  fecha: string
  /** Momento en que se cerró la sesión, en milisegundos. */
  finalizadaEn: number
  /** Duración total en segundos. */
  duracionSegundos: number
  registros: RegistroEjercicio[]
  nota?: string
}

/**
 * El estado de avance en un patrón: en qué ejercicio de la cadena está,
 * con qué objetivo, y cómo viene la racha.
 */
export interface Avance {
  patron: Patron
  ejercicioId: string
  objetivoActual: Objetivo
  /** Sesiones consecutivas cumpliendo el objetivo. */
  rachaExitos: number
  /** Sesiones consecutivas sin llegar al mínimo. */
  rachaFallos: number
  actualizadoEn: number
}

/** Un bloque dentro de una rutina: qué patrón se trabaja y en qué orden. */
export interface BloqueRutina {
  patron: Patron
  /** Para mostrar el porqué del bloque al armar la sesión. */
  nota?: string
}

export interface Rutina {
  id: string
  nombre: string
  descripcion: string
  /** Días de la semana (1 = lunes … 7 = domingo) en que toca entrenar. */
  dias: number[]
  bloques: BloqueRutina[]
}

/** Preferencias de la app, guardadas junto con el resto de los datos. */
export interface Preferencias {
  id: 'unico'
  rutinaActivaId: string
  /** Sonido al terminar el descanso. */
  sonidoDescanso: boolean
  tema: 'claro' | 'oscuro' | 'sistema'
}
