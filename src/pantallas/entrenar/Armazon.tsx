import type { ReactNode, Ref } from 'react'

/**
 * El armazón de la pantalla de esfuerzo (§7.4): una grilla de tres filas al
 * alto de la pantalla. Arriba el encabezado, en el medio `main` con su propio
 * scroll, y abajo la acción a sangre o los botones del descanso.
 *
 * La página no scrollea nunca: lo que no entra scrollea adentro de `main`, y
 * la fila de abajo queda siempre en su lugar. Así la acción no se va abajo
 * del borde en un teléfono bajo, ni nada pegado tapa texto, porque los
 * botones son una fila y no una capa encima.
 *
 * `.pantalla-esfuerzo` está desde el primer cuadro: con ella el CSS ya pone
 * la noche, la letra de 17 y el movimiento apagado antes de que llegue
 * `data-pantalla`, que espera a que termine el pasaje.
 */
export function Armazon({
  encabezado,
  children,
  pie,
  principal,
  claseDelPrincipal,
  ocupado = false,
}: {
  /** La fila de arriba. Sin encabezado (null), la fila mide cero. */
  encabezado: ReactNode
  children: ReactNode
  /** La fila de abajo. Sin pie, la fila mide cero. */
  pie?: ReactNode
  principal?: Ref<HTMLElement>
  claseDelPrincipal?: string
  /** Mientras se dibuja con el plan de Hoy y la base todavía no contestó. */
  ocupado?: boolean
}) {
  return (
    <div className="pantalla-esfuerzo armazon-esfuerzo">
      {/* Sin encabezado, la fila de arriba igual tiene su hijo, que mide
          cero: si no, `main` caía en ella y el pie en la del medio. */}
      {encabezado ?? <div />}
      <main ref={principal} className={claseDelPrincipal} aria-busy={ocupado || undefined}>
        {children}
      </main>
      <div>{pie}</div>
    </div>
  )
}
