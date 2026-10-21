/**
 * La pregunta de la molestia: la misma en el chequeo y en el aviso suelto.
 *
 * Vive una sola vez porque son dos pantallas que preguntan lo mismo, y la
 * versión vieja tenía dos defectos que no se veían desde ninguna de las dos:
 * dejaba la bisagra afuera —la cadena del curl nórdico— y prometía algo que
 * la app no hacía.
 */

import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import type { Patron } from '@/dominio/tipos'
import { Regleta, Segmento } from './ui'

/** Las cinco cadenas, con la bisagra. */
const CADENAS_DE_LA_MOLESTIA: Patron[] = ['empuje', 'traccion', 'piernas', 'bisagra', 'core']

/**
 * Lo que de verdad pasa cuando se avisa.
 *
 * Reemplaza a "ahí la app deja de empujar esa cadena", que era falso: avisar
 * solo hacía que la sesión no contara, con el mismo ejercicio y el mismo
 * objetivo. Esto describe lo que hace `bloqueConMolestia`, y si esa regla
 * cambia, esta frase cambia con ella.
 */
export const LO_QUE_PASA_CON_LA_MOLESTIA =
  'Hoy esa cadena baja un eslabón, o descansa si ya está en el primero, y las ráfagas no la cargan. Tu progresión ahí queda donde estaba.'

export function ElegirMolestia({
  valor,
  onElegir,
  ninguna,
}: {
  valor: Patron | 'ninguna' | null
  onElegir: (valor: Patron | 'ninguna') => void
  /** El rótulo de "no hay molestia", o null para no ofrecerlo. */
  ninguna: string | null
}) {
  return (
    <Regleta className="mt-3" etiqueta="Dónde molesta">
      {ninguna && (
        <Segmento elegido={valor === 'ninguna'} onClick={() => onElegir('ninguna')}>
          {ninguna}
        </Segmento>
      )}
      {CADENAS_DE_LA_MOLESTIA.map((p) => (
        <Segmento key={p} elegido={valor === p} onClick={() => onElegir(p)} tono="ambar">
          {NOMBRE_PATRON[p]}
        </Segmento>
      ))}
    </Regleta>
  )
}
