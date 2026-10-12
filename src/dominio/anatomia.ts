/**
 * La anatomía dibujada: la silueta y cada músculo, en coordenadas.
 *
 * Vive en el dominio y no en el componente por el mismo motivo que
 * `posturas.ts` vive separado de `figura.tsx`: son datos que se revisan, se
 * miden y se miran con una herramienta aparte, y un archivo de datos que no
 * importa nada de runtime se puede abrir sin levantar la app entera.
 *
 * ## La convención
 *
 * Media persona. El eje está en x = 50 y el lienzo es 100 × 210; la otra mitad
 * la pone el componente con un `scale(-1, 1)`. Los músculos son simétricos, así
 * que escribir los dos lados sería garantizar que algún día se corrija uno solo
 * — es el mismo motivo por el que el arco del descanso vive en un solo archivo.
 *
 * ## Las proporciones no son a ojo
 *
 * Siete cabezas y media, que es el canon de dibujo anatómico y lo que hace que
 * una figura se lea como persona y no como muñeco. Sobre 210 de alto:
 *
 *     cabeza    4 →  32      hombro        46      ombligo   82
 *     cuello   32 →  38      cintura       84      cadera   100
 *     entrepierna  106       rodilla      155      tobillo  198
 *
 * La primera versión de esto tenía el torso largo, las piernas cortas y pegadas
 * en una sola losa, y los brazos sueltos al costado. Se veía exactamente como
 * lo que el dueño había criticado del dibujante de posturas, así que se
 * rehízo: los brazos ahora son parte del contorno —un brazo pegado con una
 * costura visible en el hombro es lo que hace que un dibujo parezca recortado—
 * y entre las piernas hay un hueco de verdad.
 */

import type { Aporte, Musculo } from './musculos'

/** El lienzo de cada vista. Alto y angosto, como una persona. */
export const ANCHO = 100
export const ALTO = 210

/**
 * La silueta entera de media persona, en un solo trazo: cabeza, cuello,
 * hombro, brazo completo, costado, pierna y vuelta por el centro.
 *
 * Va en un trazo y no en piezas porque el hombro y la axila son la misma curva:
 * partirlos deja un escalón que, a tamaño de teléfono, se lee como un error de
 * registro.
 */
export const SILUETA =
  // ── Tronco, cabeza y piernas ──────────────────────────────────────────
  // cabeza y cuello
  'M48 5 C56 5 60 11 60 19 C60 25 57 30 54 32 ' +
  'L54 38 C60 39 66 42 70 47 ' +
  // costado: axila, cintura, cadera
  'C68 53 66 61 64 70 C62 77 60 82 58 88 ' +
  'C61 93 64 97 65 104 C66 110 66 114 66 120 ' +
  // muslo, rodilla, pantorrilla, tobillo
  'C65 132 63 144 61 156 C60 167 58 179 57 190 ' +
  'C57 194 56 197 56 200 ' +
  // pie
  'C60 201 64 203 64 206 L52 206 ' +
  // vuelta por dentro de la pierna hasta la entrepierna
  'C52 200 53 191 53 181 C54 167 54 151 53 135 C53 125 52 115 52 109 ' +
  'L48 107 L48 5 Z ' +
  // ── El brazo, subcamino aparte ────────────────────────────────────────
  // Va suelto a propósito: con el brazo adentro del mismo contorno, la axila y
  // el costado son la misma curva y el brazo queda fundido al torso. Como
  // subcamino que PISA el hombro, la unión no tiene costura y abajo queda el
  // hueco que tiene que haber entre el brazo y las costillas. La segunda
  // versión lo tenía pegado al costado y el hueco medía dos unidades: a tamaño
  // de teléfono eso no es un hueco, es un error de impresión.
  'M66 43 C73 45 78 51 79 60 C80 70 79 80 78 89 ' +
  'C77 100 76 111 75 121 C74 129 73 134 71 137 ' +
  'C69 138 68 136 68 132 C68 125 69 113 70 103 ' +
  'C71 94 71 86 71 78 C71 69 70 60 68 53 Z'

/**
 * Cada músculo, en la vista donde se ve.
 *
 * El criterio para incluir un músculo en una vista es si se VE desde ahí, no si
 * está. El psoas es profundo y no se ve desde ningún lado: se dibuja en la
 * ingle, de frente, porque es donde la persona lo siente.
 */
export const FRENTE: Partial<Record<Musculo, string>> = {
  'deltoide-anterior':
    'M62 42 C68 43 73 46 76 52 C77 56 76 60 74 62 C70 56 66 51 61 48 C60 45 61 43 62 42 Z',
  'deltoide-lateral':
    'M73 46 C78 49 80 56 80 63 C80 68 79 72 78 75 L73 72 C74 66 74 59 73 52 Z',
  pectoral:
    'M51 45 C58 45 64 47 68 51 C70 55 69 61 66 65 C61 68 56 69 51 69 Z',
  serrato:
    'M63 70 C66 70 68 72 69 75 L67 78 C65 77 63 75 62 73 Z ' +
    'M62 78 C65 78 67 80 68 83 L66 86 C64 85 62 83 61 81 Z',
  biceps:
    'M71 59 C76 60 78 65 78 72 C78 78 77 84 76 88 L71 86 C72 79 72 71 71 65 Z',
  antebrazo:
    'M71 92 C75 93 77 98 77 105 C77 113 76 120 75 124 L70 122 C71 116 71 108 71 100 Z',
  'recto-abdominal':
    'M51 71 C56 71 60 72 62 74 C62 84 62 93 61 101 C58 103 55 104 51 104 Z',
  oblicuos:
    'M63 75 C66 77 68 81 68 86 C68 93 66 99 63 103 L61 102 C62 94 62 84 62 76 Z',
  psoas:
    'M52 103 C56 103 60 105 62 108 C62 112 61 115 59 117 L52 115 Z',
  cuadriceps:
    'M52 113 C58 113 63 116 65 121 C65 133 63 145 61 154 C57 156 54 156 52 155 Z',
  aductor:
    'M52 113 C55 114 57 117 57 122 C57 133 56 142 54 149 L52 149 Z',
  gemelo:
    'M54 158 C59 159 62 164 62 171 C62 180 60 188 58 193 L54 192 Z',
}

export const ESPALDA: Partial<Record<Musculo, string>> = {
  'deltoide-posterior':
    'M63 43 C68 43 73 46 75 51 C76 55 75 59 73 61 C70 56 66 51 62 49 C61 46 62 44 63 43 Z',
  'deltoide-lateral':
    'M73 46 C78 49 80 56 80 63 C80 68 79 72 78 75 L73 72 C74 66 74 59 73 52 Z',
  'espalda-media':
    'M51 37 C58 39 65 42 70 47 C71 51 70 56 68 59 C62 56 56 55 51 55 Z ' +
    'M51 57 C57 57 62 59 66 62 L65 70 C60 67 55 66 51 66 Z',
  dorsal:
    'M51 68 C57 68 62 70 66 74 C67 82 65 91 61 98 C57 101 54 102 51 102 Z',
  triceps:
    'M71 58 C76 59 79 65 79 72 C79 79 78 85 77 89 L71 87 C72 79 72 71 71 64 Z',
  antebrazo:
    'M71 92 C75 93 77 98 77 105 C77 113 76 120 75 124 L70 122 C71 116 71 108 71 100 Z',
  erectores:
    'M51 60 C54 60 57 62 58 66 C58 78 57 90 56 100 L51 100 Z',
  'gluteo-mayor':
    'M51 103 C58 103 64 107 66 114 C66 123 62 130 55 132 L51 132 Z',
  'gluteo-medio':
    'M60 100 C64 101 67 105 67 110 C67 115 66 118 64 120 C63 113 61 106 58 103 Z',
  isquiotibial:
    'M52 133 C58 133 63 136 64 141 C64 148 63 153 61 157 C57 158 54 158 52 157 Z',
  gemelo:
    'M53 160 C59 161 63 166 63 174 C63 183 61 190 58 195 L53 194 Z',
}

/**
 * Cuánta tinta lleva cada aporte.
 *
 * El salto de 0,25 a 0,5 es grande a propósito: el estabilizador tiene que
 * leerse como "acá pasa algo" y el secundario como "esto trabaja". Si la escala
 * fuera lineal, el 0,25 se confundiría con el primario a la distancia de un
 * teléfono, y el 0,25 es justamente lo que `PISO_DE_DOSIS` declara que NO es
 * una dosis.
 */
export const TINTA: Record<Aporte, number> = {
  1: 0.95,
  0.5: 0.46,
  0.25: 0.17,
}
