/**
 * Progreso.
 *
 * La pieza nueva y la que justifica toda la aritmética del motor es la curva
 * de fuerza. El registro crudo de repeticiones se desploma cada vez que se
 * cambia de eslabón —pasás de hacer quince a hacer seis— y muestra un
 * retroceso justo en el momento de mayor logro. Es el problema que sufre
 * cualquier app de calistenia que grafique repeticiones.
 *
 * El índice de carga lo resuelve porque hace comparables dos ejercicios
 * distintos, y la fórmula con la que el motor recalibra al cambiar de nivel
 * está construida para que el índice quede exactamente igual a los dos lados
 * del salto. La línea sube parejo a través de la cadena entera.
 *
 * Es una estimación y la pantalla lo dice. No es una medición del cuerpo de
 * nadie.
 */

import { lazy, Suspense } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, NOMBRE_PATRON, buscarEjercicio } from '@/dominio/biblioteca'
import { curvaDeFuerza, porSemana, totales } from '@/dominio/estadisticas'
import {
  MUSCULOS_CUBIERTOS,
  NOMBRE_MUSCULO,
  SIN_COBERTURA,
  loQueFalta,
  patronDe,
  seriesPorMusculo,
} from '@/dominio/musculos'
import { RUTINA_POR_ID, rutinaActiva } from '@/dominio/rutinas'
import { fechaISO, guardarPreferencias, leerPreferencias } from '@/datos/repositorio'
import { calibracion, frasePorCalibracion, vitalidad } from '@/dominio/vitalidad'
import { sesionesDeVida } from '@/dominio/adherencia'
import { leerAvances, leerSesiones } from '@/datos/repositorio'
import { Carta } from '@/componentes/carta'
import { Cargando, Glifo, Rotulo, Tira, Vacio } from '@/componentes/ui'

const Curva = lazy(() => import('@/componentes/curva').then((m) => ({ default: m.Curva })))

const FORMATO_SEMANA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

/**
 * Las medias series existen —un secundario aporta 0,5— y escribir "13,5" sería
 * una precisión que el dato no tiene. Se redondea, y el cero se muestra como
 * cero y no como una raya: que un músculo esté en cero es el dato.
 */
const redondo = (n: number) => String(Math.round(n))

/** "a", "a y b", "a, b y c". El castellano no lleva coma antes de la "y". */
function enLista(cosas: string[], union = 'y'): string {
  if (cosas.length <= 1) return cosas[0] ?? ''
  return `${cosas.slice(0, -1).join(', ')} ${union} ${cosas[cosas.length - 1]}`
}

/** Una oración empieza con mayúscula, aunque arranque con un nombre propio en minúscula. */
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function Progreso() {
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])

  if (!sesiones || !avances || !preferencias) return <Cargando filas={5} />

  const resumen = totales(sesiones)
  const semanas = porSemana(sesiones).slice(-12)
  const cal = calibracion(sesiones)
  const vit = vitalidad(sesiones)
  const total = sesionesDeVida(sesiones)

  // El mapa muscular. Se ordena de más a menos y la barra se normaliza al
  // máximo de la propia lista, igual que `SERIES POR SEMANA`: lo que se compara
  // es un músculo contra los otros, no contra un objetivo inventado.
  const hoy = fechaISO()
  const porMusculo = seriesPorMusculo(sesiones, hoy)
  const ranking = MUSCULOS_CUBIERTOS.map((musculo) => ({
    musculo,
    series: porMusculo.get(musculo) ?? 0,
  })).sort((a, b) => b.series - a.series)
  const techo = Math.max(...ranking.map((r) => r.series), 0)
  const falta = loQueFalta({
    sesiones,
    hoy,
    rutina: rutinaActiva(preferencias),
    tieneBarra: preferencias.tieneBarra !== false,
  })

  if (sesiones.length === 0) {
    return (
      <>
        <Rotulo>PROGRESO</Rotulo>
        <Vacio
          titulo="Todavía no hay nada que mostrar"
          texto="Después de la primera sesión vas a ver acá tu curva de fuerza: una sola línea que sigue subiendo aunque cambies de ejercicio."
        />
      </>
    )
  }

  return (
    <>
      <Rotulo>PROGRESO</Rotulo>

      <section className="mt-6">
        <p className="cifra-acumulador">{total}</p>
        <p className="mt-1 text-sm text-[var(--color-glosa)]">
          sesiones · {resumen.series} series · {resumen.minutos} minutos
        </p>
        <div className="mt-4">
          <Tira cantidad={total} />
        </div>
      </section>

      <section className="mt-10">
        <Rotulo className="mb-3">TUS CADENAS</Rotulo>
        <Carta filas={[...avances.values()].map((a) => ({ patron: a.patron, avance: a }))} rotulos />
      </section>

      <section className="mt-10">
        <Rotulo>CURVA DE FUERZA</Rotulo>
        <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Cuánto estás moviendo, en una escala que compara ejercicios distintos. Por eso no se
          corta cuando cambiás de eslabón, que es justo donde un gráfico de repeticiones muestra
          una caída. Es una estimación, no una medición.
        </p>
        <div className="mt-4">
          <Suspense fallback={<div className="h-56" />}>
            <Curva series={CADENAS.map((c) => ({ patron: c.patron, puntos: curvaDeFuerza(sesiones, c.patron) }))} />
          </Suspense>
        </div>
      </section>

      {(cal || vit) && (
        <section className="mt-10">
          <Rotulo>LO QUE TE DEJA ENTRENAR</Rotulo>
          <div className="registro mt-3">
            {vit && (
              <div>
                <span className="canal">↑</span>
                <span className="min-w-0">
                  <span className="nombre block">Energía</span>
                  <span className="rotulo mt-0.5 block">últimas {vit.sesiones} sesiones</span>
                </span>
                <span className="cifra-fila">
                  {vit.delta > 0 ? '+' : ''}
                  {vit.delta}
                </span>
              </div>
            )}
            {cal && (
              <div>
                <span className="canal">≈</span>
                <span className="min-w-0">
                  <span className="nombre block">Qué tan bien te conocés</span>
                  <span className="rotulo mt-0.5 block">últimas {cal.series} series</span>
                </span>
                <span className="cifra-fila">{cal.error}</span>
              </div>
            )}
          </div>
          {cal && (
            <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
              {frasePorCalibracion(cal)}
              {cal.tendencia !== null &&
                ` Venís errando ${Math.abs(cal.tendencia).toFixed(1)} ${
                  cal.tendencia < 0 ? 'menos' : 'más'
                } que el mes pasado.`}
            </p>
          )}
          {vit && (
            <p className="mt-2 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
              Terminaste con más energía de la que empezaste en {vit.subieron} de {vit.sesiones}{' '}
              sesiones. Es tu dato, no un promedio de estudios ajenos.
            </p>
          )}
        </section>
      )}

      <section className="mt-10">
        <Rotulo>SERIES POR SEMANA</Rotulo>
        <div className="registro mt-3">
          {[...semanas].reverse().map((s) => (
            <div key={s.semana}>
              <span className="canal">
                {FORMATO_SEMANA.format(new Date(`${s.semana}T12:00:00`))}
              </span>
              <span className="flex h-2 items-center">
                <span
                  className="block h-full"
                  style={{
                    width: `${Math.min(100, (s.series / Math.max(...semanas.map((x) => x.series), 1)) * 100)}%`,
                    backgroundColor: 'var(--color-regla-fuerte)',
                  }}
                />
              </span>
              <span className="cifra-fila">
                {s.series}
                <span className="cifra-contra">{s.sesiones}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* El mapa muscular: qué recibió cada músculo en cuatro semanas.
       *
       * En CA el mapa es decorativo: te muestra qué entrenaste y ahí termina.
       * Acá tiene que decir qué te FALTA y, cuando puede, llenarlo — si no, es
       * lo mismo con otro color.
       *
       * Es la misma fila que `SERIES POR SEMANA`, y a propósito: esta app tiene
       * un solo idioma para "cantidad como barra" y no hace falta un segundo.
       * El canal lleva el glifo del patrón, que es la marca de color que
       * carga la identidad; la barra queda neutra. Poner las dos cosas en
       * color sería decir lo mismo dos veces, y un chip de color relleno está
       * prohibido por escrito en el CSS.
       *
       * Lo que está en cero NO se pinta de rojo ni lleva alarma. La regla de la
       * carta vale igual acá: lo que falta no está prohibido, está sin
       * iluminar.
       */}
      <section className="mt-10">
        <Rotulo>QUÉ ESTÁS ENTRENANDO</Rotulo>
        <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Series que recibió cada músculo en las últimas cuatro semanas. Una serie es una
          serie: una plancha de treinta segundos y ocho flexiones cuentan igual. Los
          músculos que un ejercicio solo estabiliza no suman — si sumaran, las flexiones
          dirían que entrenaste glúteos.
        </p>

        <div className="registro mt-3">
          {ranking.map(({ musculo, series }) => {
            const patron = patronDe(musculo)
            return (
              <div key={musculo}>
                <span className="canal">{patron ? <Glifo patron={patron} /> : null}</span>
                <span className="min-w-0">
                  <span className="nombre block">{NOMBRE_MUSCULO[musculo]}</span>
                  <span className="mt-1 flex h-2 items-center">
                    <span
                      className="block h-full"
                      style={{
                        width: `${techo > 0 ? (series / techo) * 100 : 0}%`,
                        backgroundColor: 'var(--color-regla-fuerte)',
                      }}
                    />
                  </span>
                </span>
                <span className="cifra-fila">{redondo(series)}</span>
              </div>
            )
          })}
        </div>

        {/* El diagnóstico. Una sola cosa por vez: decir dos es no decir ninguna. */}
        {falta.clase === 'sin-datos' && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Con {falta.sesiones === 1 ? 'una sesión' : `${falta.sesiones} sesiones`} todavía no
            hay con qué decir que te falte nada.
          </p>
        )}

        {falta.clase === 'patron-ausente' && (
          <div className="mt-3">
            <p className="max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
              Tu rutina no incluye{' '}
              <span className="text-[var(--color-tinta)]">{NOMBRE_PATRON[falta.patron].toLowerCase()}</span>
              , así que hace cuatro semanas que{' '}
              {enLista(falta.musculos.map((m) => NOMBRE_MUSCULO[m].toLowerCase()))}{' '}
              {falta.musculos.length === 1 ? 'no recibe' : 'no reciben'} una serie.
            </p>
            {/* El arreglo, hecho y no aconsejado. Es lo que el creador de
                rutinas de CA no puede hacer: el motor ya sabe en qué eslabón
                estás de esa cadena, así que el cambio no propone nada nuevo
                que aprender. */}
            <button
              onClick={() => void guardarPreferencias({ rutinaActivaId: falta.rutinaQueLoCubre })}
              className="rotulo mt-3 px-4 py-3"
              style={{ border: '1px solid var(--color-regla-fuerte)' }}
            >
              Pasar a {RUTINA_POR_ID.get(falta.rutinaQueLoCubre)?.nombre.toLowerCase()}
            </button>
          </div>
        )}

        {falta.clase === 'flojo' && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Lo que menos venís trabajando es{' '}
            <span className="text-[var(--color-tinta)]">
              {NOMBRE_MUSCULO[falta.musculo].toLowerCase()}
            </span>
            : {redondo(falta.series)} {falta.series === 1 ? 'serie' : 'series'} en cuatro semanas.
            Está en {NOMBRE_PATRON[falta.patron].toLowerCase()}, así que la rutina ya te lo pide.
          </p>
        )}

        {falta.clase === 'parejo' && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            No hay ningún músculo muy atrás de los demás.
          </p>
        )}

        {/* Y lo que la app todavía no puede entrenar, que es un hueco del
            catálogo y no de la persona. Por eso se dice en otro renglón y con
            otras palabras: no "lo entrenás poco" sino "no hay con qué". */}
        <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          {mayuscula(enLista(SIN_COBERTURA.map((x) => NOMBRE_MUSCULO[x.musculo].toLowerCase())))}{' '}
          {SIN_COBERTURA.length === 1 ? 'no aparece' : 'no aparecen'}: no hay todavía ningún
          ejercicio de {enLista(SIN_COBERTURA.map((x) => x.patronQueFalta), 'ni')} en la app.
        </p>
      </section>

      {/* El historial, con la voz del motor adentro.
          Antes era una lista de fechas con nombres de ejercicios: cierta y
          muerta. Lo que le faltaba estaba a mano y se tiraba — la explicación
          del motor se mostraba diez segundos en el cierre y se perdía. Es el
          activo diferencial del producto, ninguna otra app te muestra la regla
          que decidió tu próximo objetivo, y duraba menos que un cartel.

          Solo se muestran los cambios de eslabón, que son los días que valen
          la pena releer. Poner las cuatro decisiones de las veinte sesiones
          serían ochenta renglones en cursiva y el historial dejaría de ser
          legible para decir lo mismo.

          Y en el canal va el número de sesión y no la fecha: "047" dice quién
          sos, "12 sep" dice cuándo. La fecha baja al renglón chico. */}
      <section className="mt-10 pb-4">
        <Rotulo>HISTORIAL</Rotulo>
        <div className="registro mt-3">
          {sesiones.slice(0, 20).map((sesion, i) => {
            const numero = total - i
            const saltos = (sesion.decisiones ?? []).filter((d) => d.cambioDeNivel)
            return (
              <div key={sesion.id}>
                {/* Arriba y no al medio: en una fila de tres renglones el
                    número centrado queda flotando lejos del nombre al que
                    pertenece. */}
                <span className="canal" style={{ alignItems: 'flex-start' }}>
                  {String(numero).padStart(3, '0')}
                </span>
                <span className="min-w-0">
                  <span className="nombre block truncate">
                    {sesion.registros
                      .map((r) => buscarEjercicio(r.ejercicioId)?.nombre)
                      .filter(Boolean)
                      .join(' · ') || 'Sesión sin registros'}
                  </span>
                  <span className="rotulo mt-0.5 flex items-center gap-2">
                    {new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    <span className="flex gap-1">
                      {sesion.registros.map((r) => {
                        const e = buscarEjercicio(r.ejercicioId)
                        return e ? <Glifo key={r.ejercicioId} patron={e.patron} /> : null
                      })}
                    </span>
                  </span>
                  {saltos.map((d) => (
                    <span key={d.patron} className="glosa mt-2 block text-[0.9375rem]">
                      {d.explicacion}
                    </span>
                  ))}
                </span>
                <span className="cifra-fila self-start">
                  {Math.round(sesion.duracionSegundos / 60)}
                  <span className="unidad">min</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

export { NOMBRE_PATRON }
