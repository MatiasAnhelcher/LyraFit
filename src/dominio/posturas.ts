/**
 * Las posturas de cada ejercicio.
 *
 * Catorce números y una línea de texto por ejercicio. La convención está en
 * `figuras.ts` y conviene tenerla presente para leer esto: los ángulos son
 * absolutos y en grados, **0 apunta a la derecha y 90 hacia arriba**, y la
 * persona siempre mira a la derecha.
 *
 * Dos cosas que se aprenden dibujando y ahorran horas:
 *
 * - **El cuerpo tumbado no es horizontal.** En una plancha los hombros quedan a
 *   la altura del brazo sobre el piso y los tobillos casi tocándolo, así que la
 *   línea del cuerpo está inclinada unos veinte grados. Dibujarla en cero deja
 *   los pies flotando y se nota enseguida.
 * - **La cadera va detrás del tobillo en cualquier sentadilla.** Como la
 *   persona mira a la derecha, "atrás" es la izquierda: el tobillo termina con
 *   una x mayor que la cadera.
 */

import type { Figura } from './figuras'

/**
 * La inclinación de un cuerpo sostenido por los brazos.
 *
 * Sale de la geometría, no del ojo: con los hombros a la altura de un brazo
 * estirado sobre el piso y los tobillos a la altura de un pie, la línea que une
 * hombro y tobillo queda a unos veinte grados. Está acá con nombre porque se
 * repite en las once flexiones y en las dos planchas, y porque cuando algo se
 * repite once veces conviene que se pueda cambiar en un solo lugar.
 */
const TUMBADO = 19
/** El mismo cuerpo, mirando en la dirección contraria: hacia los pies. */
const HACIA_LOS_PIES = 180 + TUMBADO

export const POSTURAS: Record<string, Figura> = {
  // ─── Empuje ────────────────────────────────────────────────────────

  /**
   * ARREGLADO: el apoyo era 'manos' y ahora es 'pies'. El esquema sí lo
   * admite, así que no había nada que impidiera escribirlo, y con 'manos'
   * el dibujo estaba roto de verdad: el dibujante clava la muñeca en el
   * piso y todo lo demás queda debajo (cadera 15 unidades bajo el piso,
   * tobillo 44), o sea la persona enterrada de cabeza. Con 'pies' el
   * tobillo cae en 88, el hombro queda a 45.9 del piso y la muñeca a 44.1,
   * así que el cajón se dibuja desde la mano hasta abajo: la pared a la
   * altura del pecho. Los ángulos no los toqué porque ya estaban
   * calculados para este apoyo — verifiqué la muñeca en las dos posturas y
   * se corre 0.11.
   */
  'flexion-pared': {
    escena: 'apoyo-manos',
    apoyo: 'pies',
    gesto: 'El cuerpo entero se acerca a la pared en una sola línea, con los codos bajando pegados a las costillas.',
    inicio: {
      torso: 72,
      cuello: 72,
      brazo: -5,
      antebrazo: -5,
      muslo: 252,
      pantorrilla: 252,
      pie: 0,
    },
    fin: {
      torso: 65,
      cuello: 65,
      brazo: -36,
      antebrazo: 51,
      muslo: 245,
      pantorrilla: 245,
      pie: 0,
    },
  },

  /**
   * Verificado y sin cambios. Cajón de 31.1 px, la mesada a la altura de
   * la cintura: el hombro queda a 41.7 del piso y la mano a 31.1, y de ahí
   * salen juntos el torso 58 y el brazo -31. La muñeca da (81.6, 56.9) en
   * las dos posturas —se corre 0.02— y el dedo del pie toca 88 exacto en
   * las dos. Ningún punto cruza el piso.
   */
  'flexion-inclinada-alta': {
    escena: 'apoyo-manos',
    apoyo: 'pies',
    gesto: 'Casi parado todavía: el pecho baja al borde y los codos van hacia atrás, no a los costados.',
    inicio: {
      torso: 58,
      cuello: 58,
      brazo: -31,
      antebrazo: -31,
      muslo: 238,
      pantorrilla: 238,
      pie: -12,
    },
    fin: {
      torso: 50,
      cuello: 50,
      brazo: -69,
      antebrazo: 27,
      muslo: 230,
      pantorrilla: 230,
      pie: -12,
    },
  },

  /**
   * Verificado y sin cambios. Cajón de 21.1 px —el banco o la mesa firme—
   * y el torso 47 es la inclinación que le corresponde a esa altura con el
   * brazo estirado. La muñeca se corre 0.07 entre las dos posturas y el
   * pie sigue clavado en 88; el pie a -40 deja el tobillo 2.2 arriba del
   * piso, que es la persona pasando a la punta del pie a medida que el
   * cuerpo se vuelca.
   */
  'flexion-inclinada': {
    escena: 'apoyo-manos',
    apoyo: 'pies',
    gesto: 'El mismo movimiento con el cuerpo más volcado: cuanto más bajo el apoyo, más peso cae en los brazos.',
    inicio: {
      torso: 47,
      cuello: 47,
      brazo: -53,
      antebrazo: -53,
      muslo: 227,
      pantorrilla: 227,
      pie: -40,
    },
    fin: {
      torso: 38,
      cuello: 38,
      brazo: -99,
      antebrazo: 3,
      muslo: 218,
      pantorrilla: 218,
      pie: -40,
    },
  },

  /**
   * Verificado y sin cambios. Cajón de 13.8 px —el escalón o el asiento de
   * la silla— y con esa altura el brazo ya sale casi vertical (-80). La
   * muñeca se corre 0.07, el pie no se mueve, y abajo el codo queda en
   * 68.8, o sea 19.2 arriba del piso: nunca por debajo.
   */
  'flexion-inclinada-baja': {
    escena: 'apoyo-manos',
    apoyo: 'pies',
    gesto: 'Ya casi la mitad del peso en las manos; el cuerpo baja entero, sin quebrar la cadera.',
    inicio: {
      torso: 40,
      cuello: 40,
      brazo: -80,
      antebrazo: -80,
      muslo: 220,
      pantorrilla: 220,
      pie: -62,
    },
    fin: {
      torso: 29,
      cuello: 29,
      brazo: -141,
      antebrazo: -36,
      muslo: 209,
      pantorrilla: 209,
      pie: -62,
    },
  },

  /**
   * Verificado y sin cambios. El 38 sale de la geometría: con las manos en
   * el piso el hombro queda a un brazo estirado y la línea rodilla-hombro
   * mide 0.533, así que asin(0.332/0.533) = 38.5. Comprobé lo que importa
   * acá, que es la rodilla: cae en 87.8 en las dos posturas —0.2 del piso—
   * y se corre 0.3 entre una y otra. La tibia levantada (pantorrilla 150,
   * pie 132) deja el pie en el aire a propósito, que es lo que distingue
   * el dibujo de una flexión completa.
   */
  'flexion-rodillas': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'El apoyo pasa a las rodillas: la línea va de la rodilla a la cabeza y baja completa, sin sentarse en los talones.',
    inicio: {
      torso: 38,
      cuello: 38,
      brazo: -86,
      antebrazo: -86,
      muslo: 218,
      pantorrilla: 150,
      pie: 132,
    },
    fin: {
      torso: 23,
      cuello: 23,
      brazo: -145,
      antebrazo: -46,
      muslo: 203,
      pantorrilla: 150,
      pie: 132,
    },
  },

  'flexion-completa': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'El cuerpo baja entero, en una sola línea, doblando los codos hacia atrás.',
    inicio: {
      torso: TUMBADO,
      cuello: TUMBADO,
      brazo: -90,
      antebrazo: -90,
      muslo: HACIA_LOS_PIES,
      pantorrilla: HACIA_LOS_PIES,
      pie: -78,
    },
    fin: {
      // Abajo el cuerpo queda MÁS horizontal, no igual. El hombro baja ocho
      // unidades y los pies no se mueven, así que la línea del cuerpo se
      // acuesta: dibujarla con la misma inclinación que arriba hunde los pies
      // debajo del piso, que es exactamente lo que pasaba.
      torso: 11,
      cuello: 11,
      // El hombro se adelanta sobre la mano: el brazo apunta hacia adelante y
      // el antebrazo vuelve hacia atrás, que es el codo pegado al cuerpo del
      // que habla la técnica.
      brazo: -28,
      antebrazo: -128,
      muslo: 180 + 11,
      pantorrilla: 180 + 11,
      pie: -60,
    },
  },

  /**
   * Verificado y sin cambios. Lo único que separa esto de la flexión
   * completa de perfil es dónde cae la mano: 5.3 px detrás del hombro en
   * vez de justo debajo, y eso es el brazo a -105. Con la mano ahí el
   * torso da 18, un grado menos que la completa. Abajo el cuerpo se
   * acuesta a 9 y el dedo del pie queda en 86.4 en las dos posturas: se
   * corre 0.14, o sea que no patina. El codo abajo queda en 79.7, 8.3
   * arriba del piso.
   */
  'flexion-diamante': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'Las manos quedan debajo del esternón y los codos rozan las costillas todo el recorrido.',
    inicio: {
      torso: 18,
      cuello: 18,
      brazo: -105,
      antebrazo: -105,
      muslo: 198,
      pantorrilla: 198,
      pie: -78,
    },
    fin: {
      torso: 9,
      cuello: 9,
      brazo: -159,
      antebrazo: -67,
      muslo: 189,
      pantorrilla: 189,
      pie: -78,
    },
  },

  /**
   * ARREGLADO: el torso pasa de 15 a 8 y el fin de 6 a -1. Con 15 el cajón
   * medía 8 px y era el problema, porque la técnica dice 'apoyá los pies
   * en una silla o un banco' y 8 px son 23 cm, un escalón; peor todavía,
   * 15 contra los 19 de la completa dibujaba una declinada casi idéntica a
   * una flexión común. Con el brazo vertical la cuenta es cajón = 20.58 -
   * 48.3·sen(torso), así que torso 8 da 13.9 px, que son los 39 cm de un
   * banco. El fin lo recalculé para que el pie no se despegue: sen(torso)
   * = (13.16 - 13.86)/48.3 da -1, y el brazo -135 / antebrazo -32 son los
   * que dejan la muñeca donde estaba (el pie se corre 0.02 y la tapa del
   * cajón pasa de 13.86 a 13.79). El torso negativo abajo no es un error:
   * con los pies elevados el hombro termina más abajo que la cadera, que
   * es justo lo que hace el ejercicio.
   */
  'flexion-declinada': {
    escena: 'apoyo-pies',
    apoyo: 'manos',
    gesto: 'Con los pies en el cajón el cuerpo queda más plano y el peso se corre a los hombros.',
    inicio: {
      torso: 8,
      cuello: 8,
      brazo: -90,
      antebrazo: -90,
      muslo: 188,
      pantorrilla: 188,
      pie: 180,
    },
    fin: {
      torso: -1,
      cuello: -1,
      brazo: -135,
      antebrazo: -32,
      muslo: 179,
      pantorrilla: 179,
      pie: 180,
    },
  },

  /**
   * Verificado y sin cambios. El brazo a -128 pone la muñeca 12.7 px
   * detrás del hombro, o sea a la altura de la cadera, y eso baja el
   * hombro a 16.2 del piso contra los 20.6 de una flexión común: la razón
   * física de que pese tanto. El pie da 86.8 arriba y 86.9 abajo —se corre
   * 0.08— y el codo abajo queda en 79.3, bien lejos del piso. El recorrido
   * corto es geometría: con la mano a esa distancia horizontal el brazo no
   * puede plegarse más sin que el hombro toque el piso.
   */
  'flexion-pseudoplancha': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'Las manos a la cintura y los hombros por delante de ellas: el recorrido es corto y la cola no puede subir.',
    inicio: {
      torso: 14,
      cuello: 14,
      brazo: -128,
      antebrazo: -128,
      muslo: 194,
      pantorrilla: 194,
      pie: -80,
    },
    fin: {
      torso: 7,
      cuello: 7,
      brazo: -172,
      antebrazo: -105,
      muslo: 187,
      pantorrilla: 187,
      pie: -80,
    },
  },

  /**
   * ARREGLADO: el brazo lejano abajo pasa de -40/-40 a -24/-112. La
   * versión anterior no cerraba: la mano lejana arrancaba en x 87.3 y
   * terminaba en 96.0, ocho unidades y media de patinada, y encima cerraba
   * 0.11 por debajo del piso, así que era el punto más bajo del dibujo en
   * vez de la muñeca. El lado cercano estaba bien y no lo toqué. Para el
   * lejano impuse las dos condiciones a mano: misma altura que la muñeca
   * cercana (las dos están en el piso) y misma separación horizontal que
   * arriba, 16.74; eso fija la muñeca lejana en (7.08, 13.12) desde el
   * hombro y la resolví con cinemática de dos barras. De las dos
   * soluciones elegí la del codo adelante porque deja el codo lejano 8.4
   * arriba del piso —la otra lo apoyaba a 1.7, con el antebrazo
   * arrastrando— y porque espeja al codo cercano que se va atrás: esa V es
   * la arquera. Ahora la mano lejana queda en (87.3, 88.0) en las dos
   * posturas y en los cuadros del medio no baja más de 0.31.
   */
  'flexion-arquera': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'El cuerpo se carga sobre un brazo mientras el otro se estira y solo apoya.',
    inicio: {
      torso: 17,
      cuello: 17,
      brazo: -114,
      antebrazo: -114,
      muslo: 197,
      pantorrilla: 197,
      pie: -78,
      brazoLejos: -66,
      antebrazoLejos: -66,
    },
    fin: {
      torso: 10,
      cuello: 10,
      brazo: -159,
      antebrazo: -83,
      muslo: 190,
      pantorrilla: 190,
      pie: -78,
      brazoLejos: -24,
      antebrazoLejos: -112,
    },
  },

  /**
   * ARREGLADO: la pierna lejana pasa de recta a 190/190 (y 182/182 abajo)
   * a quebrada en 186/206 (178/198 abajo). Con la pierna recta seis grados
   * por encima de la cercana, el pie lejano flotaba 4.5 unidades sobre el
   * piso mientras el cercano lo tocaba, y una flexión a una mano tiene los
   * dos pies apoyados. La separación lateral de los pies no se ve de
   * perfil, así que la resolví al revés: abro el muslo diez grados hacia
   * arriba y cierro la tibia otros diez, con lo cual la rodilla lejana
   * queda 2.6 px arriba de la cercana —se lee que son dos piernas— y el
   * tobillo cae a menos de medio píxel del otro. Ahora los dos dedos del
   * pie dan 86.5 y 86.6. El brazo lejano lo dejé como estaba: el codo
   * asomando arriba de la espalda y la mano cayendo a la altura de la
   * cadera es lo que se lee como 'la otra mano en la espalda baja', y no
   * es punto de apoyo. Sobre la escalera de torsos: el tramo monótono es
   * el que de verdad cambia de altura de apoyo, 72-58-47-40-38-[19 de la
   * completa], y la declinada lo continúa por el otro lado subiendo los
   * pies (8). Las del piso quedan en una franja angosta —diamante 18,
   * pseudoplancha 14, arquera 17, esta 16— porque ahí la dificultad no
   * viene de la palanca sino de dónde cae la mano, y forzarlas más abajo
   * dibujaría una plancha en vez de una flexión.
   */
  'flexion-una-mano': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'Un solo brazo baja el cuerpo entero; los pies abiertos y la otra mano en la espalda frenan la rotación.',
    inicio: {
      torso: 16,
      cuello: 16,
      brazo: -119,
      antebrazo: -119,
      muslo: 196,
      pantorrilla: 196,
      pie: -78,
      musloLejos: 186,
      pantorrillaLejos: 206,
      pieLejos: -78,
      brazoLejos: 158,
      antebrazoLejos: -112,
    },
    fin: {
      torso: 8,
      cuello: 8,
      brazo: -168,
      antebrazo: -90,
      muslo: 188,
      pantorrilla: 188,
      pie: -78,
      musloLejos: 178,
      pantorrillaLejos: 198,
      pieLejos: -78,
      brazoLejos: 150,
      antebrazoLejos: -120,
    },
  },


  // Los cuatro remos se reescribieron enteros: venían espejados. Con el torso
  // arriba de 90 grados el hombro queda a la IZQUIERDA de la cadera, o sea la
  // persona mirando al revés de la convención, y de perfil eso no se nota
  // leyendo los números — se ve recién cuando lo dibujás. Es la clase de error
  // que ningún test de geometría podía cazar, porque una figura espejada apoya
  // igual de bien en el piso.

  // ─── Tracción ──────────────────────────────────────────────────────

  /**
   * Cuerpo en una sola línea a 48 grados del piso (torso 132 = 180-48;
   * muslo y pantorrilla -48, que es la misma línea hacia los pies). Es lo
   * más parado que entra: como la barra se dibuja a la altura de las
   * muñecas, con el cuerpo más vertical la barra le pasaría por la cara.
   * Al tirar, el cuerpo gira sobre los talones hasta 63 grados y el codo
   * cae hacia la cadera; la muñeca queda a la misma altura (40.4) en las
   * dos posturas, así que la barra no se mueve de lugar.
   */
  'remo-australiano-alto': {
    escena: 'barra-baja',
    apoyo: 'pies',
    gesto: 'El cuerpo sube entero hacia la barra, derecho de talones a cabeza. Cuanto más parado estés, menos peso tenés que subir.',
    inicio: {
      torso: 55,
      cuello: 55,
      brazo: 90,
      antebrazo: 90,
      muslo: 235,
      pantorrilla: 235,
      pie: 120,
    },
    fin: {
      torso: 63,
      cuello: 63,
      brazo: 40,
      antebrazo: 140,
      muslo: 243,
      pantorrilla: 243,
      pie: 128,
    },
  },

  /**
   * Mismo armado a 36 grados, un escalón entero más tumbado que el alto.
   * La técnica habla de unos 45, pero los cuatro remos tienen que leerse
   * distintos dentro del mismo cuadro, así que la escalera quedó
   * 48/36/20/11 y el recorrido igual pasa por 45: termina a 51, que es
   * donde el pecho llega a la barra. Abajo el brazo sale casi
   * perpendicular al cuerpo (40 y 56, con el codo apenas quebrado); arriba
   * el codo termina hacia la cadera.
   */
  'remo-australiano-medio': {
    escena: 'barra-baja',
    apoyo: 'pies',
    gesto: 'Los pies más adelante que en el alto: el cuerpo queda más acostado y pesa más.',
    inicio: {
      torso: 40,
      cuello: 40,
      brazo: 90,
      antebrazo: 90,
      muslo: 220,
      pantorrilla: 220,
      pie: 105,
    },
    fin: {
      torso: 48,
      cuello: 48,
      brazo: 40,
      antebrazo: 140,
      muslo: 228,
      pantorrilla: 228,
      pie: 113,
    },
  },

  /**
   * A 20 grados el cuerpo queda casi paralelo al piso y la barra cae a la
   * altura de la cadera, como pide la técnica. El pie a 56 es el talón
   * apoyado con la punta arriba, que es lo único que toca con el cuerpo
   * tan bajo. Arriba el cuerpo llega a 36 grados: con manos y talones
   * clavados, subir el pecho a la barra obliga a girar todo el cuerpo
   * sobre los talones, no a doblar la cadera.
   */
  'remo-australiano-bajo': {
    escena: 'barra-baja',
    apoyo: 'pies',
    gesto: 'Casi acostado bajo la barra. Sube todo el cuerpo de una pieza hasta tocarla con el pecho.',
    inicio: {
      torso: 22,
      cuello: 22,
      brazo: 90,
      antebrazo: 90,
      muslo: 202,
      pantorrilla: 202,
      pie: 87,
    },
    fin: {
      torso: 30,
      cuello: 30,
      brazo: 40,
      antebrazo: 140,
      muslo: 210,
      pantorrilla: 210,
      pie: 95,
    },
  },

  /**
   * Es el más tumbado de los cuatro: 11 grados. No va en negativo aunque
   * los pies estén sobre una silla, porque el dibujante baja la figura
   * hasta apoyar los pies en el piso y con el cuerpo por debajo de esa
   * línea la cabeza quedaría enterrada; la silla tampoco se dibuja en
   * escena barra-baja. Lo que sí queda dicho es lo que importa: cuerpo
   * paralelo al piso, barra bien baja y el mismo giro de 16 grados al
   * tirar.
   */
  'remo-australiano-pies-elevados': {
    escena: 'barra-baja',
    apoyo: 'pies',
    gesto: 'Con los pies en alto el cuerpo queda horizontal y ya no ayuda nada: es el escalón que toca la dominada.',
    inicio: {
      torso: 5,
      cuello: 5,
      brazo: 90,
      antebrazo: 90,
      muslo: 185,
      pantorrilla: 185,
      pie: 70,
    },
    fin: {
      torso: 13,
      cuello: 13,
      brazo: 40,
      antebrazo: 140,
      muslo: 193,
      pantorrilla: 193,
      pie: 78,
    },
  },

  /**
   * En el colgado la punta del pie caía en 88.5, medio punto por debajo
   * del piso: alguien colgado de la barra tocando el suelo. La intuición
   * del autor era buena y le faltaba doblez: de muñeca a punta con las
   * piernas rectas el cuerpo mide 68.8 y entre la barra (20) y el piso
   * (88) hay 68, así que la rodilla flexionada es obligatoria, no un
   * adorno. La llevé a 60 grados (muslo -95, pantorrilla -155) y el pie a
   * -65, que es el tobillo neutro respecto de la tibia; el punto más bajo
   * queda en 83, cinco unidades de aire.
   */
  'dominada-negativa': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'Empieza arriba: lo único que se hace es bajar, lo más lento posible, hasta estirar los brazos del todo.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: -58,
      antebrazo: 128,
      muslo: -92,
      pantorrilla: -152,
      pie: -65,
    },
    fin: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -95,
      pantorrilla: -155,
      pie: -65,
    },
  },

  /**
   * Los pies estaban bien despegados del piso, pero el pie a -130 contra
   * una tibia a -160 daba 60 grados de flexión plantar: un empeine de
   * bailarina. Adelanté la rodilla y plegué más la tibia (muslo -60,
   * pantorrilla -170), que es la rodilla apoyada en la banda de la que
   * habla la técnica, con el pie a -110, a 30 grados del neutro. El punto
   * más bajo queda en 77 y la pierna se distingue de un vistazo de la de
   * la banda fina, que es lo único que separa a estos dos dibujos.
   */
  'dominada-asistida': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'Recorrido completo hasta pasar la pera. La rodilla recogida es la que va apoyada en la banda, que devuelve parte del peso.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -60,
      pantorrilla: -170,
      pie: -110,
    },
    fin: {
      torso: 90,
      cuello: 90,
      brazo: -58,
      antebrazo: 128,
      muslo: -58,
      pantorrilla: -168,
      pie: -110,
    },
  },

  /**
   * Acá el defecto era el mismo que en la negativa pero peor de leer: con
   * muslo -80 y pantorrilla -95 el tobillo caía en 88.5 y la figura
   * parecía parada en el piso mientras se colgaba de la barra. Con las
   * piernas casi rectas no entra en el lienzo, así que doblé la rodilla 75
   * grados (muslo -75, pantorrilla -150). El pie a -40 queda en
   * dorsiflexión, que es como se para un pie sobre una cinta, y deja el
   * punto más bajo en 82.8.
   */
  'dominada-asistida-leve': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'El mismo recorrido con un pie en una banda fina: la ayuda casi no está y la sube la espalda.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -75,
      pantorrilla: -150,
      pie: -40,
    },
    fin: {
      torso: 90,
      cuello: 90,
      brazo: -58,
      antebrazo: 128,
      muslo: -73,
      pantorrilla: -148,
      pie: -40,
    },
  },

  'dominada-completa': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'El cuerpo sube entero hasta que la pera pasa la barra. Las manos no se mueven.',
    inicio: {
      torso: 90,
      cuello: 90,
      // El brazo va un pelo adelante del torso a propósito. Geométricamente
      // colgado queda casi encima, pero dibujado encima se lee como una sola
      // línea vertical y no como alguien colgando de las manos.
      brazo: 84,
      antebrazo: 96,
      muslo: -92,
      pantorrilla: -88,
      pie: -70,
    },
    fin: {
      torso: 90,
      cuello: 90,
      // Arriba el codo queda abajo y adelante del hombro, y el antebrazo
      // vuelve hacia la barra, que no se movió de lugar.
      brazo: -58,
      antebrazo: 128,
      muslo: -95,
      pantorrilla: -80,
      pie: -70,
    },
  },

  /**
   * Las piernas casi rectas hundían la punta 1.1 por debajo del piso; van
   * con la misma rodilla plegada de la negativa, que deja el punto más
   * bajo en 83. El brazo lejano lo dejé como estaba y no por comodidad:
   * colgado, con el brazo estirado, la muñeca lejana no puede separarse
   * más de 1.9 de la cercana, así que los dos brazos casi encima es la
   * única opción, y arriba se abre hasta (40.2, 20.0), sobre la línea de
   * la barra. El precio queda dicho: a mitad del barrido esa muñeca se
   * despega 2.5 de la barra, y las variantes que lo bajan a 2.0 doblan el
   * codo lejano y le sacan lo único que hace legible el gesto, el brazo
   * estirado.
   */
  'dominada-arquera': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'El cuerpo sube hacia una sola mano mientras el otro brazo se estira sobre la barra. Se alterna el lado en cada repetición.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -95,
      pantorrilla: -155,
      pie: -65,
      brazoLejos: 98,
      antebrazoLejos: 76,
    },
    fin: {
      torso: 90,
      cuello: 90,
      brazo: -58,
      antebrazo: 128,
      muslo: -92,
      pantorrilla: -152,
      pie: -65,
      brazoLejos: 205,
      antebrazoLejos: 166,
    },
  },

  /**
   * El inicio estaba bien y lo dejé; el fin no. Con brazoLejos -9 la
   * muñeca lejana caía sobre el antebrazo cercano en las dos puntas pero
   * se despegaba hasta 7.9 unidades a mitad del recorrido —la mano
   * flotando en el aire justo donde se mira la animación— y el codo lejano
   * terminaba clavado sobre la línea de la barra. Busqué el par que la
   * mantiene agarrada en todo el recorrido: con brazoLejos -112 y
   * antebrazoLejos 25 nunca se separa más de 1.1 del antebrazo cercano y
   * el codo cuelga debajo del hombro en vez de asomar al costado; las
   * piernas, las de la negativa, para sacar la punta del pie de abajo del
   * piso.
   */
  'dominada-un-brazo-asistida': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'Tira un solo brazo; el otro apenas se sostiene del propio antebrazo. La bajada se controla igual de lenta.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -95,
      pantorrilla: -155,
      pie: -65,
      brazoLejos: 48,
      antebrazoLejos: 139,
    },
    fin: {
      torso: 90,
      cuello: 90,
      brazo: -58,
      antebrazo: 128,
      muslo: -92,
      pantorrilla: -152,
      pie: -65,
      brazoLejos: -112,
      antebrazoLejos: 25,
    },
  },


  // ─── Piernas ───────────────────────────────────────────────────────

  /**
   * El fondo está calculado para que la cadera quede a 18,7 unidades del
   * piso, que es la altura de una silla, con el muslo apenas por encima de
   * la rodilla: muslo -14 y tibia -100 dejan el tobillo 12 unidades
   * adelante de la cadera, o sea la sentadilla que va atrás y no la que se
   * hunde sobre el pie. Torso 70, más erguido que la sentadilla completa
   * (62), porque el recorrido es más corto y el asiento recibe el peso;
   * los brazos salen al frente igual que en la completa para que la
   * familia se lea como una sola.
   */
  'sentadilla-banco': {
    escena: 'banco-atras',
    apoyo: 'pies',
    gesto: 'La cadera va hacia atrás a buscar el asiento, lo toca apenas y vuelve a subir.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: -84,
      antebrazo: -84,
      muslo: -90,
      pantorrilla: -90,
      pie: 0,
    },
    fin: {
      torso: 70,
      cuello: 80,
      brazo: 8,
      antebrazo: 8,
      muslo: -14,
      pantorrilla: -100,
      pie: 0,
    },
  },

  /**
   * El agarre es un punto fijo a la altura del pecho (17,5 adelante del
   * tobillo, 41 de alto) elegido para que sea alcanzable desde el hombro
   * de pie y desde el del fondo: por eso arriba el brazo baja (-43) con el
   * antebrazo casi horizontal, y abajo el brazo queda al frente (9) con el
   * antebrazo subiendo (44). La muñeca se corre 0,4 en x en todo el
   * recorrido, así que el cajón que se dibuja bajo las manos no patina.
   * Las piernas son las de la sentadilla completa, con el torso 4 grados
   * más erguido porque el agarre es justamente lo que permite bajar
   * derecho.
   */
  'sentadilla-asistida': {
    escena: 'apoyo-manos',
    apoyo: 'pies',
    gesto: 'Las manos quedan clavadas en el apoyo y solo acompañan: lo que baja es la cadera.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: -43,
      antebrazo: 3,
      muslo: -90,
      pantorrilla: -90,
      pie: 0,
    },
    fin: {
      torso: 66,
      cuello: 78,
      brazo: 9,
      antebrazo: 44,
      muslo: -12,
      pantorrilla: -118,
      pie: 0,
    },
  },

  'sentadilla-completa': {
    escena: 'piso',
    apoyo: 'pies',
    gesto: 'La cadera va atrás y abajo hasta que el muslo queda paralelo al piso.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: -84,
      antebrazo: -84,
      muslo: -90,
      pantorrilla: -90,
      pie: 0,
    },
    fin: {
      // El tronco se inclina adelante para compensar la cadera que fue atrás.
      torso: 62,
      cuello: 72,
      // Los brazos se estiran al frente: es lo que hace la gente sola, y ayuda.
      brazo: 6,
      antebrazo: 6,
      // El muslo casi horizontal y la tibia inclinada: la cadera termina
      // detrás del tobillo, que es lo que distingue una sentadilla de una
      // flexión de rodillas parada.
      muslo: -12,
      pantorrilla: -118,
      pie: 0,
    },
  },

  /**
   * Los dos pies están clavados: la punta de atrás queda 31,5 detrás del
   * tobillo de adelante en las dos posturas y se corre 1,5 en el medio del
   * recorrido. El fondo sale de fijar la rodilla de adelante en casi 90
   * grados (tibia -99) y la de atrás a 3,5 del piso, lo que obliga a que
   * la tibia trasera quede casi acostada; va escrita -178 y no 182 para
   * que la interpolación no la haga girar por el frente. El talón de atrás
   * está levantado (pieLejos -62) y el torso erguido (85), que es lo que
   * pide la técnica.
   */
  zancada: {
    escena: 'piso',
    apoyo: 'pies',
    gesto: 'El cuerpo baja derecho entre dos pies que no se mueven, hasta que la rodilla de atrás queda a un puño del piso.',
    inicio: {
      torso: 88,
      cuello: 90,
      brazo: -90,
      antebrazo: -90,
      muslo: -44,
      pantorrilla: -81,
      pie: 0,
      musloLejos: -120,
      pantorrillaLejos: -142,
      pieLejos: -62,
    },
    fin: {
      torso: 85,
      cuello: 88,
      brazo: -95,
      antebrazo: -95,
      muslo: -10,
      pantorrilla: -99,
      pie: 0,
      musloLejos: -111,
      pantorrillaLejos: -178,
      pieLejos: -62,
    },
  },

  /**
   * La pierna de atrás es el lado CERCANO a propósito: el dibujante pone
   * el cajón bajo `tobillo`, así que solo así el banco aparece bajo el pie
   * elevado y no bajo el pie que trabaja. El pie de atrás queda a 15 de
   * alto y 28 atrás en las dos posturas; al bajar, el muslo trasero casi
   * no se mueve (-116 a -111) y lo que gira es la tibia (181 a 131) hasta
   * dejar la rodilla a 3,5 del piso, que es como se ve una búlgara de
   * perfil. La pierna de adelante mantiene la tibia vertical (-92 a -99) y
   * solo abre el muslo (-65 a -10): el pie no se corre más de 2,8.
   */
  'sentadilla-bulgara': {
    escena: 'banco-atras',
    apoyo: 'pies',
    gesto: 'El pie de atrás no se mueve del banco: la cadera baja en línea recta sobre la pierna de adelante.',
    inicio: {
      torso: 88,
      cuello: 90,
      brazo: -90,
      antebrazo: -90,
      muslo: -116,
      pantorrilla: 181,
      pie: 180,
      musloLejos: -65,
      pantorrillaLejos: -92,
      pieLejos: 0,
    },
    fin: {
      torso: 82,
      cuello: 86,
      brazo: -95,
      antebrazo: -95,
      muslo: -111,
      pantorrilla: 131,
      pie: 180,
      musloLejos: -10,
      pantorrillaLejos: -99,
      pieLejos: 0,
    },
  },

  /**
   * Es la altura de asiento de la sentadilla al banco (cadera 18,7, muslo
   * -14, tibia -100) pero sobre una pierna, con el torso más volcado (62
   * contra 70) porque hay que contrapesar la pierna libre y no hay una
   * segunda pierna que ayude. La pierna libre termina estirada a la altura
   * de la cadera (musloLejos 4, pantorrillaLejos 0) y no a la de la
   * rodilla que trabaja: si queda ahí, las dos piernas se dibujan una
   * encima de la otra y no se entiende cuál sostiene. Arriba sale adelante
   * y abajo (-30/-30), a 15 del piso, para que se vea que nunca se apoya.
   */
  'sentadilla-a-banco-una-pierna': {
    escena: 'banco-atras',
    apoyo: 'pies',
    gesto: 'En una sola pierna, la cadera va atrás hasta rozar el banco, con la otra pierna estirada adelante todo el tiempo.',
    inicio: {
      torso: 88,
      cuello: 90,
      brazo: -84,
      antebrazo: -84,
      muslo: -88,
      pantorrilla: -92,
      pie: 0,
      musloLejos: -30,
      pantorrillaLejos: -30,
      pieLejos: 60,
    },
    fin: {
      torso: 62,
      cuello: 74,
      brazo: 8,
      antebrazo: 8,
      muslo: -14,
      pantorrilla: -100,
      pie: 0,
      musloLejos: 4,
      pantorrillaLejos: 0,
      pieLejos: 60,
    },
  },

  /**
   * Es el pistol entero —cadera a 8,9 del piso, muslo +18 y tibia -117,
   * con la cadera 7,5 detrás del tobillo— sostenido de un punto fijo a la
   * altura del pecho: la muñeca cercana se mueve 1,1 en todo el recorrido,
   * así que el apoyo dibujado no patina y se lee que la mano no tira. El
   * otro brazo es el lado lejano: cuelga arriba (-84) y se estira al
   * frente abajo (0), que es lo único para lo que sirve. La pierna libre
   * queda apenas por debajo de la horizontal para no cruzarse con la
   * rodilla que trabaja, que está 5 unidades más arriba.
   */
  'sentadilla-una-pierna-asistida': {
    escena: 'apoyo-manos',
    apoyo: 'pies',
    gesto: 'La mano se agarra pero no tira: acompaña mientras la pierna baja hasta el fondo.',
    inicio: {
      torso: 88,
      cuello: 90,
      brazo: -51,
      antebrazo: -18,
      muslo: -88,
      pantorrilla: -92,
      pie: 0,
      musloLejos: -28,
      pantorrillaLejos: -24,
      pieLejos: 65,
      brazoLejos: -84,
      antebrazoLejos: -84,
    },
    fin: {
      torso: 62,
      cuello: 74,
      brazo: 21,
      antebrazo: 58,
      muslo: 18,
      pantorrilla: -117,
      pie: 0,
      musloLejos: -2,
      pantorrillaLejos: -2,
      pieLejos: 75,
      brazoLejos: 0,
      antebrazoLejos: 0,
    },
  },

  /**
   * El fondo es el de una pistol de verdad: tibia muy adelantada (-117, la
   * movilidad de tobillo que el ejercicio pide), muslo +18 —la cadera
   * queda por debajo de la rodilla— y la cadera 7,5 detrás del tobillo, a
   * 8,9 del piso. Lo que lo hace reconocible al instante es la pierna
   * libre estirada y casi horizontal (musloLejos -2 / pantorrillaLejos -2,
   * el pie a 7,8 del piso sin tocarlo) y los brazos que suben al frente de
   * -80 a 22 para contrapesar. El pie que trabaja queda plano (pie 0) en
   * las dos posturas.
   */
  'pistol-squat': {
    escena: 'piso',
    apoyo: 'pies',
    gesto: 'La pierna libre se sostiene estirada adelante mientras la otra baja hasta el fondo, con el talón siempre apoyado.',
    inicio: {
      torso: 88,
      cuello: 90,
      brazo: -80,
      antebrazo: -80,
      muslo: -88,
      pantorrilla: -92,
      pie: 0,
      musloLejos: -25,
      pantorrillaLejos: -20,
      pieLejos: 70,
    },
    fin: {
      torso: 58,
      cuello: 72,
      brazo: 22,
      antebrazo: 22,
      muslo: 18,
      pantorrilla: -117,
      pie: 0,
      musloLejos: -2,
      pantorrillaLejos: -2,
      pieLejos: 75,
    },
  },

  /**
   * Mismo recorrido de piernas que el pistol, con las dos diferencias que
   * la técnica marca palabra por palabra: los brazos ya salen al frente
   * desde arriba (4 en lugar de -80) y la pierna libre arranca más alta
   * (-20/-14). Abajo el torso queda más erguido (62 contra 58) y el pecho
   * arriba (cuello 76), que es la postura que hay que sostener dos
   * segundos y no la que se derrumba. El pie libre más levantado (80) es
   * la misma idea: tensión, no descanso.
   */
  'pistol-con-pausa': {
    escena: 'piso',
    apoyo: 'pies',
    gesto: 'Mismo recorrido, pero abajo el cuerpo se detiene: los brazos ya vienen al frente y la tensión no se afloja.',
    inicio: {
      torso: 88,
      cuello: 90,
      brazo: 4,
      antebrazo: 4,
      muslo: -88,
      pantorrilla: -92,
      pie: 0,
      musloLejos: -20,
      pantorrillaLejos: -14,
      pieLejos: 70,
    },
    fin: {
      torso: 62,
      cuello: 76,
      brazo: 20,
      antebrazo: 20,
      muslo: 18,
      pantorrilla: -117,
      pie: 0,
      musloLejos: 2,
      pantorrillaLejos: 0,
      pieLejos: 80,
    },
  },


  // ─── Core ──────────────────────────────────────────────────────────

  /**
   * El hombro queda a la altura del antebrazo apoyado (0.195 de la altura)
   * y la rodilla en el piso, y entre rodilla y hombro hay solo 0.533:
   * sin(t)=0.195/0.533 da 21 grados, así que torso 21 y muslo 201 dejan la
   * línea recta con la rodilla justo en el piso. Sale MÁS inclinada que la
   * plancha completa, no menos: el apoyo subió del pie a la rodilla y el
   * cuerpo se acortó con el hombro a la misma altura. La pantorrilla en
   * 180 apoya la tibia en el piso, y el error final sube la cadera por
   * encima del hombro (torso -2, muslo 238) con la rodilla siempre
   * apoyada.
   */
  'plancha-rodillas': {
    escena: 'piso',
    apoyo: 'antebrazos',
    gesto: 'No hay recorrido: la línea de rodillas a cabeza se sostiene quieta. Al final, el error, la cola que sube a descansar.',
    inicio: {
      torso: 21,
      cuello: 21,
      brazo: -96,
      antebrazo: -4,
      muslo: 201,
      pantorrilla: 180,
      pie: 175,
    },
    fin: {
      torso: -2,
      cuello: 6,
      brazo: -96,
      antebrazo: -4,
      muslo: 238,
      pantorrilla: 180,
      pie: 175,
    },
  },

  plancha: {
    escena: 'piso',
    apoyo: 'antebrazos',
    gesto: 'No hay recorrido: la línea de talones a cabeza se sostiene sin que la cadera se hunda.',
    inicio: {
      torso: 14,
      cuello: 14,
      // Sobre los antebrazos: el brazo baja del hombro y el antebrazo apoya
      // hacia adelante, casi horizontal.
      brazo: -96,
      antebrazo: -4,
      muslo: 180 + 14,
      pantorrilla: 180 + 14,
      pie: -74,
    },
    // Un isométrico no se mueve, y dibujarlo moviéndose sería mentir. Lo que
    // se muestra es el error que arruina el ejercicio: la cadera que se hunde.
    fin: {
      torso: 24,
      cuello: 20,
      brazo: -96,
      antebrazo: -4,
      muslo: 180 + 6,
      pantorrilla: 180 + 6,
      pie: -74,
    },
  },

  /**
   * Con los brazos estirados el hombro queda a 0.332 del piso, así que el
   * cuerpo es el mismo de la flexión arriba: torso 19, muslo 199. Es
   * asimétrico, así que va el lado lejano: el brazo cercano queda clavado
   * al piso —es el que ancla el dibujo— y el que se levanta es el lejano,
   * con el codo apenas doblado para que la mano suba unos cinco píxeles y
   * se lea; un brazo recto girando desde el hombro deja la mano al ras y
   * parece un error de registro. El tronco no cambia entre las dos
   * posturas a propósito: el error real, la cadera que rota, no existe de
   * perfil, y lo único honesto que se puede mostrar es la mano que se va
   * sin que el cuerpo la siga.
   */
  'plancha-brazo-alternado': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'Una mano se despega y el cuerpo no se entera: la línea de talones a cabeza no se mueve ni un grado.',
    inicio: {
      torso: 19,
      cuello: 19,
      brazo: -90,
      antebrazo: -90,
      muslo: 199,
      pantorrilla: 199,
      pie: -78,
      brazoLejos: -84,
      antebrazoLejos: -96,
    },
    fin: {
      torso: 19,
      cuello: 19,
      brazo: -90,
      antebrazo: -90,
      muslo: 199,
      pantorrilla: 199,
      pie: -78,
      brazoLejos: -95,
      antebrazoLejos: -30,
    },
  },

  /**
   * Reescrita a mano: la versión autorada dibujaba un cuerpo abollado
   * sobre el piso que se leía como un gusano, no como una persona
   * acostada. Boca arriba y mirando a la derecha, el tronco va casi plano
   * (torso 3) con la cabeza apenas levantada mirando hacia las piernas,
   * los brazos al costado apuntando a los pies, y lo único que se mueve
   * son las piernas: el muslo sube a 65 y la tibia se pliega hacia atrás,
   * que es la rodilla al pecho. El apoyo es la cola, así que la cadera
   * queda clavada en el piso en las dos posturas — que es exactamente lo
   * que pide la técnica.
   */
  'elevacion-rodillas-suelo': {
    escena: 'piso',
    apoyo: 'cola',
    gesto: 'Acostado boca arriba: las rodillas suben hacia el pecho y la espalda baja no se despega del piso.',
    inicio: {
      torso: 3,
      cuello: 14,
      brazo: 178,
      antebrazo: 178,
      muslo: 182,
      pantorrilla: 182,
      pie: 100,
    },
    fin: {
      torso: 3,
      cuello: 20,
      brazo: 178,
      antebrazo: 178,
      muslo: 65,
      pantorrilla: 178,
      pie: 100,
    },
  },

  /**
   * Mismo cuerpo acostado que la de rodillas y la misma reescritura, con
   * una sola diferencia que es la que separa los dos ejercicios: acá la
   * pierna no se pliega. El muslo llega a 88 —casi vertical— y la tibia lo
   * sigue en 88, así que la pierna sube derecha de una pieza. Dibujarlo
   * con la rodilla doblada borraría la única distinción entre este eslabón
   * y el anterior.
   */
  'elevacion-piernas-suelo': {
    escena: 'piso',
    apoyo: 'cola',
    gesto: 'Lo mismo con las piernas estiradas: suben derechas hasta la vertical y bajan sin tocar el piso.',
    inicio: {
      torso: 3,
      cuello: 14,
      brazo: 178,
      antebrazo: 178,
      muslo: 182,
      pantorrilla: 182,
      pie: 100,
    },
    fin: {
      torso: 3,
      cuello: 20,
      brazo: 178,
      antebrazo: 178,
      muslo: 88,
      pantorrilla: 88,
      pie: 175,
    },
  },

  /**
   * El colgado de arranque es el mismo de la dominada, ya verificado, y
   * brazo y antebrazo no cambian entre las dos posturas: así la muñeca no
   * se despega de la barra y el hombro tampoco se mueve, que es lo único
   * que sostiene el dibujo. Arriba el muslo a 62 deja la rodilla a la
   * altura del pecho y por delante, y la pantorrilla a -53 (unos 115
   * grados de flexión) deja la tibia colgando adelante y abajo, no
   * disparada al frente. El torso a 96 mete la cadera un poco adelante del
   * hombro: es el enrollar la pelvis del que habla la técnica, lo único de
   * ese gesto que se ve de perfil.
   */
  'elevacion-rodillas-colgado': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'Las manos quedan quietas en la barra: suben las rodillas hasta el pecho, sin balanceo.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -92,
      pantorrilla: -88,
      pie: -70,
    },
    fin: {
      torso: 96,
      cuello: 92,
      brazo: 84,
      antebrazo: 96,
      muslo: 62,
      pantorrilla: -53,
      pie: -35,
    },
  },

  /**
   * Mismo colgado que la anterior y los brazos otra vez congelados para
   * que las manos no patinen por la barra. Arriba muslo y pantorrilla en
   * 0: la pierna estirada y exactamente paralela al piso, que es la marca
   * que pide la técnica; que sean el mismo número en las dos posturas es
   * lo que muestra que la rodilla nunca se dobla. El torso 94 es el mínimo
   * de contrapeso hacia atrás que aparece cuando las piernas llegan a la
   * horizontal.
   */
  'elevacion-piernas-colgado': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'Las rodillas no se doblan en todo el camino: sube la pierna entera hasta quedar paralela al piso.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: 84,
      antebrazo: 96,
      muslo: -92,
      pantorrilla: -88,
      pie: -70,
    },
    fin: {
      torso: 94,
      cuello: 92,
      brazo: 84,
      antebrazo: 96,
      muslo: 0,
      pantorrilla: 0,
      pie: 18,
    },
  },

  /**
   * Reescrita a mano: la autorada dibujaba un triángulo chico pegado a la
   * barra que no se leía como un cuerpo. Una negativa de palanca frontal
   * arranca con las caderas arriba —el tronco apuntando hacia abajo desde
   * la cadera, o sea torso -78— y baja hasta la horizontal, con los brazos
   * siempre estirados desde el hombro hasta la barra. El recorrido entero
   * es esa rotación: de las piernas apuntando al techo a las piernas
   * apuntando al frente. El brazo acompaña para que la muñeca no se
   * despegue de la barra, que es lo único que no se mueve.
   */
  'palanca-frontal-negativa': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'Se arranca con las caderas arriba y se baja despacio hacia la horizontal, sin que la cadera se caiga primero.',
    inicio: {
      torso: -78,
      cuello: -78,
      brazo: 88,
      antebrazo: 94,
      muslo: 98,
      pantorrilla: 94,
      pie: 170,
    },
    fin: {
      torso: 2,
      cuello: 2,
      brazo: 88,
      antebrazo: 94,
      muslo: 182,
      pantorrilla: 182,
      pie: 100,
    },
  },

  /**
   * Torso 0 es la horizontal exacta bajo la barra, con la cabeza del lado
   * de las manos y los pies para el otro lado, que es como cae un cuerpo
   * boca arriba mirando a la derecha. El agrupado clásico: muslo 72, casi
   * perpendicular al tronco, y pantorrilla 182, la tibia paralela al
   * tronco con los pies hacia los pies —de nuevo la rodilla dobla al revés
   * que en una figura parada, porque acá la espalda va al piso. El error
   * gira el cuerpo entero 25 grados: la cadera baja siete píxeles y medio
   * con el hombro clavado, que es exactamente perder la horizontal; los
   * brazos quedan en 84/96 en las dos, porque doblar el codo movería el
   * cuerpo hacia la barra y el codo recto es la técnica.
   */
  'palanca-frontal-agrupada': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'No hay recorrido: el cuerpo queda horizontal bajo la barra. Al final, el error, la cadera que se hunde y pierde la horizontal.',
    inicio: {
      torso: 0,
      cuello: 5,
      brazo: 84,
      antebrazo: 96,
      muslo: 72,
      pantorrilla: 182,
      pie: 170,
    },
    fin: {
      torso: 25,
      cuello: 20,
      brazo: 84,
      antebrazo: 96,
      muslo: 90,
      pantorrilla: 200,
      pie: 185,
    },
  },

}
