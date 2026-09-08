# LyraFit

Entrenamiento de calistenia con progresiones reales. Registrás lo que hiciste y
la app decide qué te toca la próxima vez: cuándo sumar repeticiones, cuándo
cambiar de ejercicio y cuándo bajar la carga antes de que te lesiones. Y siempre
te dice por qué.

Funciona sin conexión, se instala como una app en el teléfono y no manda tus
datos a ningún lado.

## Por qué existe

Casi todas las apps de entrenamiento hacen una de dos cosas: te dan una tabla
fija que no se adapta a nadie, o te piden que decidas vos cuándo subir de nivel
—que es justamente lo que no sabés cuando estás empezando—.

Acá las reglas son explícitas, están escritas en un solo lugar y la app te las
muestra cada vez que decide algo. Nada de esperar a "sentirte listo".

## Qué hace

- **Cuatro cadenas de progresión** —empuje, tracción, piernas y core— con 39
  ejercicios, de la flexión en la pared a la flexión a una mano, y del remo
  australiano a la dominada a un brazo asistida. Cada uno con su técnica, sus
  errores típicos y su ventana de trabajo.
- **Test de nivel al empezar.** Cuatro preguntas con un dato objetivo —cuántas
  flexiones hacés, no si te considerás principiante— y la app te ubica en el
  eslabón que te corresponde en cada cadena.
- **Motor de progresión** que ajusta el objetivo sesión a sesión y explica en
  una frase por qué cambió.
- **Registro de series** con predicción previa, temporizador de descanso que no
  se atrasa aunque bloquees el teléfono, y la pantalla siempre encendida.
- **Chequeo diario opcional** de tres preguntas, que sirve sobre todo para que
  el motor no te baje el objetivo por dos días malos.
- **Progreso** con una curva de fuerza que no se corta cuando cambiás de
  ejercicio, y el mapa de dónde estás en cada cadena.
- **Tres rutinas** para elegir según cuántos días tengas, incluida una mínima de
  dos días para las semanas complicadas.

## Cómo se levanta

Necesitás Node 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # los tests del dominio
npm run typecheck  # revisar los tipos sin compilar
npm run build      # compilar para producción
npm run preview    # ver el resultado compilado
```

Para la revisión visual automática, con el proyecto compilado y `npm run
preview` corriendo en otra terminal:

```bash
node revisar.mjs   # recorre el alta y una sesión entera, y guarda capturas
node rescate.mjs   # revisa los datos: que no se pierda una sesión y que se midan dos números
```

## Cómo está armado

```
src/
  dominio/       las reglas, sin nada de React ni de base de datos
    tipos.ts         el vocabulario de la app
    biblioteca.ts    los 39 ejercicios y sus cadenas
    progresion.ts    el motor: cuándo subir, sostener o bajar
    adherencia.ts    lo que reemplaza a la racha
    estado.ts        el chequeo diario y su línea de base
    vitalidad.ts     el delta de energía y la calibración
    rutinas.ts       qué patrones se trabajan cada día
    estadisticas.ts  la curva de fuerza, récords, semanas
  datos/         la persistencia
    db.ts            el esquema de IndexedDB y sus migraciones
    repositorio.ts   la única puerta entre la app y la base
    respaldo.ts      la copia que ocurre sola
  pantallas/     una pantalla por archivo
  componentes/   las piezas visuales compartidas
  hooks/         temporizadores, tema, pantalla despierta
```

La separación importa. Todo `src/dominio/` son funciones puras: entra un dato,
sale un dato, no se toca ni la pantalla ni la base. Por eso el motor de
progresión se puede verificar entero con tests que corren en menos de un
segundo, y por eso cambiar las reglas no obliga a tocar ninguna pantalla.

### El motor

La idea es la misma a la que llegan todos los sistemas serios de calistenia:
**doble progresión**. Se suben repeticiones dentro de una ventana acotada y,
recién al llegar al techo, se pasa al eslabón siguiente.

Tres decisiones que parecen detalles y son las que hacen que funcione:

- **La memoria es una media móvil, no dos contadores.** Antes había una racha de
  éxitos y una de fallos que se reiniciaban entre sí, y eso tenía un agujero:
  una sesión que no era ni éxito ni fallo borraba las dos, así que quien quedaba
  siempre un poco corto no subía ni bajaba nunca. Una media móvil siempre se
  mueve: el motor no se puede trabar.
- **Quedarse quieto tiene fecha de vencimiento.** A las cuatro sesiones sin
  novedades el motor fuerza un cambio. Puede subir o bajar, pero no puede no
  hacer nada.
- **Cambiar de eslabón se calcula, no se inventa.** Cada ejercicio sabe qué
  fracción del peso del cuerpo mueve, así que cuánto bajar al subir de nivel
  sale de una cuenta. De ahí sale también la curva de fuerza: el índice de carga
  queda igual a los dos lados del salto, y por eso el gráfico no se desploma
  justo cuando progresás.

### Local-first

La fuente de verdad es tu dispositivo, en IndexedDB. No hay servidor. Eso hace
que la app ande en un parque sin señal igual que en tu casa, y también que la
base **no sea una copia de tus datos: sea la única**. Por eso hay tres cosas y
no una:

- una copia automática al cerrar cada sesión, que rota tres archivos y no pide
  permiso ni avisa;
- el pedido de persistencia al navegador —que en Safari es una consulta y no un
  pedido, así que se trata como diagnóstico—;
- y el aviso en **Ajustes → Tus datos** cuando la app no está instalada, que es
  lo que de verdad la protege en iPhone.

Cada escritura además deja una marca en la tabla `pendientes`. Hoy nadie las
lee: es la costura por donde va a entrar la sincronización.

### El sistema visual

Se llama **Efeméride**, que es como se llama una tabla astronómica: filas de
números, en silencio, que dicen dónde va a estar un cuerpo mañana.

Tiene dos registros y ninguno más. **El registro** es papel cálido con filas
regladas: cero tarjetas, cero sombras, cero esquinas redondeadas, cifras
monoespaciadas. **La carta** es una banda de cielo nocturno a sangre, idéntica
en tema claro y oscuro, donde cada cadena se dibuja como una constelación con
su propia silueta y el "estás acá" es lo único que brilla en toda la app.

Cuatro voces con jurisdicción estricta: mono para el dato, serif romana para la
identidad y solo a tamaño monumental, serif cursiva para el motor —nada más usa
cursiva— y la sans del sistema para la interfaz. Las fuentes van autoalojadas y
recortadas: suman 64 KB entre las cuatro.

### Decisiones que se ven raras hasta que se explican

- **No hay racha de días.** En una app de fuerza el descanso es parte del plan,
  así que premiar días consecutivos premia lo que no hay que hacer. En su lugar
  hay una ventana rodante de 28 días que nunca vuelve a cero, créditos de perdón
  para que faltar esté previsto, y un contador de sesiones que solo sube.
- **No hay rojo en nada del entrenamiento.** El techo de alarma es un ámbar. El
  rojo existe solo para borrar datos en Ajustes.
- **La sesión de siete minutos cuenta para la adherencia y no para la
  progresión.** Separar las dos cosas es lo que permite ser indulgente con la
  persona sin mentirle al motor.
- **`leerAvances()` solo lee, nunca escribe.** Las pantallas la usan a través de
  `useLiveQuery`, que corre en una transacción de solo lectura: una escritura
  ahí adentro revienta con `ReadOnlyError` la primera vez que alguien abre la
  app.
- **Los temporizadores guardan el momento de finalización, no un contador.** Los
  navegadores frenan los `setInterval` de las pestañas en segundo plano, que es
  exactamente lo que pasa cuando bloqueás el celular durante el descanso.
- **`HashRouter` en vez de `BrowserRouter`**, para andar igual en GitHub Pages,
  en un subdirectorio o abierta desde un archivo.
- **Los gráficos tienen su propia paleta**, separada de la de interfaz, y la
  carta tiene una tercera: un color calibrado para texto sobre papel no puede
  ser el mismo que un punto de luz sobre negro.
- **La pantalla de Progreso se carga aparte.** Es la única que usa la librería
  de gráficos, y esa librería pesa casi tanto como el resto de la app junta.

### Los tests

167 tests, y el que más importa es `simulacion.test.ts`. Los demás verifican las
reglas de a una —dado este avance y este resultado, tiene que salir esta
decisión—, y eso no alcanza: los dos peores defectos que tuvo este motor no eran
reglas mal escritas sino consecuencias de varias reglas correctas actuando
juntas a lo largo del tiempo. La simulación corre el motor decenas de sesiones
contra personas con capacidad fija y verifica lo que ninguna decisión suelta
puede mostrar: que nadie se traba, que las cadenas duran, y que el motor
converge donde la persona puede sostener sin rebotar.

El CI además corre la suite dos veces, una de ellas con `TZ` al este de
Greenwich. En UTC los errores de zona horaria no se ven.

## Publicar

El workflow de `.github/workflows/ci.yml` revisa los tipos, corre los tests en
dos husos, compila y publica en GitHub Pages en cada push a `main`. Para
activarlo, una vez:

**Settings → Pages → Source → GitHub Actions.**

Para Vercel o Netlify alcanza con conectar el repositorio: el comando de build
es `npm run build` y la carpeta de salida es `dist`. No definas `BASE_PATH` ahí
—esa variable existe solo porque Pages sirve el sitio desde `/nombre-del-repo/`—.

Conviene un dominio propio: la cuota y el desalojo de almacenamiento son **por
origen**, así que en `usuario.github.io` los datos de LyraFit comparten destino
con cualquier otro Pages de la misma cuenta.

## Hoja de ruta

El análisis completo que ordena esto está en
[`docs/estrategia-2026.md`](docs/estrategia-2026.md): auditoría del código con
simulaciones, benchmark de 106 productos y revisión de literatura científica.

Lo que sigue, en orden de utilidad real:

1. **Notificaciones.** No existe la notificación local programada en la web, así
   que la única vía es Web Push declarativo con un servidor mínimo: un JSON de
   200 bytes por usuario y por día, sin datos de entrenamiento y sin identidad.
2. **Módulo de alimentación.** Siete hábitos, cero calorías, en dos tablas
   nuevas de Dexie.
3. **Sueño.** Diario de tres campos, deuda sobre catorce días, una recomendación
   diaria.
4. **Resumen semanal** como narrativa, y tarjeta compartible generada en local.
5. **Sincronización entre dispositivos.** La tabla `pendientes` ya registra cada
   escritura. Si llega, va con un CRDT probado: un merge a mano con
   última-escritura-gana pierde series sin que nadie se entere.

## Licencia

MIT. Ver [LICENSE](LICENSE).
