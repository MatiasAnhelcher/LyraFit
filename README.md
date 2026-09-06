# LyraFit

Entrenamiento de calistenia con progresiones reales. Registrás lo que hiciste y
la app decide qué te toca la próxima vez: cuándo sumar repeticiones, cuándo
cambiar de ejercicio y cuándo bajar la carga antes de que te lesiones.

Funciona sin conexión, se instala como una app en el teléfono y no manda tus
datos a ningún lado.

## Por qué existe

Casi todas las apps de entrenamiento hacen una de dos cosas: te dan una tabla
fija que no se adapta a nadie, o te piden que decidas vos cuándo subir de nivel
—que es justamente lo que no sabés cuando estás empezando—.

Acá la regla es explícita y está escrita en un solo lugar: cumplís el objetivo
dos sesiones seguidas y subís, fallás dos seguidas y bajás. Nada de esperar a
"sentirte listo".

## Qué hace

- **Cuatro cadenas de progresión** — empuje, tracción, piernas y core — con 25
  ejercicios ordenados de la flexión en la pared a la flexión a una mano, y del
  remo australiano a la dominada a un brazo asistida. Cada uno con su técnica,
  sus errores típicos y el criterio para pasar al siguiente.
- **Registro de series** con temporizador de descanso que no se atrasa aunque
  bloquees el teléfono.
- **Motor de progresión** que ajusta el objetivo sesión a sesión y te explica en
  una frase por qué cambió.
- **Progreso** por semana y por cadena, con el historial completo.
- **Tres rutinas** para elegir según cuántos días tengas, incluida una mínima de
  dos días para las semanas complicadas.

## Cómo se levanta

Necesitás Node 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # los tests del motor de progresión
npm run typecheck  # revisar los tipos sin compilar
npm run build      # compilar para producción
npm run preview    # ver el resultado compilado
```

Para la revisión visual automática, con el proyecto compilado y `npm run
preview` corriendo en otra terminal:

```bash
node revisar.mjs   # recorre la app y guarda capturas en capturas/
```

## Cómo está armado

```
src/
  dominio/       las reglas, sin nada de React ni de base de datos
    tipos.ts         el vocabulario de la app
    biblioteca.ts    los 25 ejercicios y sus cadenas
    progresion.ts    el motor: cuándo subir, sostener o bajar
    rutinas.ts       qué patrones se trabajan cada día
    estadisticas.ts  rachas, volumen, récords
  datos/         la persistencia
    db.ts            el esquema de IndexedDB y sus migraciones
    repositorio.ts   la única puerta entre la app y la base
  pantallas/     una pantalla por archivo
  componentes/   las piezas visuales compartidas
  hooks/         temporizadores y tema
```

La separación importa. Todo `src/dominio/` son funciones puras: entra un dato,
sale un dato, no se toca ni la pantalla ni la base. Por eso el motor de
progresión se puede verificar entero con tests que corren en menos de un
segundo, y por eso cambiar las reglas de progresión no obliga a tocar ninguna
pantalla.

### Local-first

La fuente de verdad es tu dispositivo, en IndexedDB. No hay servidor. Eso hace
que la app ande en un parque sin señal igual que en tu casa, y también que la
copia de seguridad sea responsabilidad tuya: en **Ajustes → Tus datos** podés
descargar un archivo con todo y restaurarlo en otro dispositivo.

Cada escritura además deja una marca en la tabla `pendientes`. Hoy nadie las
lee. Es la costura por donde va a entrar la sincronización, explicada abajo.

### Decisiones que se ven raras hasta que se explican

- **`leerAvances()` solo lee, nunca escribe.** Las pantallas la usan a través de
  `useLiveQuery`, que corre las consultas en una transacción de solo lectura.
  Una escritura ahí adentro revienta con `ReadOnlyError` la primera vez que
  alguien abre la app. Los avances iniciales se calculan en memoria y no se
  guardan hasta que hay algo real que guardar.
- **Los temporizadores guardan el momento de finalización, no un contador.** Los
  navegadores frenan los `setInterval` de las pestañas en segundo plano, que es
  exactamente lo que pasa cuando bloqueás el celular durante el descanso.
  Calculando contra el reloj real, volvés a la app y el número es el correcto.
- **`HashRouter` en vez de `BrowserRouter`.** Así la app anda igual en GitHub
  Pages, en un subdirectorio o abierta desde un archivo, sin configurar
  redirecciones del lado del servidor.
- **Los gráficos tienen su propia paleta**, separada de los colores de la
  interfaz. Un color pensado para un título sobre fondo blanco casi nunca sirve
  como relleno de una barra. Los cuatro valores de cada tema están verificados
  contra su superficie: banda de luminosidad, separación para daltonismo y
  contraste mínimo.
- **La pantalla de Progreso se carga aparte.** Es la única que usa la librería
  de gráficos, y esa librería pesa casi tanto como el resto de la app junta.

## Publicar

El workflow de `.github/workflows/ci.yml` revisa los tipos, corre los tests,
compila y publica en GitHub Pages en cada push a `main`. Para activarlo, una vez:

**Settings → Pages → Source → GitHub Actions.**

Para Vercel o Netlify alcanza con conectar el repositorio desde su panel: el
comando de build es `npm run build` y la carpeta de salida es `dist`. No definas
`BASE_PATH` ahí — esa variable existe solo porque Pages sirve el sitio desde
`/nombre-del-repo/`.

## Hoja de ruta

En orden de utilidad real, no de dificultad:

1. **Descanso en segundo plano.** Que el aviso llegue aunque la app esté
   cerrada, con la API de notificaciones del service worker.
2. **Más cadenas.** Verticales (de la parada de manos contra la pared al pino
   libre) y fondos en paralelas.
3. **Sincronización entre dispositivos.** La tabla `pendientes` ya registra cada
   escritura. Falta un backend —Firebase o Supabase alcanzan— y un proceso que
   vacíe esa cola cuando hay red, resolviendo conflictos por
   `actualizadoEn`. La app no necesita cambiar: la costura ya está puesta.
4. **Deload programado.** Cada cierto tiempo, una semana suave automática.
5. **Notas por sesión.** Cómo te sentiste, para leerlo al revisar una racha
   mala.

## Licencia

MIT. Ver [LICENSE](LICENSE).
