import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DIAS,
  DIA_CORTO,
  GLIFO_CLASE,
  NOMBRE_CLASE,
  NOMBRE_DIA,
  RUTINAS,
  revisarSemana,
  rutinaActiva,
  tieneFuelle,
  semanaActiva,
  semanaDe,
  siguienteClase,
} from '@/dominio/rutinas'
import type { ClaseDeDia } from '@/dominio/rutinas'
import type { Preferencias } from '@/dominio/tipos'
import {
  RespaldoInvalido,
  borrarTodo,
  exportarTodo,
  guardarPreferencias,
  importarTodo,
  leerPreferencias,
  validarRespaldo,
} from '@/datos/repositorio'
import { estadoDeAlmacenamiento, type EstadoDeAlmacenamiento } from '@/datos/respaldo'
import { HAY_HAPTICA } from '@/respuesta'
import { HAY_VOZ, vozElegida } from '@/voz'
import { Accion, AccionQuieta, Cargando, Rotulo } from '@/componentes/ui'

export function Ajustes() {
  const preferencias = useLiveQuery(leerPreferencias, [])
  const archivo = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [almacenamiento, setAlmacenamiento] = useState<EstadoDeAlmacenamiento | null>(null)

  useEffect(() => {
    void estadoDeAlmacenamiento().then(setAlmacenamiento)
  }, [])

  if (!preferencias) return <Cargando filas={6} />

  const cambiar = (cambios: Partial<Preferencias>) => void guardarPreferencias(cambios)

  /**
   * La semana que de verdad corre, y el toque que la vuelve propia.
   *
   * El primer toque escribe los SIETE días de una, partiendo de la del preset.
   * Así no queda una semana a medio escribir en la base, y `semana === undefined`
   * sigue queriendo decir exactamente una cosa: "nunca la tocó".
   */
  const semana = semanaActiva(preferencias)
  const rutina = rutinaActiva(preferencias)
  const avisos = revisarSemana(semana, rutina)

  const ciclarDia = (dia: number) =>
    cambiar({ semana: { ...semana, [dia]: siguienteClase(semana[dia] ?? 'descanso') } })

  // Elegir un preset reescribe la semana entera. Es deliberado y se ve en el
  // acto, porque la grilla está justo abajo: un preset que dijera "lunes,
  // miércoles y viernes" y dejara la semana vieja puesta sería mentir.
  const elegirPreset = (id: string) => {
    const nueva = RUTINAS.find((r) => r.id === id)
    if (!nueva) return
    cambiar({ rutinaActivaId: id, semana: semanaDe(nueva) })
  }

  async function descargar() {
    const datos = await exportarTodo()
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
    const nombre = `lyrafit-${datos.exportadoEn.slice(0, 10)}.json`

    // Compartir es el camino portable: `showSaveFilePicker` no existe en Safari
    // y WebKit tiene posición oficial de no implementarlo.
    const puedeCompartir =
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([blob], nombre, { type: 'application/json' })] })

    if (puedeCompartir) {
      try {
        await navigator.share({
          files: [new File([blob], nombre, { type: 'application/json' })],
          title: 'Copia de LyraFit',
        })
        return
      } catch {
        /* Si cancela, se cae al camino de descarga de siempre. */
      }
    }

    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombre
    enlace.click()
    URL.revokeObjectURL(url)
  }

  async function importar(entrada: File) {
    try {
      const respaldo = validarRespaldo(JSON.parse(await entrada.text()))
      await importarTodo(respaldo)
      setAviso(`Listo: ${respaldo.sesiones.length} sesiones restauradas.`)
    } catch (error) {
      setAviso(
        error instanceof RespaldoInvalido
          ? error.message
          : 'No se pudo leer el archivo. ¿Es una copia de LyraFit?',
      )
    }
  }

  return (
    <>
      <Rotulo>AJUSTES</Rotulo>

      <section className="mt-6">
        <Rotulo>RUTINA</Rotulo>
        <div className="registro mt-3">
          {RUTINAS.map((rutina) => (
            <button
              key={rutina.id}
              onClick={() => elegirPreset(rutina.id)}
              className="fila-pulsable"
            >
              <span className="canal">
                {rutina.id === preferencias.rutinaActivaId ? '◆' : '◇'}
              </span>
              <span className="min-w-0">
                <span className="nombre block">{rutina.nombre}</span>
                <span className="rotulo mt-0.5 block">
                  {/* Lo que el preset trae es su semana, y se dibuja con las
                      mismas letras que la grilla de abajo para que se vea que es
                      lo mismo: elegirlo escribe eso ahí. */}
                  {DIAS.map((d) => {
                    const clase = semanaDe(rutina)[d] ?? 'descanso'
                    return clase === 'descanso'
                      ? DIA_CORTO[d]!.toLowerCase()
                      : `${DIA_CORTO[d]}${clase === 'fuelle' ? '·f' : clase === 'ambos' ? '·+' : ''}`
                  }).join(' ')}
                </span>
              </span>
              <span className="cifra-fila">{rutina.dias.length}</span>
            </button>
          ))}
        </div>
      </section>

      {/* La semana, y por qué vive acá y no en Hoy.
       *
       * Hoy tiene doce píxeles de aire entre `Empezar` y la barra de navegación
       * en un Android de 360×640, y la regla de que nada puede volver a
       * empujarla está escrita cinco veces en el código. Una grilla de siete
       * filas ahí adentro la rompería de nuevo.
       *
       * Son filas y no siete columnas: en 320 px de ancho, siete columnas dejan
       * 45 px por día, que no alcanzan ni para el objetivo táctil ni para decir
       * qué clase de día es. Una fila por día dice el nombre entero.
       */}
      <section className="mt-8">
        <Rotulo>LA SEMANA</Rotulo>
        <p className="mt-2 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Tocá un día para cambiarlo. Fuerza es la sesión de siempre; fuelle es
          acondicionamiento, sin una sola serie de la que el motor opine; las dos mete
          las ráfagas adentro de los descansos y un bloque metabólico al final.
        </p>
        <div className="registro mt-3">
          {DIAS.map((dia) => {
            const clase: ClaseDeDia = semana[dia] ?? 'descanso'
            return (
              <button key={dia} onClick={() => ciclarDia(dia)} className="fila-pulsable">
                <span className="canal">{GLIFO_CLASE[clase]}</span>
                <span className="min-w-0">
                  <span className="nombre block">{NOMBRE_DIA[dia]}</span>
                </span>
                <span
                  className="rotulo"
                  style={{
                    color:
                      clase === 'descanso' ? 'var(--color-glosa)' : 'var(--color-tinta)',
                  }}
                >
                  {clase === 'descanso' ? '—' : NOMBRE_CLASE[clase].toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Los avisos: lo que la app tiene para decir de esta semana.
            Se impide una sola cosa —quedarse sin ningún día de fuerza, que
            dejaría al motor sin nada que leer— y todo lo demás se dice y se
            deja pasar. Es su cuerpo y su decisión; lo que corresponde es que
            sepa qué va a pasar, no que la app se lo prohíba. */}
        {avisos.length > 0 && (
          <div className="mt-3 space-y-2">
            {avisos.map((aviso) => (
              <p
                key={aviso.clave}
                className="max-w-[42ch] text-xs leading-relaxed"
                style={{
                  color:
                    aviso.gravedad === 'impide'
                      ? 'var(--color-vega)'
                      : 'var(--color-glosa)',
                }}
              >
                {aviso.texto}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* El fuelle va DESPUÉS de la rutina y antes de la app, porque es una
          decisión de entrenamiento y no una preferencia de interfaz: cambia lo
          que la app te va a pedir que hagas, no cómo se ve. */}
      <section className="mt-8">
        <Rotulo>EL FUELLE</Rotulo>
        <p className="mt-2 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Trabajo metabólico en los huecos que la sesión ya tenía. Nunca sale del descanso
          que hace falta para la serie que viene, y nunca carga el patrón que estás
          entrenando: eso es lo que evita que transpirar te cueste fuerza. Acá elegís cuán
          fuerte; en qué días entra lo dice la semana de arriba.
        </p>
        {/* Acá había una tercera opción, "Apagado", y se fue cuando el fuelle
            pasó a ser del día. Eran dos interruptores para una sola cosa: se
            podía tener el miércoles marcado con fuelle y el fuelle apagado, y
            entonces la app abría un día que no sabía llenar —el código lo
            remendaba forzando "suave" por atrás—. Ahora el fuelle se apaga
            donde se prende: no marcando ningún día. Una idea, un lugar.

            Es la misma lección que dejó el selector de duración que vivía acá:
            "cuánto querés que dure" era la palanca equivocada, y con "lo más
            largo que dé" en un día de fuelle armaba OCHENTA Y CUATRO vueltas de
            saltos encadenados. La duración de una sesión no se elige: se elige
            cuán fuerte, y la duración sale de ahí. */}
        <div className="registro mt-3">
          {(
            [
              ['suave', 'Suave', 'Tramos cortos, nada explosivo y un bloque de ocho minutos. Para empezar o para semanas cargadas.'],
              ['fuerte', 'Fuerte', 'Ráfagas más largas y un bloque de hasta doce minutos al final, antes de la serie de cierre.'],
            ] as const
          ).map(([valor, titulo, detalle]) => (
            <button
              key={valor}
              onClick={() => cambiar({ densidad: valor })}
              className="fila-pulsable"
            >
              <span className="canal">
                {(preferencias.densidad === undefined || preferencias.densidad === 'apagada'
                  ? 'suave'
                  : preferencias.densidad) === valor
                  ? '◆'
                  : '◇'}
              </span>
              <span className="min-w-0">
                <span className="nombre block">{titulo}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
                  {detalle}
                </span>
              </span>
              <span />
            </button>
          ))}
        </div>

        {/* El equipo solo aparece si algún día lleva fuelle: sin ninguno no
            filtra nada y serían dos filas que no hacen nada. */}
        {DIAS.some((d) => tieneFuelle(semana[d] ?? 'descanso')) && (
          <div className="registro mt-3">
            <Interruptor
              titulo="Puedo saltar"
              detalle="Si hay vecinos abajo o el piso no aguanta, dejalo en no: no te va a pedir saltos ni burpees."
              activo={preferencias.puedeSaltar === true}
              onCambiar={(v) => cambiar({ puedeSaltar: v })}
            />
            <Interruptor
              titulo="Tengo escalón o cajón"
              detalle="Un escalón, un cajón o una silla firme para subidas."
              activo={preferencias.tieneEscalon === true}
              onCambiar={(v) => cambiar({ tieneEscalon: v })}
            />
          </div>
        )}
      </section>

      <section className="mt-8">
        <Rotulo>LA APP</Rotulo>
        <div className="registro mt-3">
          <Interruptor
            titulo="Chequeo diario"
            detalle="Tres preguntas, quince segundos. Evita que el motor te baje el objetivo por un mal día."
            activo={preferencias.estadoActivo === true}
            onCambiar={(v) => cambiar({ estadoActivo: v })}
          />
          <Interruptor
            titulo="Predecir la primera serie"
            detalle="Antes de arrancar cada ejercicio: cuántas te salen. Mide qué tan bien te conocés el cuerpo."
            activo={preferencias.prediccionActiva !== false}
            onCambiar={(v) => cambiar({ prediccionActiva: v })}
          />
          <Interruptor
            titulo="Sonido"
            detalle="El descanso, el cambio de nivel y las sesiones redondas. Nada más suena."
            activo={preferencias.sonidoDescanso}
            onCambiar={(v) => cambiar({ sonidoDescanso: v })}
          />
          {/* En iOS no existe la API de vibración: la fila ni se muestra.
              Un interruptor muerto es peor que ninguno. */}
          {HAY_HAPTICA && (
            <Interruptor
              titulo="Vibración"
              detalle="Un patrón distinto por cada cosa que pasa. Sirve para no tener que mirar."
              activo={preferencias.haptica !== false}
              onCambiar={(v) => cambiar({ haptica: v })}
            />
          )}
          {/* La voz, con el mismo criterio que la vibración, y además con el de
              que sin una voz en español este teléfono no puede hablar: ahí la
              fila tampoco se muestra, porque prometería algo que no va a pasar.
              Una voz en inglés diciendo "flexiones declinadas" es peor que el
              silencio, y lo que se muestra en pantalla no depende de esto. */}
          {HAY_VOZ && vozElegida() && (
            <Interruptor
              titulo="Lyra habla"
              detalle="Dice en voz alta qué ejercicio viene cuando terminás uno. Una vez por ejercicio y nada más."
              activo={preferencias.voz !== false}
              onCambiar={(v) => cambiar({ voz: v })}
            />
          )}
          <div>
            <span className="canal">◐</span>
            <span className="nombre">Tema</span>
            <span className="flex gap-px">
              {(['claro', 'oscuro', 'sistema'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => cambiar({ tema: t })}
                  className="px-2.5 py-1.5 text-[0.625rem] uppercase tracking-wider"
                  style={{
                    border: '1px solid var(--color-regla)',
                    backgroundColor: preferencias.tema === t ? 'var(--color-vega)' : 'transparent',
                    color: preferencias.tema === t ? '#fff' : 'var(--color-glosa)',
                  }}
                >
                  {t}
                </button>
              ))}
            </span>
          </div>
          <div>
            <span className="canal">%</span>
            <span className="min-w-0">
              <span className="nombre block">La barra de 28 días</span>
              <span className="rotulo mt-0.5 block">cómo preferís leerla</span>
            </span>
            <span className="flex gap-px">
              {(['logrado', 'restante'] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => cambiar({ encuadre: e })}
                  className="px-2.5 py-1.5 text-[0.625rem] uppercase tracking-wider"
                  style={{
                    border: '1px solid var(--color-regla)',
                    backgroundColor:
                      (preferencias.encuadre ?? 'logrado') === e ? 'var(--color-vega)' : 'transparent',
                    color: (preferencias.encuadre ?? 'logrado') === e ? '#fff' : 'var(--color-glosa)',
                  }}
                >
                  {e === 'logrado' ? 'llevás' : 'faltan'}
                </button>
              ))}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <Rotulo>TUS DATOS</Rotulo>
        {almacenamiento && (
          <>
            <div className="registro mt-3">
              <div>
                <span className="canal">{almacenamiento.persistente ? '◆' : '◇'}</span>
                <span className="min-w-0">
                  <span className="nombre block">Almacenamiento</span>
                  <span className="rotulo mt-0.5 block">
                    {almacenamiento.persistente ? 'PROTEGIDO' : 'SIN PROTEGER'}
                  </span>
                </span>
                <span className="cifra-fila">
                  {almacenamiento.usado ? Math.round(almacenamiento.usado / 1024) : '—'}
                  <span className="unidad">kB</span>
                </span>
              </div>
              <div>
                <span className="canal">⟳</span>
                <span className="min-w-0">
                  <span className="nombre block">Copias automáticas</span>
                  <span className="rotulo mt-0.5 block">al cerrar cada sesión</span>
                </span>
                <span className="cifra-fila">{almacenamiento.copias}</span>
              </div>
            </div>

            {!almacenamiento.persistente && !almacenamiento.instalada && (
              <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-[var(--color-ambar)]">
                No hay servidor: esta base no es una copia de tus datos, es la única. Sin instalar
                la app, el navegador puede borrarla para liberar espacio, y Safari lo hace tras unos
                días sin abrirla. Instalarla lo resuelve: compartir → agregar a inicio.
              </p>
            )}
          </>
        )}

        <div className="mt-4 -mx-4">
          <AccionQuieta onClick={() => void descargar()}>Descargar una copia</AccionQuieta>
          <AccionQuieta onClick={() => archivo.current?.click()}>Restaurar una copia</AccionQuieta>
        </div>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importar(f)
            e.target.value = ''
          }}
        />
        {aviso && <p className="mt-3 text-sm text-[var(--color-glosa)]">{aviso}</p>}
      </section>

      <section className="mt-10 pb-4">
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            className="text-sm text-[var(--color-destructivo)] underline underline-offset-4"
          >
            Borrar todos mis datos
          </button>
        ) : (
          <div>
            <p className="max-w-[40ch] text-sm leading-relaxed">
              Esto borra todo el historial y no se puede deshacer. Las copias automáticas también.
            </p>
            <div className="mt-4 -mx-4">
              <Accion
                onClick={() => {
                  void borrarTodo()
                  setConfirmando(false)
                  setAviso('Listo. No quedó nada.')
                }}
              >
                Sí, borrar todo
              </Accion>
              <AccionQuieta onClick={() => setConfirmando(false)}>Mejor no</AccionQuieta>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

function Interruptor({
  titulo,
  detalle,
  activo,
  onCambiar,
}: {
  titulo: string
  detalle?: string
  activo: boolean
  onCambiar: (v: boolean) => void
}) {
  return (
    <button onClick={() => onCambiar(!activo)} className="fila-pulsable">
      <span className="canal">{activo ? '◆' : '◇'}</span>
      <span className="min-w-0">
        <span className="nombre block">{titulo}</span>
        {detalle && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
            {detalle}
          </span>
        )}
      </span>
      <span className="rotulo">{activo ? 'SÍ' : 'NO'}</span>
    </button>
  )
}
