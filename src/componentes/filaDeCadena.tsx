/**
 * Las filas de cadena que comparten Hoy y el Cierre.
 *
 * La chica mide 44: el nombre de la cadena en rótulo, la barra `s` y "7 de
 * 11". La del salto es la que se abre en el Cierre cuando cambiaste de
 * eslabón: barra `l`, el ejercicio nuevo y de dónde venías.
 */

import type { Avance } from '@/dominio/tipos'
import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import { Glifo } from './ui'
import { BarraDeCadena } from './barraDeCadena'
import { enCadena, objetivoCorto, type EnCadena } from './enCadena'

/**
 * La fila de 44. Lo que se ve es lo mismo que dice la barra, así que el texto
 * se esconde del lector: si no, cada fila se leería dos veces.
 */
export function FilaDeCadenaChica({ avance }: { avance: Avance }) {
  const e = enCadena(avance)
  return (
    <div className="fila-cadena-chica">
      <span className="rotulo" aria-hidden>
        <Glifo patron={avance.patron} />
        {NOMBRE_PATRON[avance.patron]}
      </span>
      <BarraDeCadena posicion={e} tamano="s" />
      <span className="cuenta-cadena" aria-hidden>
        <b>{e.indice + 1}</b> de {e.total}
      </span>
    </div>
  )
}

/**
 * La cadena que saltó, abierta. La coreografía es la del Cierre: el relleno
 * entra al eslabón nuevo de 0,7 a 1,6 s, la estrella se posa a 1,46 s, y el
 * nombre del ejercicio nuevo aparece con `.revelar--1`.
 */
export function FilaDeSalto({ avance, antes }: { avance: Avance; antes: EnCadena | null }) {
  const e = enCadena(avance)
  return (
    <div className="fila-cadena fila-cadena--salto">
      <div className="fila-cadena-cabeza" aria-hidden>
        <Glifo patron={avance.patron} />
        <span className="rotulo flex-1">{NOMBRE_PATRON[avance.patron]}</span>
        <span className="cuenta-cadena">
          <b>{e.indice + 1}</b> de {e.total}
        </span>
      </div>
      <BarraDeCadena posicion={e} tamano="l" animar {...(antes ? { huella: antes } : {})} />
      <div className="salto-nuevo revelar revelar--1">
        <p className="salto-nuevo-nombre">{e.ejercicio?.nombre ?? '—'}</p>
        <p className="texto-chico">
          {antes?.ejercicio ? `Antes: ${antes.ejercicio.nombre}. ` : ''}Arrancás en {objetivoCorto(e)}.
        </p>
      </div>
    </div>
  )
}
