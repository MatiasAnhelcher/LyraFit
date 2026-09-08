import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { RUTINAS, DIA_CORTO } from '@/dominio/rutinas'
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
              onClick={() => cambiar({ rutinaActivaId: rutina.id })}
              className="fila-pulsable"
            >
              <span className="canal">
                {rutina.id === preferencias.rutinaActivaId ? '◆' : '◇'}
              </span>
              <span className="min-w-0">
                <span className="nombre block">{rutina.nombre}</span>
                <span className="rotulo mt-0.5 block">
                  {rutina.dias.map((d) => DIA_CORTO[d]).join(' · ')}
                </span>
              </span>
              <span className="cifra-fila">{rutina.dias.length}</span>
            </button>
          ))}
        </div>
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
            titulo="Predecir cada serie"
            detalle="Cuesta cero toques si aceptás el número. Mide qué tan bien te conocés el cuerpo."
            activo={preferencias.prediccionActiva !== false}
            onCambiar={(v) => cambiar({ prediccionActiva: v })}
          />
          <Interruptor
            titulo="Sonido"
            detalle="El fin del descanso, los récords y el cambio de nivel. Nada más suena."
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
