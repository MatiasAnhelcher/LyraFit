import type { Adherencia } from '@/dominio/adherencia'
import type { Preferencias } from '@/dominio/tipos'
import { Rotulo } from '@/componentes/ui'

/**
 * Los últimos veintiocho días: una ventana que siempre se puede recuperar, en
 * lugar de una racha que se rompe. Cuándo aparece lo decide `Hoy`.
 */
export function Marcha({
  marcha,
  encuadre,
}: {
  marcha: Adherencia
  /** Cómo eligió la persona leer la cuenta: lo hecho o lo que falta. */
  encuadre: Preferencias['encuadre']
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <Rotulo>ÚLTIMOS 28 DÍAS</Rotulo>
        <p className="cifra text-sm">
          {encuadre === 'restante'
            ? `faltan ${Math.max(0, marcha.meta - marcha.hechas - marcha.cubiertos)}`
            : `${marcha.hechas} de ${marcha.meta}`}
        </p>
      </div>
      <div className="mt-2 flex h-1.5 gap-px" aria-hidden>
        {Array.from({ length: marcha.meta }, (_, i) => (
          <span
            key={i}
            className="flex-1"
            style={{
              backgroundColor:
                i < marcha.hechas
                  ? 'var(--color-vega)'
                  : i < marcha.hechas + marcha.cubiertos
                    ? 'var(--color-regla-fuerte)'
                    : 'var(--color-regla)',
            }}
          />
        ))}
      </div>
      {marcha.cubiertos > 0 && (
        <p className="mt-2 text-xs text-[var(--color-glosa)]">
          {marcha.cubiertos === 1 ? 'Un día cubierto' : `${marcha.cubiertos} días cubiertos`} con
          tus créditos. Faltar estaba previsto.
        </p>
      )}
    </section>
  )
}
