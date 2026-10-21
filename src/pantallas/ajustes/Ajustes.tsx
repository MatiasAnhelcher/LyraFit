import { useLiveQuery } from 'dexie-react-hooks'
import {
  DIAS,
  NOMBRE_CLASE,
  NOMBRE_DIA,
  RUTINAS,
  RUTINAS_POR_GRUPO,
  revisarSemana,
  rutinaActiva,
  tieneFuelle,
  semanaActiva,
  semanaDe,
  siguienteClase,
} from '@/dominio/rutinas'
import type { ClaseDeDia } from '@/dominio/rutinas'
import type { Preferencias } from '@/dominio/tipos'
import { cambiarBarraDeDominadas, guardarPreferencias, leerPreferencias } from '@/datos/repositorio'
import { HAY_HAPTICA } from '@/respuesta'
import { HAY_VOZ, vozElegida } from '@/voz'
import { orden, useMovimientoReducido } from '@/componentes/movimiento'
import { movimientoAlTocar, movimientoGuardado } from '@/dominio/movimiento'
import {
  Cargando,
  Interruptor,
  MarcaRadio,
  Regleta,
  Rotulo,
  SIMBOLO_CLASE,
  Segmento,
  SemanaDeRutina,
  Simbolo,
} from '@/componentes/ui'
import { BorrarTodo } from './BorrarTodo'
import { TusDatos, useAlmacenamiento } from './TusDatos'

export function Ajustes() {
  const preferencias = useLiveQuery(leerPreferencias, [])
  const [almacenamiento, releerAlmacenamiento] = useAlmacenamiento()
  const reducido = useMovimientoReducido()

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

  return (
    <>
      <Rotulo>AJUSTES</Rotulo>

      <section className="entrar-en-orden mt-6" style={orden(0)}>
        <Rotulo>RUTINA</Rotulo>
        {/* Las de cuerpo entero primero y las de grupo después, con un corte
            entre medio. No es orden alfabético ni de llegada: son dos clases
            de decisión distintas y mezclarlas haría parecer que "Brazos" y
            "Cuerpo completo" son opciones del mismo tipo. */}
        <div className="registro mt-3">
          {RUTINAS.filter((r) => !RUTINAS_POR_GRUPO.has(r.id)).map((rutina) => (
            <button
              key={rutina.id}
              onClick={() => elegirPreset(rutina.id)}
              aria-pressed={rutina.id === preferencias.rutinaActivaId}
              className="fila-pulsable"
            >
              <span className="canal">
                <MarcaRadio elegida={rutina.id === preferencias.rutinaActivaId} />
              </span>
              <span className="min-w-0">
                <span className="nombre block">{rutina.nombre}</span>
                {/* Lo que el preset trae es su semana, y se dibuja con los
                    mismos símbolos que la grilla de abajo para que se vea que
                    es lo mismo: elegirlo escribe eso ahí. */}
                <SemanaDeRutina semana={semanaDe(rutina)} />
              </span>
              <span className="cifra-fila">{rutina.dias.length}</span>
            </button>
          ))}
        </div>

        <p className="rotulo mt-6">POR GRUPO MUSCULAR</p>
        {/*
          Qué implica, dicho ACÁ y no después de elegir.
          Si se hacen las cuatro, a cada una le toca un día. Antes esto decía
          además que "con el mismo volumen semanal dos veces rinde más", sin
          ninguna fuente, y el consejo que seguía bajaba la frecuencia en vez
          de subirla. Tampoco dice "cada músculo un solo día": el core está en
          tres de las cuatro y Brazos repite tracción y empuje (ver
          `advertenciaDe`). Va antes de las filas: una advertencia que aparece
          una vez elegido no es una advertencia, es una excusa.

          Y se dice, no se impide. Hay razones legítimas para elegirlo —mucho
          más volumen por grupo en la sesión, y una sesión que se siente de
          algo en vez de un poco de todo— y si la cosa se sostiene seis meses
          porque dan ganas de entrar, eso también cuenta.
        */}
        <p className="mt-2 max-w-[42ch] texto-glosa">
          Cada una entrena un grupo por sesión, con cuatro o cinco ejercicios en
          vez de uno. Si hacés las cuatro en la semana, a cada una le toca un
          día.
        </p>
        <div className="registro mt-3">
          {RUTINAS.filter((r) => RUTINAS_POR_GRUPO.has(r.id)).map((rutina) => (
            <button
              key={rutina.id}
              onClick={() => elegirPreset(rutina.id)}
              aria-pressed={rutina.id === preferencias.rutinaActivaId}
              className="fila-pulsable"
            >
              <span className="canal">
                <MarcaRadio elegida={rutina.id === preferencias.rutinaActivaId} />
              </span>
              <span className="min-w-0">
                <span className="nombre block">{rutina.nombre}</span>
                <span className="rotulo mt-0.5 block truncate">
                  {/* Qué trae, que es lo que la persona quiere saber al
                      elegirla: los ejercicios, no los días. Los días de estas
                      cuatro son los mismos. */}
                  {rutina.bloques.length} ejercicios
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
      <section className="entrar-en-orden mt-8" style={orden(1)}>
        <Rotulo>LA SEMANA</Rotulo>
        <p className="mt-2 max-w-[42ch] texto-glosa">
          Tocá un día para cambiarlo. Fuerza es la sesión de siempre; fuelle es
          acondicionamiento, sin una sola serie de la que el motor opine; las dos mete
          las ráfagas adentro de los descansos y un bloque metabólico al final.
        </p>
        <div className="registro mt-3">
          {DIAS.map((dia) => {
            const clase: ClaseDeDia = semana[dia] ?? 'descanso'
            return (
              <button key={dia} onClick={() => ciclarDia(dia)} className="fila-pulsable">
                <span className="canal">
                  <Simbolo nombre={SIMBOLO_CLASE[clase]} />
                </span>
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
                className="max-w-[42ch] texto-glosa"
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
      <section className="entrar-en-orden mt-8" style={orden(2)}>
        <Rotulo>EL FUELLE</Rotulo>
        <p className="mt-2 max-w-[42ch] texto-glosa">
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
          ).map(([valor, titulo, detalle]) => {
            const elegida =
              (preferencias.densidad === undefined || preferencias.densidad === 'apagada'
                ? 'suave'
                : preferencias.densidad) === valor
            return (
            <button
              key={valor}
              onClick={() => cambiar({ densidad: valor })}
              aria-pressed={elegida}
              className="fila-pulsable"
            >
              <span className="canal">
                <MarcaRadio elegida={elegida} />
              </span>
              <span className="min-w-0">
                <span className="nombre block">{titulo}</span>
                <span className="mt-0.5 block texto-glosa">
                  {detalle}
                </span>
              </span>
              <span />
            </button>
            )
          })}
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

      <section className="entrar-en-orden mt-8" style={orden(3)}>
        <Rotulo>TU PESO Y LA BARRA</Rotulo>
        {/* Por qué la app pregunta el peso, que es lo primero que uno se
            pregunta cuando una app de ejercicio lo pide.

            El `ccr` de cada ejercicio es una FRACCIÓN del peso del cuerpo, y
            un disco son kilos absolutos. Sin este número no hay forma de pasar
            veinte kilos a la escala en la que el motor mide, y la app no
            podría leer una serie con lastre sin equivocarse: medido, un
            objetivo de 3×10 hecho 6-6-5 con veinte kilos daba rendimiento 0,55
            y el motor BAJABA el objetivo cuando la carga había subido.

            Mientras no esté, nada cambia y los kilos no se ofrecen. */}
        <p className="mt-2 max-w-[42ch] texto-glosa">
          Tu peso es lo único que deja convertir los kilos de la barra a la escala en la que el
          motor mide la carga. No se publica, no se compara con nada y no sale del teléfono. Sin
          él, la app sigue funcionando igual que siempre y no te va a ofrecer poner discos.
        </p>
        <div className="registro mt-3">
          <Numero
            titulo="Tu peso"
            detalle="Aproximado alcanza. Se usa solo para la cuenta de carga."
            valor={preferencias.pesoCorporalKg}
            unidad="kg"
            paso={1}
            minimo={35}
            maximo={200}
            vacio="sin decir"
            onCambiar={(v) => cambiar({ pesoCorporalKg: v })}
          />
          {preferencias.pesoCorporalKg !== undefined && (
            <>
              <Numero
                titulo="Barra cargable"
                detalle="Hasta cuántos kilos podés ponerle, contando la barra. En cero, no tenés."
                valor={preferencias.cargaMaximaKg}
                unidad="kg"
                paso={5}
                minimo={0}
                maximo={200}
                vacio="no tengo"
                onCambiar={(v) => cambiar({ cargaMaximaKg: v })}
              />
              {(preferencias.cargaMaximaKg ?? 0) > 0 && (
                <Numero
                  titulo="El disco más chico"
                  detalle="Lo que de verdad podés agregar de una vez. Es el paso con el que va a subir la carga."
                  valor={preferencias.pasoDeDiscoKg}
                  unidad="kg"
                  paso={1.25}
                  minimo={1.25}
                  maximo={10}
                  vacio="2,5"
                  onCambiar={(v) => cambiar({ pasoDeDiscoKg: v })}
                />
              )}
            </>
          )}
          {/* La barra de dominadas, que no es la cargable. Se contesta en el
              alta y hasta ahora no se podía cambiar nunca, aunque el alta dice
              "por ahora no". Ahora pesa más: sin barra el motor no sube a nada
              colgado, así que quien la consigue tiene que poder decirlo. Ausente
              cuenta como sí, igual que en el resto de la app. Apagarla baja lo
              que estaba colgado: eso lo hace `cambiarBarraDeDominadas`. */}
          <Interruptor
            titulo="Tengo dónde colgarme"
            detalle="Una barra de dominadas, unas anillas o una rama firme. Sin eso, el plan no te pide nada colgado: si estabas en algo colgado, volvés a lo último que no cuelga."
            activo={preferencias.tieneBarra !== false}
            onCambiar={(v) => void cambiarBarraDeDominadas(v)}
          />
        </div>
      </section>

      <section className="entrar-en-orden mt-8" style={orden(4)}>
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
          {/* Muestra lo que rige y no lo guardado: con el valor en
              "sistema" y el teléfono pidiendo calma, dice SÍ aunque nadie lo
              haya tocado, porque eso es lo que se ve. Tocarlo escribe siempre
              lo contrario de lo que se ve, así que nunca hay un toque que no
              cambia nada. */}
          <Interruptor
            titulo="Movimiento reducido"
            detalle="Nada se anima y las pantallas cambian en seco. El arco del descanso sigue contando."
            estado={{ texto: 'Como en tu teléfono', visible: movimientoGuardado(preferencias) === 'sistema' }}
            activo={reducido}
            onCambiar={() => cambiar({ movimiento: movimientoAlTocar(reducido) })}
          />
          <div>
            <span className="canal">%</span>
            <span className="min-w-0">
              <span className="nombre block">La barra de 28 días</span>
              <span className="rotulo mt-0.5 block">cómo preferís leerla</span>
            </span>
            <Regleta etiqueta="Cómo leer la barra de 28 días">
              {(['logrado', 'restante'] as const).map((e) => (
                <Segmento
                  key={e}
                  elegido={(preferencias.encuadre ?? 'logrado') === e}
                  onClick={() => cambiar({ encuadre: e })}
                >
                  {e === 'logrado' ? 'llevás' : 'faltan'}
                </Segmento>
              ))}
            </Regleta>
          </div>
        </div>
      </section>

      <section className="entrar-en-orden mt-8" style={orden(5)}>
        <TusDatos
          almacenamiento={almacenamiento}
          releerAlmacenamiento={releerAlmacenamiento}
        />
      </section>

      <section className="entrar-en-orden mt-10 pb-4" style={orden(6)}>
        <BorrarTodo />
      </section>
    </>
  )
}

/**
 * Una fila con un número que se sube y se baja.
 *
 * No es un campo de texto a propósito: un teclado numérico en un teléfono tapa
 * media pantalla para escribir dos dígitos, y acá los dos únicos números que
 * se piden se mueven de a pasos conocidos. Con `vacio` la fila dice que no hay
 * dato en vez de mostrar un cero, que sería un dato escrito.
 */
function Numero({
  titulo,
  detalle,
  valor,
  unidad,
  paso,
  minimo,
  maximo,
  vacio,
  onCambiar,
}: {
  titulo: string
  detalle?: string
  valor: number | undefined
  unidad: string
  paso: number
  minimo: number
  maximo: number
  /** Qué se lee cuando todavía no hay número. */
  vacio: string
  onCambiar: (v: number) => void
}) {
  const mover = (cuanto: number) => {
    const base = valor ?? minimo
    const nuevo = Math.min(maximo, Math.max(minimo, Math.round((base + cuanto) / paso) * paso))
    onCambiar(Number(nuevo.toFixed(2)))
  }
  return (
    <div>
      <span className="canal">
        <Simbolo nombre={valor === undefined ? 'rombo-vacio' : 'rombo'} />
      </span>
      <span className="min-w-0">
        <span className="nombre block">{titulo}</span>
        {detalle && (
          <span className="mt-0.5 block texto-glosa">
            {detalle}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <button
          onClick={() => mover(-paso)}
          className="paso h-10 w-10"
          aria-label={`Bajar ${titulo.toLowerCase()}`}
        >
          −
        </button>
        <span className="cifra w-20 text-center text-sm">
          {valor === undefined ? vacio : `${valor} ${unidad}`}
        </span>
        <button
          onClick={() => mover(paso)}
          className="paso h-10 w-10"
          aria-label={`Subir ${titulo.toLowerCase()}`}
        >
          +
        </button>
      </span>
    </div>
  )
}
