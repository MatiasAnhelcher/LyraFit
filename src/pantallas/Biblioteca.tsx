import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, EJERCICIOS, FUERA_DE_CADENA, NOMBRE_PATRON, POR_ID } from '@/dominio/biblioteca'
import { leerAvances, leerPreferencias } from '@/datos/repositorio'
import { Cargando, Glifo, Objetivo, Rotulo } from '@/componentes/ui'
import { IconoFuerza, IconoReloj } from '@/componentes/iconos'
import { orden } from '@/componentes/movimiento'

/**
 * La biblioteca.
 *
 * Cada cadena entera, en orden, con el eslabón donde estás marcado. Lo que
 * falta no está bloqueado ni tachado: está sin marcar. Se puede leer la ficha
 * de cualquier ejercicio, incluso los que faltan años — saber a dónde lleva el
 * camino es la mitad de las ganas de recorrerlo.
 */
export function Biblioteca() {
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  if (!avances || !preferencias) return <Cargando filas={6} />

  const hayBarraCargable = (preferencias.cargaMaximaKg ?? 0) > 0
  const deLaBarra = EJERCICIOS.filter((e) => FUERA_DE_CADENA.has(e.id))

  return (
    /*
      Toda esta pantalla vive en el dominio FUERZA, y eso es literal: las cinco
      cadenas son la fuerza y nada más. El campo de brasa se percibe sin poder
      nombrarlo —está a 1,04 de contraste contra el fondo de la app, o sea el
      mismo negro con otra temperatura— y es lo que hace que uno sepa dónde
      está antes de leer una palabra.

      Los glifos de cadena siguen siendo de cadena: ocho píxeles, alta
      saturación. El dominio nunca aparece a ese tamaño. Es la regla que impide
      que nueve colores peleen por la misma pantalla.
    */
    <div data-dominio="fuerza" className="campo -mt-8 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Rotulo className="rotulo-dominio">BIBLIOTECA</Rotulo>
          <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Cuarenta y siete ejercicios en cinco cadenas, de más accesible a más exigente. El
            eslabón donde estás va marcado.
          </p>
        </div>
        <IconoFuerza
          className="h-7 w-7 shrink-0"
          style={{ color: 'var(--dominio-fuerza-luz)', opacity: 0.55 }}
        />
      </header>

      {/* El reloj entra por acá y no por Hoy, y es una decisión medida, no una
          preferencia: en un 360×640, un día de entrenar, `Empezar` queda con
          **exactamente 12 px** de aire sobre la barra —el mínimo— y con un día
          de "las dos" también. No hay lugar para un renglón más en Hoy, y la
          regla del pliegue ya se rompió dos veces. El número lo mide
          `pliegue.mjs`, que desde este cambio fuerza el día alto en vez de
          medir el día que le toque correr.

          Acá además pertenece: esta es la pantalla de los ejercicios, y un
          tabata es elegir ejercicios y arrancar. */}
      <Link to="/reloj" className="registro mt-6 block">
        <div className="fila-pulsable">
          <span className="canal" style={{ color: 'var(--dominio-fuelle-luz)' }}>
            <IconoReloj className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="nombre block">El reloj</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
              Tabata, EMOM y otros intervalos, con los ejercicios que elijas.
            </span>
          </span>
          <span className="rotulo">4 min</span>
        </div>
      </Link>

      {CADENAS.map((cadena, i) => {
        const avance = avances.get(cadena.patron)
        const actual = avance ? cadena.ejercicios.indexOf(avance.ejercicioId) : -1

        return (
          <section key={cadena.patron} className="entrar-en-orden mt-8" style={orden(i)}>
            <div className="flex items-center gap-2">
              <Glifo patron={cadena.patron} />
              <Rotulo>{NOMBRE_PATRON[cadena.patron].toUpperCase()}</Rotulo>
            </div>
            <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
              {cadena.descripcion}
            </p>

            <div className="registro mt-3">
              {cadena.ejercicios.map((id, i) => {
                const ejercicio = POR_ID.get(id)
                if (!ejercicio) return null
                const aca = i === actual
                const hecho = i < actual

                return (
                  <Link key={id} to={`/biblioteca/${id}`} className="fila-pulsable">
                    <span className="canal" style={aca ? { color: 'var(--color-vega)' } : undefined}>
                      {aca ? '◆' : String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      {/* El nombre parte en dos renglones antes que cortarse:
                          es lo que se viene a buscar a esta lista, y con
                          "3×15" a la derecha los largos no entran en uno. */}
                      <span
                        className="nombre block"
                        style={hecho ? { color: 'var(--color-glosa)' } : undefined}
                      >
                        {ejercicio.nombre}
                      </span>
                      {aca && <span className="rotulo mt-0.5 block">ESTÁS ACÁ</span>}
                    </span>
                    <Objetivo
                      series={ejercicio.series}
                      cantidad={ejercicio.ventana.max}
                      medida={ejercicio.medida}
                    />
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}

      {/*
        LOS DE LA BARRA CARGABLE.
        Van en su propia sección y al final, y las dos cosas son decisiones.

        En su propia sección porque NO son eslabones: no tienen un ejercicio
        anterior ni uno siguiente, y su progresión es agregar un disco, no
        bajar la ayuda. Meterlos adentro de una cadena diría que el press
        militar es más difícil que una flexión a una mano, que es falso — es
        otro plano, no otro escalón.

        Al final porque la app sigue siendo de peso corporal: cuarenta y siete
        ejercicios no necesitan comprar nada, y estos cuatro sí.

        Y solo aparecen si la persona dijo que tiene la barra. Un catálogo que
        ofrece lo que no se puede hacer no es generoso, es ruido — es la misma
        regla por la que las cadenas que necesitan barra de dominadas se
        filtran en el alta.
      */}
      {hayBarraCargable && deLaBarra.length > 0 && (
        <section className="entrar-en-orden mt-10" style={orden(CADENAS.length)}>
          <div className="flex items-center gap-2">
            <span className="glifo" style={{ backgroundColor: 'var(--color-vega)' }} aria-hidden />
            <Rotulo>CON LA BARRA</Rotulo>
          </div>
          <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Cuatro movimientos que no son eslabones de nada: acá no se progresa
            bajando la ayuda sino poniendo un disco. Tapan los cuatro huecos que
            el peso corporal no llega a cubrir — el hombro de costado, el remo
            horizontal con peso, la bisagra de cadera cargada y el gemelo.
          </p>
          <div className="registro mt-3">
            {deLaBarra.map((ejercicio) => (
              <Link key={ejercicio.id} to={`/biblioteca/${ejercicio.id}`} className="fila-pulsable">
                <span className="canal">
                  <Glifo patron={ejercicio.patron} />
                </span>
                <span className="min-w-0">
                  <span className="nombre block">{ejercicio.nombre}</span>
                  <span className="rotulo mt-0.5 block truncate">
                    {NOMBRE_PATRON[ejercicio.patron]} · con discos
                  </span>
                </span>
                <Objetivo
                  series={ejercicio.series}
                  cantidad={ejercicio.ventana.max}
                  medida={ejercicio.medida}
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
