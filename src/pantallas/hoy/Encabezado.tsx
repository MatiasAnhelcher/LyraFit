import { Lyra } from '@/componentes/lyra'
import { Rotulo, Tira } from '@/componentes/ui'

export const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * Quién sos: la fecha, las sesiones de tu vida y, cuando falta poco, el
 * próximo hito. Es lo primero del orden de Hoy, y lo único que va antes de
 * lo que toca hoy.
 */
export function Encabezado({
  hoy,
  total,
  hito,
}: {
  hoy: Date
  /** Las sesiones de toda la vida: un contador que solo sube. */
  total: number
  hito: { hito: number; faltan: number } | null
}) {
  return (
    <header>
      <Rotulo>{FORMATO_FECHA.format(hoy).toUpperCase()}</Rotulo>
      {/* Lyra va acá, al lado de la cifra de identidad, y no arriba: la
          columna de la derecha de esta línea estaba vacía, así que la marca
          no cuesta un solo píxel de alto. Importa porque `Empezar` tiene doce
          píxeles de aire sobre la barra en un teléfono de 360×640, y ya se
          rompió una vez por un renglón de más.

          Quieta y no interactiva: acá es el logo. La que respira y contesta
          es la de más abajo. */}
      <div className="flex items-center justify-between gap-4">
        <p className="cifra-identidad mt-3">{String(total).padStart(3, '0')}</p>
        <Lyra tamano={56} interactiva={false} expresion="calma" className="shrink-0" />
      </div>
      <p className="mt-1 text-sm text-[var(--color-glosa)]">
        {total === 0
          ? 'sesiones. Todavía ninguna.'
          : total === 1
            ? 'sesión en tu vida.'
            : 'sesiones en tu vida.'}
      </p>
      {total > 0 && (
        <div className="mt-4">
          <Tira cantidad={total} />
        </div>
      )}
      {hito && hito.faltan <= 5 && total > 0 && (
        <p className="mt-4 text-sm text-[var(--color-glosa)]">
          Te {hito.faltan === 1 ? 'falta' : 'faltan'}{' '}
          <span className="cifra text-[var(--color-tinta)]">{hito.faltan}</span> para llegar a{' '}
          <span className="cifra text-[var(--color-tinta)]">{hito.hito}</span>.
        </p>
      )}
    </header>
  )
}
