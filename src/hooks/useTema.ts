import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerPreferencias } from '@/datos/repositorio'

/**
 * Aplica el tema elegido al documento.
 *
 * En "sistema" no se marca nada y manda el `prefers-color-scheme` del
 * dispositivo, que es lo que la mayoría espera sin saber que lo espera.
 */
export function useTema(): void {
  const preferencias = useLiveQuery(leerPreferencias, [])

  useEffect(() => {
    const tema = preferencias?.tema ?? 'sistema'
    const raiz = document.documentElement

    if (tema === 'sistema') raiz.removeAttribute('data-tema')
    else raiz.setAttribute('data-tema', tema)
  }, [preferencias?.tema])
}
