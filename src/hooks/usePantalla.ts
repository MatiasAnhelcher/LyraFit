import { useEffect } from 'react'

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
 */
export function useModoDePantalla(nombre: string | null): void {
  useEffect(() => {
    if (!nombre) return
    const raiz = document.documentElement
    raiz.setAttribute('data-pantalla', nombre)
    return () => raiz.removeAttribute('data-pantalla')
  }, [nombre])
}
