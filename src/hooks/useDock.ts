import { useLayoutEffect, useRef } from 'react'

/**
 * El dock: la caja de la acción principal, pegada sobre la barra cuando su
 * lugar natural queda abajo del pliegue.
 *
 * El pegado lo hace el CSS (`.dock[data-pegable]`, `position: sticky`). Esto
 * hace lo que el CSS no sabe: decir CUÁNDO está pegado, para que la caja se
 * pinte entera —`data-pegado`— y nada de lo que pasa por detrás se asome
 * entre el botón y la barra; y cuánto mide pegada —`--alto-dock`—, para que el
 * `scroll-padding-bottom` de la raíz no deje un control enfocado debajo de
 * ella (WCAG 2.4.11).
 *
 * Lo mira un IntersectionObserver sobre la sentinela, un píxel que va justo
 * después de la caja: si la sentinela queda abajo de la barra, la caja está
 * despegada de su lugar. Y no se mira en cada cuadro de scroll.
 *
 * El mismo observador mira también la caja. Un salto largo —un scroll
 * rápido, un `scrollTo`, el foco que trae algo de lejos— lleva la sentinela
 * de abajo de la barra a arriba de la pantalla sin pasar por el medio, y eso
 * no le cambia la intersección: el observador no avisaría y la caja quedaría
 * marcada como pegada, pintada y reservando su alto. En ese mismo salto la
 * caja sí cambia —estaba a la vista, pegada, y ya no—, y cada aviso vuelve a
 * medir la sentinela en vez de creerle a quién lo disparó.
 *
 * `pegable` en falso apaga todo: la caja va en el flujo, como cualquier otra.
 */
export function useDock(pegable: boolean) {
  const caja = useRef<HTMLDivElement>(null)
  const sentinela = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const dock = caja.current
    const marca = sentinela.current
    if (!pegable || !dock || !marca) return
    const raiz = document.documentElement
    // El piso es el borde de arriba de la barra; sin barra, el de la pantalla.
    const piso = () => document.querySelector('.marco-fijo')?.getBoundingClientRect().top ?? window.innerHeight

    let pegado = false
    const medir = () => {
      if (pegado) raiz.style.setProperty('--alto-dock', `${dock.getBoundingClientRect().height}px`)
    }
    const poner = (si: boolean) => {
      if (si === pegado) return
      pegado = si
      dock.toggleAttribute('data-pegado', si)
      if (si) medir()
      else raiz.style.removeProperty('--alto-dock')
    }

    // Pegada quiere decir que su lugar está abajo del piso. Arriba no: ahí
    // ya se pasó, y la caja subió con todo lo demás.
    const mirar = () => poner(marca.getBoundingClientRect().top > piso() + 0.5)

    // El primer estado, antes de pintar: una caja que nace pegada nace
    // pintada, sin el fundido de 180 ms, que es para cuando se pega bajo el
    // dedo y no para cuando la pantalla llega.
    mirar()

    let observador: IntersectionObserver | null = null
    const observar = () => {
      observador?.disconnect()
      const abajo = Math.max(0, window.innerHeight - piso())
      observador = new IntersectionObserver(mirar, { rootMargin: `0px 0px ${-abajo}px 0px` })
      observador.observe(marca)
      observador.observe(dock)
    }
    observar()
    const tamano = new ResizeObserver(medir)
    tamano.observe(dock)
    // La barra de direcciones del teléfono cambia el alto de la pantalla al
    // bajar, y con él dónde queda el piso.
    window.addEventListener('resize', observar)

    return () => {
      observador?.disconnect()
      tamano.disconnect()
      window.removeEventListener('resize', observar)
      dock.removeAttribute('data-pegado')
      raiz.style.removeProperty('--alto-dock')
    }
  }, [pegable])

  return { caja, sentinela, pegable }
}
