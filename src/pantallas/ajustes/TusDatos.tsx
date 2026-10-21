import { useEffect, useRef, useState } from 'react'
import type { SesionEnCurso } from '@/dominio/tipos'
import {
  avisoDeRestaurada,
  cuantasSesiones,
  detalleDelResumen,
  fechaCorta,
  fraseDelReemplazo,
  resumenDeCopia,
  type ResumenDeCopia,
} from '@/dominio/copia'
import { diaLocal, textoDelBorradorAlRestaurar, tieneTrabajo } from '@/dominio/borrador'
import {
  RespaldoInvalido,
  exportarTodo,
  importarTodo,
  leerSesionEnCurso,
  validarRespaldo,
  type Respaldo,
} from '@/datos/repositorio'
import {
  estadoDeAlmacenamiento,
  respaldarAntesDeRestaurar,
  type EstadoDeAlmacenamiento,
} from '@/datos/respaldo'
import { Accion, AccionQuieta, Rotulo } from '@/componentes/ui'

/**
 * Una restauración a la espera de que la persona la confirme.
 *
 * `sinCopia` se prende si la copia automática de lo que hay falló: entonces no
 * se reemplaza nada sin decirlo, y el botón pasa a decir que va sin copia.
 *
 * `borrador` es la sesión a medio hacer, si tiene algo hecho: restaurar la
 * borra y no va en ninguna copia, así que se nombra antes de confirmar.
 */
interface Restauracion {
  copia: Respaldo
  deLaCopia: ResumenDeCopia
  actual: ResumenDeCopia
  sinCopia: boolean
  borrador: SesionEnCurso | null
}

/**
 * Cuánto ocupa la base, si está protegida y cuántas copias automáticas hay.
 *
 * Lo pide la pantalla al montarse y no la sección, que recién se dibuja con
 * las preferencias cargadas: así llega a la vez que el resto. `releer` es para
 * después de restaurar.
 */
export function useAlmacenamiento() {
  const [almacenamiento, setAlmacenamiento] = useState<EstadoDeAlmacenamiento | null>(null)

  useEffect(() => {
    void estadoDeAlmacenamiento().then(setAlmacenamiento)
  }, [])

  const releer = () => void estadoDeAlmacenamiento().then(setAlmacenamiento)
  return [almacenamiento, releer] as const
}

/** TUS DATOS: dónde viven, la copia que se descarga y la que se restaura. */
export function TusDatos({
  almacenamiento,
  releerAlmacenamiento,
}: {
  almacenamiento: EstadoDeAlmacenamiento | null
  releerAlmacenamiento: () => void
}) {
  const archivo = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [restauracion, setRestauracion] = useState<Restauracion | null>(null)
  const [restaurando, setRestaurando] = useState(false)

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

  /**
   * Elegir el archivo ya no reemplaza nada: lo revisa entero y muestra qué
   * trae al lado de lo que hay.
   *
   * Antes reemplazaba todo en el acto, sin preguntar y sin guardar lo
   * anterior, y el comentario de `importarTodo` decía que la pantalla pedía
   * confirmación. Con los nombres de archivo todos parecidos, equivocarse de
   * fecha costaba el historial entero.
   */
  async function importar(entrada: File) {
    setAviso(null)
    setRestauracion(null)
    try {
      const copia = validarRespaldo(JSON.parse(await entrada.text()))
      const [actual, borrador] = await Promise.all([exportarTodo(), leerSesionEnCurso()])
      setRestauracion({
        copia,
        deLaCopia: resumenDeCopia(copia),
        actual: resumenDeCopia(actual),
        sinCopia: false,
        borrador: borrador && tieneTrabajo(borrador) ? borrador : null,
      })
    } catch (error) {
      setAviso(
        error instanceof RespaldoInvalido
          ? `${error.message} No se cambió nada.`
          : 'No se pudo leer el archivo. ¿Es una copia de LyraFit? No se cambió nada.',
      )
    }
  }

  /**
   * Confirmado: primero la copia automática de lo que hay, después el
   * reemplazo, que es todo o nada.
   *
   * Si la copia automática no se puede guardar —un navegador sin sistema de
   * archivos privado— no se reemplaza en silencio: se avisa, y recién un
   * segundo toque, que ya dice "sin copia", reemplaza igual. Bloquearlo del
   * todo dejaría sin salida a quien perdió la base y viene a restaurar, que
   * es justo para lo que existe este botón.
   */
  async function confirmarRestauracion(r: Restauracion) {
    setRestaurando(true)
    try {
      if (!r.sinCopia && !(await respaldarAntesDeRestaurar())) {
        setRestauracion({ ...r, sinCopia: true })
        return
      }
      await importarTodo(r.copia)
      setRestauracion(null)
      setAviso(avisoDeRestaurada(r.copia.sesiones.length, !r.sinCopia))
      releerAlmacenamiento()
    } catch {
      setAviso('No se pudo restaurar. Tus datos quedaron como estaban.')
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <>
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
      {aviso && (
        <p className="mt-3 text-sm text-[var(--color-glosa)]" role="status">
          {aviso}
        </p>
      )}

      {restauracion && (
        <div className="mt-6" data-prueba="confirmar-restauracion">
          <Rotulo>ANTES DE REEMPLAZAR</Rotulo>
          <div className="registro mt-3">
            {(
              [
                [
                  '◇',
                  'El archivo',
                  restauracion.deLaCopia,
                  `copia del ${fechaCorta(diaLocal(Date.parse(restauracion.copia.exportadoEn)))}`,
                ],
                ['◆', 'Lo que tenés ahora', restauracion.actual, null],
              ] as const
            ).map(([canal, titulo, resumen, extra]) => (
              <div key={titulo}>
                <span className="canal">{canal}</span>
                <span className="min-w-0">
                  <span className="nombre block">{titulo}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
                    {[cuantasSesiones(resumen.sesiones), detalleDelResumen(resumen), extra]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span />
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-[40ch] text-sm leading-relaxed">
            {fraseDelReemplazo(restauracion.deLaCopia, restauracion.actual)}{' '}
            {restauracion.sinCopia
              ? ''
              : 'Antes de reemplazar guardo una copia automática de lo que tenés ahora.'}
          </p>
          {restauracion.borrador && (
            <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-[var(--color-ambar)]">
              {textoDelBorradorAlRestaurar(restauracion.borrador, diaLocal(Date.now()))}
            </p>
          )}
          {restauracion.sinCopia && (
            <p
              role="alert"
              className="mt-3 max-w-[42ch] text-xs leading-relaxed text-[var(--color-ambar)]"
            >
              No pude guardar una copia automática en este navegador, así que todavía no cambié
              nada. Si querés conservar lo que tenés, descargá una copia antes de seguir.
            </p>
          )}
          <div className="mt-4 -mx-4">
            <Accion
              deshabilitado={restaurando}
              onClick={() => void confirmarRestauracion(restauracion)}
            >
              {restauracion.sinCopia ? 'Reemplazar sin copia' : 'Sí, reemplazar'}
            </Accion>
            <AccionQuieta deshabilitado={restaurando} onClick={() => setRestauracion(null)}>
              Mejor no
            </AccionQuieta>
          </div>
        </div>
      )}
    </>
  )
}
