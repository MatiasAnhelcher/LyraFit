/**
 * Dónde está una persona en una cadena, en los números que dibuja la barra.
 *
 * Está aparte del componente para poder probarlo sin un navegador: cada número
 * de la barra sale de acá, y acá sale del dominio.
 */

import type { Avance, Ejercicio, Objetivo, Patron } from '@/dominio/tipos'
import { NOMBRE_PATRON, POR_ID, cadenaDe } from '@/dominio/biblioteca'
import { rellenoDeVentana } from '@/dominio/progresion'

export interface EnCadena {
  patron: Patron
  /** El eslabón actual, desde 0. */
  indice: number
  /** Cuántos eslabones tiene la cadena. */
  total: number
  /** Cuánto de la ventana del eslabón actual recorrió el objetivo, de 0 a 1. */
  relleno: number
  ejercicio: Ejercicio | undefined
  objetivo: Objetivo
  /** El objetivo llegó al techo de la ventana. */
  enTecho: boolean
}

/** Dónde está un avance: eslabón, largo de la cadena y relleno del actual. */
export function enCadena(avance: Avance): EnCadena {
  return enCadenaCon(avance.patron, avance.ejercicioId, avance.objetivoActual)
}

/**
 * Lo mismo, a partir de un ejercicio y un objetivo sueltos: la huella del
 * Cierre es dónde estabas ANTES, y eso no es un avance guardado sino el
 * objetivo que traía el registro de la sesión.
 */
export function enCadenaCon(patron: Patron, ejercicioId: string, objetivo: Objetivo): EnCadena {
  const cadena = cadenaDe(patron)
  const ejercicio = POR_ID.get(ejercicioId)
  return {
    patron,
    indice: Math.max(0, cadena.ejercicios.indexOf(ejercicioId)),
    total: cadena.ejercicios.length,
    relleno: ejercicio ? rellenoDeVentana(ejercicio, objetivo.cantidad) : 0,
    ejercicio,
    objetivo,
    enTecho: ejercicio ? objetivo.cantidad >= ejercicio.ventana.max : false,
  }
}

/** "3 × 9", "3 × 25 s", "3 × 8 con 20 kg". La unidad, solo si hace falta. */
export function objetivoCorto(e: EnCadena): string {
  const s = e.ejercicio?.medida === 'segundos' ? ' s' : ''
  const kg = e.objetivo.kg ? ` con ${e.objetivo.kg} kg` : ''
  return `${e.objetivo.series} × ${e.objetivo.cantidad}${s}${kg}`
}

/** El techo de la ventana, con su unidad: "12", "30 s". */
export function techoCorto(e: EnCadena): string {
  if (!e.ejercicio) return ''
  return `${e.ejercicio.ventana.max}${e.ejercicio.medida === 'segundos' ? ' s' : ''}`
}

/**
 * Lo que la barra dice con palabras, para el lector de pantalla:
 * "Empuje: eslabón 7 de 11, Flexiones diamante, 3 × 9 de un techo de 12".
 *
 * En el lector "s" no se lee como segundos, así que acá va la palabra entera.
 */
export function textoDeLaBarra(e: EnCadena): string {
  const nombre = e.ejercicio?.nombre ?? 'sin ejercicio'
  const segundos = e.ejercicio?.medida === 'segundos'
  const unidad = segundos ? ' segundos' : ''
  const kg = e.objetivo.kg ? ` con ${e.objetivo.kg} kilos` : ''
  const objetivo = `${e.objetivo.series} × ${e.objetivo.cantidad}${unidad}${kg}`
  const techo = e.ejercicio
    ? e.enTecho
      ? ', en el techo'
      : ` de un techo de ${e.ejercicio.ventana.max}${unidad}`
    : ''
  return `${NOMBRE_PATRON[e.patron]}: eslabón ${e.indice + 1} de ${e.total}, ${nombre}, ${objetivo}${techo}`
}
