import { useEffect, useLayoutEffect } from 'react'
import { pasajeEnCurso } from '@/componentes/movimiento'

/**
 * Mantiene la pantalla encendida mientras dura la sesión.
 *
 * Sin esto el teléfono se apaga en mitad de una serie y hay que desbloquearlo
 * con las manos transpiradas. Es la clase de detalle que no aparece en ninguna
 * lista de features y que decide si la app se usa o no.
 *
 * La API existe en Chrome desde hace años y en Safari desde 16.4. Donde no
 * está, no pasa nada: la app funciona igual, la pantalla se apaga como
 * siempre. Y el permiso se pierde solo al cambiar de pestaña, así que hay que
 * volver a pedirlo cuando la app vuelve a estar visible.
 */
export function usePantallaDespierta(activo: boolean): void {
  useEffect(() => {
    if (!activo) return

    const api = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    if (!api) return

    let permiso: { release: () => Promise<void> } | null = null
    let cancelado = false

    const pedir = async () => {
      try {
        const nuevo = await api.request('screen')
        if (cancelado) void nuevo.release()
        else permiso = nuevo
      } catch {
        // El navegador puede negarlo con poca batería. No es un error.
      }
    }

    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', alVolver)
      void permiso?.release().catch(() => {})
    }
  }, [activo])
}

/**
 * Marca la pantalla en la raíz del documento.
 *
 * Entrenar conmuta el tema entero a noche fija, y eso pasa por CSS y no por
 * disciplina de cada componente: así ninguna pieza se puede olvidar de
 * apagarse.
 *
 * Va en un efecto de layout, antes del primer pintado: con un efecto común,
 * el primer cuadro de la sesión salía con la letra y el movimiento de afuera.
 * Si la pantalla llega por un pasaje, el atributo se pone recién cuando el
 * pasaje termina, porque hasta ahí algo se está moviendo; lo que se ve del
 * esfuerzo no lo espera, porque el CSS también lo lee de la clase de la
 * pantalla, que está desde el primer cuadro.
 */
export function useModoDePantalla(nombre: string | null): void {
  useLayoutEffect(() => {
    if (!nombre) return
    const raiz = document.documentElement
    let vigente = true
    const marcar = () => {
      if (vigente) raiz.setAttribute('data-pantalla', nombre)
    }
    const pasaje = pasajeEnCurso()
    if (pasaje) void pasaje.finished.then(marcar, marcar)
    else marcar()
    return () => {
      vigente = false
      raiz.removeAttribute('data-pantalla')
    }
  }, [nombre])
}
