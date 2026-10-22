/**
 * El primer cuadro de la sesión, sin esperar a la base.
 *
 * Hoy ya tiene el plan calculado cuando se toca "Empezar", y se lo pasa a
 * Entrenar en el estado de la navegación (`irA('/entrenar', { estado: { plan } })`,
 * que react-router guarda en `history.state.usr`). Con eso la primera serie
 * se dibuja en el cuadro que sigue al toque, en vez de un "PREPARANDO LA
 * SESIÓN…" mientras Dexie abre la base. Cuando la base contesta, manda la
 * base: si había una sesión en curso, o el plan cambió, el cambio es un corte.
 *
 * El estado de la historia es de afuera: sobrevive a una recarga y a una
 * versión nueva de la app, así que se lee como lo que es, un dato sin
 * garantías. Cada ejercicio se vuelve a buscar en la biblioteca por su id —el
 * nombre, la técnica y la medida son los de esta versión— y un plan con algo
 * que no se reconoce se descarta entero: un primer cuadro equivocado es peor
 * que "PREPARANDO LA SESIÓN…", que por lo menos es verdad.
 */

import { POR_ID } from '@/dominio/biblioteca'
import type { VezPasada } from '@/dominio/estadisticas'
import type { PasoDelPlan } from './usePlanDeLaSesion'

const esNumero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor)
const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null

/** El ejercicio de esta versión de la biblioteca, por el id que trae el estado. */
function ejercicioDe(crudo: unknown) {
  return esObjeto(crudo) && typeof crudo.id === 'string' ? (POR_ID.get(crudo.id) ?? null) : null
}

/**
 * La vara de la vez pasada, si está entera. Si no, el nodo se dibuja sin
 * ella: es un dato de más, no uno que haga falta para la serie.
 */
function varaDe(crudo: unknown): VezPasada | null {
  if (!esObjeto(crudo) || !esNumero(crudo.hace) || !Array.isArray(crudo.logros)) return null
  if (!crudo.logros.every(esNumero)) return null
  return crudo as unknown as VezPasada
}

function pasoDe(crudo: unknown): PasoDelPlan | null {
  if (!esObjeto(crudo)) return null
  const ejercicio = ejercicioDe(crudo.ejercicio)
  const objetivo = crudo.objetivo
  if (!ejercicio || !esObjeto(objetivo)) return null
  const { series, cantidad, kg } = objetivo
  if (!esNumero(series) || series < 1 || !esNumero(cantidad) || cantidad < 0) return null
  return {
    ejercicio,
    objetivo: { series, cantidad, ...(esNumero(kg) ? { kg } : {}) },
    antes: varaDe(crudo.antes),
    abre: ejercicioDe(crudo.abre),
    descansoSegundos: esNumero(crudo.descansoSegundos) ? crudo.descansoSegundos : ejercicio.descansoSegundos,
    bajada: crudo.bajada === true,
    porMolestia: crudo.porMolestia === true,
  }
}

/** El plan que trajo la navegación, o null si no trajo uno que se pueda dibujar. */
export function planDelPrimerCuadro(estado: unknown): PasoDelPlan[] | null {
  if (!esObjeto(estado) || !Array.isArray(estado.plan) || estado.plan.length === 0) return null
  const plan: PasoDelPlan[] = []
  for (const crudo of estado.plan) {
    const paso = pasoDe(crudo)
    if (!paso) return null
    plan.push(paso)
  }
  return plan
}
