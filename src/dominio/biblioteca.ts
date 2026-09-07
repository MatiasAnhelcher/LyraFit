/**
 * La biblioteca de ejercicios.
 *
 * Cada patrón de movimiento es una cadena: los mismos músculos, el mismo
 * gesto, cada vez con menos ayuda de la palanca. Se sube cuando el objetivo
 * del nivel está firme, no cuando aburre.
 *
 * Los datos viven en código y no en la base porque son la parte que no cambia
 * con el uso. Cuando quieras sumar un ejercicio, lo agregás acá y lo enganchás
 * en la cadena: la app entera se acomoda sola.
 */

import type { Cadena, Ejercicio, Patron } from './tipos'

export const EJERCICIOS: Ejercicio[] = [
  // ─── Empuje ──────────────────────────────────────────────────────────
  {
    id: 'flexion-pared',
    nombre: 'Flexiones en la pared',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 1,
    resumen:
      'El punto de partida del empuje. Casi todo el peso lo sostienen las piernas, así que podés concentrarte en el recorrido y no en la fuerza.',
    tecnica: [
      'Parate frente a la pared, a un paso de distancia, manos a la altura del pecho y separadas al ancho de los hombros.',
      'Apretá los glúteos y el abdomen: de los talones a la cabeza tenés que ser una sola línea.',
      'Bajá el pecho hacia la pared doblando los codos hacia atrás, no hacia los costados.',
      'Tocá la pared con el pecho y empujá hasta estirar los brazos del todo.',
    ],
    erroresComunes: [
      'Sacar la cola hacia atrás y romper la línea del cuerpo.',
      'Abrir los codos a noventa grados: castiga los hombros sin sumar nada.',
      'Bajar rápido y rebotar. El control en la bajada es la mitad del ejercicio.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.2,
    descansoSegundos: 60,
  },
  {
    id: 'flexion-inclinada-alta',
    nombre: 'Flexiones inclinadas altas',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 2,
    resumen:
      'Las manos sobre una mesada o el respaldo de un sillón, bastante más alto que un banco. Es el escalón que faltaba entre la pared y el piso.',
    tecnica: [
      'Apoyá las manos al ancho de los hombros sobre una mesada o un mueble firme, más o menos a la altura de la cintura.',
      'Caminá los pies para atrás hasta que quedes en una sola línea, con el peso adelante.',
      'Bajá el pecho hasta el borde con los codos cerca del cuerpo, no abiertos en cruz.',
      'Empujá hasta estirar los brazos del todo y sostené la línea entre repetición y repetición.',
    ],
    erroresComunes: [
      'Apoyarse en algo que se corre o se vuelca. Cargale el peso antes de empezar la serie.',
      'Dejar los pies demasiado cerca del apoyo: quedás casi parado y el ejercicio no pesa nada.',
      'Adelantar la cabeza para tocar antes. El que tiene que llegar al borde es el pecho.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.3,
    descansoSegundos: 60,
  },
  {
    id: 'flexion-inclinada',
    nombre: 'Flexiones inclinadas',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 3,
    resumen:
      'Las mismas flexiones, con las manos sobre una superficie elevada. Cuanto más baja la superficie, más pesa.',
    tecnica: [
      'Apoyá las manos en un banco, una mesa firme o un escalón, al ancho de los hombros.',
      'Caminá los pies para atrás hasta quedar en línea recta, con el peso adelante.',
      'Bajá hasta que el pecho toque el borde y empujá para volver.',
      'Cuando llegues al objetivo, buscá un apoyo más bajo y volvé a empezar.',
    ],
    erroresComunes: [
      'Usar una superficie que se mueve. Probá que aguante antes de cargarle el peso.',
      'Bajar la cadera y trabajar de arco en vez de plancha.',
      'Recortar el recorrido para sumar repeticiones.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.4,
    descansoSegundos: 75,
  },
  {
    id: 'flexion-inclinada-baja',
    nombre: 'Flexiones inclinadas bajas',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 4,
    resumen:
      'Las manos sobre un escalón o una silla baja. Es el último paso antes de las flexiones de rodillas: cerca de la mitad del peso del cuerpo ya va sobre los brazos.',
    tecnica: [
      'Apoyá las manos al ancho de los hombros en un escalón o en el asiento de una silla apoyada contra la pared.',
      'Llevá los pies bien atrás y apretá glúteos y abdomen hasta formar una línea de talones a cabeza.',
      'Bajá hasta tocar el borde con el pecho, con los codos a unos cuarenta y cinco grados del cuerpo.',
      'Empujá el apoyo lejos tuyo hasta estirar los codos del todo.',
    ],
    erroresComunes: [
      'Usar una silla suelta que se desliza hacia adelante justo cuando llegás abajo.',
      'Hundir la cadera y trabajar de arco en vez de plancha.',
      'Bajar de golpe y rebotar contra el borde en lugar de frenar el peso.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.46,
    descansoSegundos: 75,
  },
  {
    id: 'flexion-rodillas',
    nombre: 'Flexiones de rodillas',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 5,
    resumen:
      'Ya en el piso, pero con el punto de apoyo en las rodillas: alrededor del sesenta por ciento del peso del cuerpo.',
    tecnica: [
      'Arrodillate sobre algo blando y apoyá las manos al ancho de los hombros.',
      'Sostené la línea recta desde las rodillas hasta la cabeza, sin quebrar la cadera.',
      'Bajá hasta que el pecho quede a un puño del piso.',
      'Empujá el piso lejos tuyo, más que empujarte a vos hacia arriba.',
    ],
    erroresComunes: [
      'Sentarse sobre los talones y convertirlo en otro ejercicio.',
      'Adelantar la cabeza para tocar el piso antes que el pecho.',
      'Perder la tensión del abdomen a partir de la quinta repetición.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.53,
    descansoSegundos: 75,
  },
  {
    id: 'flexion-completa',
    nombre: 'Flexiones completas',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 6,
    resumen:
      'El ejercicio de empuje de toda la vida. Si lo hacés bien, es todo lo que necesitás durante mucho tiempo.',
    tecnica: [
      'Manos al ancho de los hombros, dedos apuntando adelante, pies juntos.',
      'Cuerpo en línea, mirada al piso un poco adelante de las manos.',
      'Bajá con los codos a unos cuarenta y cinco grados del cuerpo.',
      'Tocá el piso con el pecho y subí sin dejar que la cadera se hunda.',
    ],
    erroresComunes: [
      'Bajar solo la cabeza y creer que bajó todo el cuerpo.',
      'Aguantar la respiración: soltá el aire al subir.',
      'Juntar los omóplatos arriba en vez de mantener los hombros firmes.',
    ],
    ventana: { min: 5, max: 12 },
    series: 3,
    ccr: 0.64,
    descansoSegundos: 90,
  },
  {
    id: 'flexion-diamante',
    nombre: 'Flexiones diamante',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 7,
    resumen:
      'Manos juntas debajo del pecho. Se lleva el trabajo al tríceps y a la parte interna del pectoral.',
    tecnica: [
      'Juntá las manos formando un triángulo con pulgares e índices.',
      'Ubicá el triángulo debajo del esternón, no debajo de la cara.',
      'Bajá pegando los codos al cuerpo hasta tocar las manos con el pecho.',
      'Subí sin dejar que los codos se abran hacia afuera.',
    ],
    erroresComunes: [
      'Poner las manos demasiado adelante y cargar los hombros.',
      'Abrir los codos para poder bajar más: si se abren, todavía no es el momento.',
      'Forzar la muñeca. Si molesta, hacelas sobre los puños o sobre agarres.',
    ],
    ventana: { min: 5, max: 12 },
    series: 3,
    ccr: 0.7,
    descansoSegundos: 90,
  },
  {
    id: 'flexion-declinada',
    nombre: 'Flexiones declinadas',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 8,
    resumen:
      'Los pies elevados. Se traslada peso a los hombros y prepara el terreno para las verticales.',
    tecnica: [
      'Apoyá los pies en una silla o un banco y las manos en el piso.',
      'Cuanto más alto el apoyo de los pies, más carga sobre los hombros.',
      'Mantené la línea recta: la cadera tiende a levantarse en esta posición.',
      'Bajá hasta tocar el piso con el pecho y empujá.',
    ],
    erroresComunes: [
      'Elevar demasiado los pies de entrada y terminar haciendo otra cosa.',
      'Dejar que la espalda baja se arquee.',
      'Apoyar los pies en algo con ruedas.',
    ],
    ventana: { min: 5, max: 12 },
    series: 3,
    ccr: 0.75,
    descansoSegundos: 90,
  },
  {
    id: 'flexion-pseudoplancha',
    nombre: 'Flexiones pseudo plancha',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 9,
    resumen:
      'Manos a la altura de la cintura, dedos apuntando a los pies y el cuerpo volcado hacia adelante. Es el puente hacia la plancha y le pide muchísimo al hombro de adelante.',
    tecnica: [
      'Apoyá las manos al ancho de los hombros a la altura de la cintura, con los dedos apuntando hacia los pies.',
      'Llevá los hombros por delante de las manos: cuanto más adelante, más pesa.',
      'Bajá con los codos pegados al cuerpo, sin dejar que la cadera se hunda ni se levante.',
      'Empujá el piso hacia atrás para volver, sosteniendo los hombros adelante todo el recorrido.',
    ],
    erroresComunes: [
      'Ganar inclinación de golpe. El hombro de adelante trabaja estirado y en desventaja, así que se avanza de a pocos centímetros por vez.',
      'Forzar la muñeca. Si molesta, hacelas sobre agarres paralelos y sumá movilidad de muñeca aparte.',
      'Subir la cola para aguantar la posición, que descarga justo lo que se está entrenando.',
    ],
    ventana: { min: 4, max: 10 },
    series: 3,
    ccr: 0.82,
    descansoSegundos: 120,
  },
  {
    id: 'flexion-arquera',
    nombre: 'Flexiones arqueras',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 10,
    resumen:
      'Un brazo trabaja y el otro acompaña estirado. El paso intermedio real hacia la flexión a una mano.',
    tecnica: [
      'Abrí las manos bastante más que el ancho de los hombros.',
      'Bajá cargando el peso sobre un brazo mientras el otro se estira al costado.',
      'El brazo estirado apoya, no empuja.',
      'Subí y alterná el lado en cada repetición.',
    ],
    erroresComunes: [
      'Girar el torso para robarle trabajo al brazo que carga.',
      'Contar como una repetición lo que fueron dos medias.',
      'Descuidar el lado más débil. Se avanza al ritmo del más flojo.',
    ],
    ventana: { min: 3, max: 8 },
    series: 3,
    ccr: 0.9,
    descansoSegundos: 120,
  },
  {
    id: 'flexion-una-mano',
    nombre: 'Flexiones a una mano',
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 11,
    resumen:
      'El final de la cadena de empuje. Tanto fuerza de pectoral y tríceps como capacidad del core para evitar que el cuerpo rote.',
    tecnica: [
      'Separá bien los pies para tener una base ancha y estable.',
      'La mano de apoyo va debajo del pecho, no debajo del hombro.',
      'La otra mano queda en la espalda baja.',
      'Bajá lento resistiendo la rotación del torso y empujá parejo.',
    ],
    erroresComunes: [
      'Apurar la llegada a este nivel sin dominar las arqueras.',
      'Rebotar en el piso.',
      'Trabajar solo el lado fuerte.',
    ],
    ventana: { min: 2, max: 6 },
    series: 3,
    ccr: 1.0,
    descansoSegundos: 150,
  },
  // ─── Tracción ────────────────────────────────────────────────────────
  {
    id: 'remo-australiano-alto',
    nombre: 'Remo australiano alto',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 1,
    resumen:
      'Traccionar con el cuerpo casi parado. La entrada a la espalda para quien todavía no hace una dominada.',
    tecnica: [
      'Buscá una barra a la altura de la cintura o un poco más arriba.',
      'Agarrala al ancho de los hombros y caminá los pies adelante.',
      'Cuanto más vertical estés, más liviano es.',
      'Llevá el pecho a la barra tirando con los codos hacia atrás.',
    ],
    erroresComunes: [
      'Tirar con los brazos y olvidarse de juntar los omóplatos.',
      'Doblar la cadera en vez de mantener el cuerpo derecho.',
      'Estirar el cuello para acercar la cara antes que el pecho.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.4,
    descansoSegundos: 75,
  },
  {
    id: 'remo-australiano-medio',
    nombre: 'Remo australiano medio',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 2,
    resumen:
      'La barra a la altura de la cintura y el cuerpo a unos cuarenta y cinco grados. Alrededor de la mitad del peso corporal colgando de la espalda.',
    tecnica: [
      'Agarrá la barra al ancho de los hombros con las palmas hacia adelante.',
      'Caminá los pies hasta quedar a unos cuarenta y cinco grados, con el cuerpo derecho.',
      'Empezá bajando los omóplatos y recién después doblá los codos.',
      'Tocá la barra con el esternón y bajá hasta estirar los brazos del todo.',
    ],
    erroresComunes: [
      'Ir acercando los pies serie a serie y terminar más parado que al principio.',
      'Doblar la cadera. De talones a cabeza tiene que ser una tabla.',
      'Encogerse de hombros al tirar, en vez de llevarlos hacia abajo y atrás.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.49,
    descansoSegundos: 75,
  },
  {
    id: 'remo-australiano-bajo',
    nombre: 'Remo australiano bajo',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 3,
    resumen:
      'El mismo remo con el cuerpo más horizontal. Cerca del setenta por ciento del peso corporal.',
    tecnica: [
      'Barra a la altura de la cadera y talones bien adelante.',
      'El cuerpo queda casi paralelo al piso, apoyado solo en los talones.',
      'Tirá hasta tocar la barra con el esternón.',
      'Bajá controlado hasta estirar los brazos del todo.',
    ],
    erroresComunes: [
      'Levantar la cadera para hacerlo más fácil sin darse cuenta.',
      'Cortar el recorrido arriba.',
      'Soltar la tensión del abdomen y quedar colgando de la espalda baja.',
    ],
    ventana: { min: 6, max: 12 },
    series: 3,
    ccr: 0.58,
    descansoSegundos: 90,
  },
  {
    id: 'remo-australiano-pies-elevados',
    nombre: 'Remo australiano con pies elevados',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 4,
    resumen:
      'El remo horizontal con los pies sobre una silla. Es lo que hace falta para pasar de mover la mitad del peso a mover casi todo.',
    tecnica: [
      'Poné una silla firme debajo de una barra a la altura de la cadera y apoyá los talones arriba.',
      'Colgate con los brazos estirados: el cuerpo queda paralelo al piso o apenas más alto.',
      'Apretá glúteos y abdomen para no quedar colgado de la espalda baja.',
      'Tirá hasta tocar la barra con el pecho y bajá controlado hasta estirar del todo.',
    ],
    erroresComunes: [
      'Elegir un apoyo tan alto que la cadera se quiebra sola y no hay forma de sostener la línea.',
      'Dejar caer la cadera cuando aparece el cansancio y terminar la serie hecho una hamaca.',
      'Cortar el recorrido arriba y quedarse a un palmo de la barra.',
    ],
    ventana: { min: 6, max: 12 },
    series: 3,
    ccr: 0.66,
    descansoSegundos: 90,
  },
  {
    id: 'dominada-negativa',
    nombre: 'Dominadas negativas',
    patron: 'traccion',
    medida: 'segundos',
    nivel: 5,
    resumen:
      'Solo la bajada, lo más lenta posible. Es la forma más rápida y segura de construir la primera dominada.',
    tecnica: [
      'Subí a la posición de arriba con un salto o un banquito, pera por encima de la barra.',
      'Bajá lo más lento que puedas, resistiendo todo el recorrido.',
      'Contá los segundos de la bajada: eso es lo que registrás.',
      'Volvé a subir con ayuda y repetí.',
    ],
    erroresComunes: [
      'Soltarse a mitad de camino en vez de resistir hasta abajo.',
      'Frenar arriba y no llegar a estirar los brazos.',
      'Hacer demasiadas: son exigentes y dejan agujetas por varios días.',
    ],
    ventana: { min: 8, max: 20 },
    series: 3,
    ccr: 0.72,
    descansoSegundos: 120,
  },
  {
    id: 'dominada-asistida',
    nombre: 'Dominadas asistidas con banda',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 6,
    resumen:
      'El gesto completo con una banda elástica que devuelve parte del peso. Se va cambiando por bandas más finas.',
    tecnica: [
      'Enganchá la banda en la barra y apoyá una rodilla o un pie en el otro extremo.',
      'Agarre al ancho de los hombros, palmas hacia adelante.',
      'Tirá hasta pasar la pera por encima de la barra.',
      'Bajá controlado hasta estirar del todo antes de la próxima.',
    ],
    erroresComunes: [
      'Usar una banda tan gruesa que hace el trabajo por vos.',
      'Impulsarse con las piernas.',
      'Quedarse en la misma banda por comodidad.',
    ],
    ventana: { min: 5, max: 12 },
    series: 3,
    ccr: 0.78,
    descansoSegundos: 120,
  },
  {
    id: 'dominada-asistida-leve',
    nombre: 'Dominadas con banda liviana',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 7,
    resumen:
      'La misma dominada asistida, pero con una banda más fina. Es el último empujón antes de la dominada limpia.',
    tecnica: [
      'Enganchá una banda fina en la barra y apoyá un pie en el otro extremo.',
      'Agarre al ancho de los hombros, palmas hacia adelante, brazos estirados abajo.',
      'Tirá hasta pasar la pera por encima de la barra sin ayudarte con las piernas.',
      'Bajá controlado hasta el colgado completo antes de la próxima.',
    ],
    erroresComunes: [
      'Volver a la banda gruesa cuando la serie se pone difícil, en vez de cortarla y descansar.',
      'Aprovechar el rebote de la banda abajo para arrancar la repetición.',
      'Elegir la banda por lo que sale en la primera repetición y no por lo que sale en la última.',
    ],
    ventana: { min: 4, max: 10 },
    series: 3,
    ccr: 0.86,
    descansoSegundos: 120,
  },
  {
    id: 'dominada-completa',
    nombre: 'Dominadas completas',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 8,
    resumen:
      'La medida universal de la fuerza de tracción. Sin ayuda, sin impulso, recorrido completo.',
    tecnica: [
      'Colgate con los brazos estirados y los hombros activos, no muertos.',
      'Empezá el movimiento bajando los omóplatos antes de doblar los codos.',
      'Tirá hasta que la pera pase la barra.',
      'Bajá controlado hasta el colgado completo.',
    ],
    erroresComunes: [
      'Patear las piernas para tomar impulso.',
      'Quedarse a mitad de camino y contarla igual.',
      'Colgarse muerto de los hombros entre repetición y repetición.',
    ],
    ventana: { min: 3, max: 10 },
    series: 3,
    ccr: 0.95,
    descansoSegundos: 150,
  },
  {
    id: 'dominada-arquera',
    nombre: 'Dominadas arqueras',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 9,
    resumen:
      'Se sube hacia un lado mientras el otro brazo se estira. El camino a la dominada a un brazo.',
    tecnica: [
      'Agarre bastante más ancho que los hombros.',
      'Tirá hacia una mano hasta que el mentón quede sobre ella.',
      'El otro brazo se estira acompañando, sin traccionar.',
      'Alterná el lado en cada repetición.',
    ],
    erroresComunes: [
      'Repartir el esfuerzo entre los dos brazos.',
      'Sacrificar el recorrido completo por llegar más al costado.',
      'Pasar a este nivel sin doce dominadas limpias.',
    ],
    ventana: { min: 3, max: 8 },
    series: 3,
    ccr: 1.15,
    descansoSegundos: 150,
  },
  {
    id: 'dominada-un-brazo-asistida',
    nombre: 'Dominadas a un brazo asistidas',
    patron: 'traccion',
    medida: 'repeticiones',
    nivel: 10,
    resumen:
      'Un brazo tracciona y el otro sostiene la muñeca o una toalla. El último escalón antes de la dominada a un brazo.',
    tecnica: [
      'Agarrá la barra con una mano y con la otra tomate de tu propia muñeca.',
      'A medida que ganás fuerza, agarrá más abajo: antebrazo, después una toalla colgada.',
      'Tirá controlando la rotación del cuerpo.',
      'Bajá lento hasta el colgado completo.',
    ],
    erroresComunes: [
      'Ayudarse de más con el brazo libre sin registrarlo.',
      'Descuidar el codo: si molesta, bajá un nivel y sumá trabajo de antebrazo.',
      'Entrenarlas con poco descanso entre series.',
    ],
    ventana: { min: 2, max: 6 },
    series: 3,
    ccr: 1.4,
    descansoSegundos: 180,
  },
  // ─── Piernas ─────────────────────────────────────────────────────────
  {
    id: 'sentadilla-banco',
    nombre: 'Sentadillas al banco',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 1,
    resumen:
      'Sentarse y levantarse con control. Enseña el recorrido y da una referencia de profundidad.',
    tecnica: [
      'Parate de espaldas a una silla, pies al ancho de las caderas.',
      'Bajá llevando la cadera atrás hasta apoyar apenas en el asiento.',
      'No te dejes caer: tocá y subí.',
      'Empujá con los talones y estirá las caderas arriba.',
    ],
    erroresComunes: [
      'Desplomarse en la silla y perder toda la tensión.',
      'Levantar los talones del piso.',
      'Meter las rodillas hacia adentro al subir.',
    ],
    ventana: { min: 10, max: 15 },
    series: 3,
    ccr: 0.35,
    descansoSegundos: 60,
  },
  {
    id: 'sentadilla-asistida',
    nombre: 'Sentadillas asistidas',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 2,
    resumen:
      'La sentadilla completa agarrándote del marco de una puerta o de un poste, usando los brazos lo mínimo indispensable para llegar abajo con la espalda derecha.',
    tecnica: [
      'Agarrate del marco con las dos manos a la altura del pecho, con los pies al ancho de los hombros y a un paso del apoyo.',
      'Bajá lento hasta el fondo dejando que los brazos solo te acomoden el equilibrio.',
      'Abajo sostené el pecho arriba y la espalda con su curva natural.',
      'Subí empujando el piso con los talones y soltando el agarre todo lo que puedas.',
    ],
    erroresComunes: [
      'Traccionar con los brazos para subir, que convierte esto en otro ejercicio.',
      'Levantar los talones para bajar más. Es preferible bajar menos y quedar apoyado.',
      'Dejar que las rodillas se vayan hacia adentro al salir del fondo.',
    ],
    ventana: { min: 10, max: 15 },
    series: 3,
    ccr: 0.42,
    descansoSegundos: 60,
  },
  {
    id: 'sentadilla-completa',
    nombre: 'Sentadillas completas',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 3,
    resumen:
      'Sin apoyo y hasta abajo. La base de todo el trabajo de piernas que viene después.',
    tecnica: [
      'Pies al ancho de los hombros, puntas apenas hacia afuera.',
      'Bajá hasta que la cadera pase por debajo de las rodillas, si la movilidad te lo permite.',
      'Pecho arriba y espalda con su curva natural.',
      'Subí empujando el piso, sin rebotar abajo.',
    ],
    erroresComunes: [
      'Redondear la espalda baja en el fondo.',
      'Quedarse a medio recorrido por costumbre.',
      'Forzar la profundidad a costa de la técnica.',
    ],
    ventana: { min: 10, max: 15 },
    series: 3,
    ccr: 0.5,
    descansoSegundos: 75,
  },
  {
    id: 'zancada',
    nombre: 'Zancadas',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 4,
    resumen:
      'El primer ejercicio de la cadena en el que cada pierna trabaja sola, todavía con el otro pie en el piso para ayudar con el equilibrio. La cantidad es por pierna.',
    tecnica: [
      'Parate derecho con los pies al ancho de las caderas y adelantá una pierna un paso largo.',
      'Bajá vertical hasta que la rodilla de atrás quede a un puño del piso.',
      'El peso va sobre el talón de adelante, con el torso erguido.',
      'Empujá con la pierna de adelante para volver y completá todas las repeticiones antes de cambiar de lado.',
    ],
    erroresComunes: [
      'Dar un paso corto: la rodilla de adelante queda muy volcada sobre el pie y ahí es donde aparece la molestia.',
      'Golpear el piso con la rodilla de atrás en vez de frenar la bajada.',
      'Inclinar el torso hacia adelante para llegar abajo.',
    ],
    ventana: { min: 8, max: 12 },
    series: 3,
    ccr: 0.62,
    descansoSegundos: 90,
  },
  {
    id: 'sentadilla-bulgara',
    nombre: 'Sentadilla búlgara',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 5,
    resumen:
      'Una pierna adelante, el pie de atrás elevado. Casi todo el peso sobre una sola pierna, con el equilibrio todavía asistido.',
    tecnica: [
      'Apoyá el empeine del pie de atrás en una silla y dejá la pierna de adelante a un paso largo.',
      'Bajá vertical hasta que la rodilla de atrás casi toque el piso.',
      'El peso va sobre el talón de adelante.',
      'Completá todas las repeticiones de un lado antes de cambiar.',
    ],
    erroresComunes: [
      'Poner el pie de adelante demasiado cerca y cargar la rodilla.',
      'Inclinar el torso adelante y convertirlo en un ejercicio de cadera.',
      'Empujar con la pierna de atrás.',
    ],
    ventana: { min: 6, max: 12 },
    series: 3,
    ccr: 0.72,
    descansoSegundos: 90,
  },
  {
    id: 'sentadilla-a-banco-una-pierna',
    nombre: 'Sentadilla a una pierna al banco',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 6,
    resumen:
      'Sentarse y levantarse de un banco con una sola pierna. Acá se progresa bajando la altura del banco, no sumando repeticiones sin fin. La cantidad es por pierna.',
    tecnica: [
      'Parate de espaldas al banco, en una pierna, con la otra estirada adelante.',
      'Bajá llevando la cadera atrás hasta apoyar apenas en el asiento, sin dejarte caer.',
      'Tocá y subí empujando con el talón, sin tomar impulso con la pierna libre.',
      'Cuando llegues al techo de repeticiones, buscá un banco más bajo y volvé a empezar.',
    ],
    erroresComunes: [
      'Desplomarse en el banco y usar el rebote para salir.',
      'Apoyar el pie de la pierna libre en el último tramo, que es justo donde está el trabajo.',
      'Bajar la altura del banco de golpe y perder la técnica en todas las repeticiones.',
    ],
    ventana: { min: 5, max: 10 },
    series: 3,
    ccr: 0.82,
    descansoSegundos: 120,
  },
  {
    id: 'sentadilla-una-pierna-asistida',
    nombre: 'Sentadilla a una pierna asistida',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 7,
    resumen:
      'La pistol completa, pero sosteniéndote de algo. Se va soltando el agarre a medida que aparece la fuerza y el equilibrio.',
    tecnica: [
      'Agarrate del marco de una puerta o de un poste con una mano.',
      'Estirá una pierna adelante y bajá con la otra hasta el fondo.',
      'Usá el agarre solo para el equilibrio, no para tirar.',
      'Subí sin apoyar la pierna libre.',
    ],
    erroresComunes: [
      'Traccionar con el brazo para subir.',
      'Apoyar el talón de la pierna libre a mitad de camino.',
      'Levantar el talón de la pierna que trabaja.',
    ],
    ventana: { min: 5, max: 10 },
    series: 3,
    ccr: 0.9,
    descansoSegundos: 120,
  },
  {
    id: 'pistol-squat',
    nombre: 'Sentadilla a una pierna',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 8,
    resumen:
      'La pistol. Fuerza, movilidad de tobillo y equilibrio en un solo movimiento.',
    tecnica: [
      'Parate en una pierna con la otra estirada adelante.',
      'Bajá lento con los brazos adelante para contrapesar.',
      'Llegá hasta el fondo sin apoyar la pierna libre.',
      'Subí empujando con el talón, sin impulso.',
    ],
    erroresComunes: [
      'Caer de golpe en el fondo.',
      'Perder el equilibrio hacia atrás por falta de movilidad de tobillo.',
      'Entrenar solo la pierna que sale mejor.',
    ],
    ventana: { min: 3, max: 8 },
    series: 3,
    ccr: 1.0,
    descansoSegundos: 120,
  },
  {
    id: 'pistol-con-pausa',
    nombre: 'Sentadilla a una pierna con pausa',
    patron: 'piernas',
    medida: 'repeticiones',
    nivel: 9,
    resumen:
      'La pistol con dos segundos de pausa abajo, que es justo donde se pierde la tensión. La cantidad es por pierna.',
    tecnica: [
      'Parate en una pierna con la otra estirada adelante y los brazos al frente para contrapesar.',
      'Bajá controlado hasta el fondo, sin dejarte caer en el último tramo.',
      'Sostené dos segundos abajo, con el talón apoyado y el pecho arriba.',
      'Subí empujando parejo, sin rebote y sin apoyar la pierna libre.',
    ],
    erroresComunes: [
      'Aflojar en el fondo y quedar colgado de la rodilla en vez de sostener con la pierna. La pausa está justamente para eso.',
      'Dejar que la rodilla se vaya hacia adentro al salir del fondo, que es el punto de menos control de todo el recorrido.',
      'Sumar la pausa antes de tener la pistol limpia. Primero el recorrido, después el tiempo abajo.',
    ],
    ventana: { min: 3, max: 8 },
    series: 3,
    ccr: 1.1,
    descansoSegundos: 150,
  },
  // ─── Core ────────────────────────────────────────────────────────────
  {
    id: 'plancha-rodillas',
    nombre: 'Plancha de rodillas',
    patron: 'core',
    medida: 'segundos',
    nivel: 1,
    resumen:
      'Sostener la línea del cuerpo con apoyo en rodillas y antebrazos. El abdomen aprende a trabajar sosteniendo, no doblando.',
    tecnica: [
      'Apoyá antebrazos y rodillas, codos debajo de los hombros.',
      'Apretá glúteos y abdomen hasta formar una línea de rodillas a cabeza.',
      'Empujá el piso con los antebrazos para no hundir los hombros.',
      'Respirá normal mientras sostenés.',
    ],
    erroresComunes: [
      'Levantar la cola para descansar.',
      'Hundir la espalda baja.',
      'Aguantar la respiración todo el tiempo.',
    ],
    ventana: { min: 15, max: 30 },
    series: 3,
    ccr: 0.35,
    descansoSegundos: 45,
  },
  {
    id: 'plancha',
    nombre: 'Plancha',
    patron: 'core',
    medida: 'segundos',
    nivel: 2,
    resumen:
      'La plancha completa, con apoyo en las puntas de los pies. Si podés sostener dos minutos, está lista.',
    tecnica: [
      'Antebrazos en el piso, codos debajo de los hombros, pies juntos.',
      'Línea recta de talones a cabeza.',
      'Meté la pelvis apenas hacia adentro para no arquear la espalda.',
      'Mirá el piso, no adelante.',
    ],
    erroresComunes: [
      'Subir la cadera y convertirla en una posición de descanso.',
      'Contar el tiempo mientras la forma ya se rompió.',
      'Apretar los hombros hacia las orejas.',
    ],
    ventana: { min: 15, max: 30 },
    series: 3,
    ccr: 0.48,
    descansoSegundos: 60,
  },
  {
    id: 'plancha-brazo-alternado',
    nombre: 'Plancha con brazo alternado',
    patron: 'core',
    medida: 'segundos',
    nivel: 3,
    resumen:
      'Una plancha en la que vas levantando un brazo por vez cada pocos segundos. Suma la tarea de resistir la rotación sin cambiar de ejercicio.',
    tecnica: [
      'Armá la plancha con apoyo en las manos, brazos estirados y pies un poco más separados que las caderas.',
      'Levantá una mano unos centímetros del piso y sostené dos o tres segundos.',
      'Apoyá y cambiá de lado, sin dejar que la cadera se vaya hacia el costado.',
      'Contá el tiempo total que sostenés la posición, no la cantidad de cambios.',
    ],
    erroresComunes: [
      'Rotar la cadera hacia el lado del brazo que se levanta.',
      'Juntar los pies, que angosta la base y hace imposible sostener la línea.',
      'Levantar el brazo de golpe y usar ese envión para pasar al otro lado.',
    ],
    ventana: { min: 15, max: 30 },
    series: 3,
    ccr: 0.56,
    descansoSegundos: 60,
  },
  {
    id: 'elevacion-rodillas-suelo',
    nombre: 'Elevación de rodillas en el suelo',
    patron: 'core',
    medida: 'repeticiones',
    nivel: 4,
    resumen:
      'Acostado boca arriba, llevar las rodillas al pecho sin despegar la zona lumbar del piso. Es el puente entre sostener la línea y mover las piernas.',
    tecnica: [
      'Acostate boca arriba con los brazos al costado y las palmas apoyadas.',
      'Pegá la espalda baja al piso antes de empezar y no la sueltes en toda la serie.',
      'Llevá las rodillas al pecho enrollando la pelvis, no solo doblando la cadera.',
      'Bajá lento hasta dejar los pies a un palmo del piso y arrancá la próxima.',
    ],
    erroresComunes: [
      'Dejar que la espalda baja se arquee: ahí el trabajo se va a los flexores de la cadera. Si no lo podés evitar, bajá menos las piernas.',
      'Empujar contra el piso con las manos para ayudarse a subir.',
      'Dejar caer las piernas y usar el rebote para la repetición siguiente.',
    ],
    ventana: { min: 8, max: 15 },
    series: 3,
    ccr: 0.62,
    descansoSegundos: 60,
  },
  {
    id: 'elevacion-piernas-suelo',
    nombre: 'Elevación de piernas en el suelo',
    patron: 'core',
    medida: 'repeticiones',
    nivel: 5,
    resumen:
      'Lo mismo pero con las piernas estiradas. La palanca es mucho más larga, así que cuesta bastante más sostener la espalda pegada al piso.',
    tecnica: [
      'Acostate boca arriba con las piernas estiradas y juntas y las manos al costado de la cadera.',
      'Pegá la espalda baja al piso y sostenela así todo el recorrido.',
      'Subí las piernas estiradas hasta dejarlas perpendiculares al piso.',
      'Bajá lento y frená justo antes de que la espalda se empiece a despegar.',
    ],
    erroresComunes: [
      'Bajar más de lo que la espalda aguanta pegada. El punto donde se despega es el final del recorrido, aunque los pies queden lejos del piso.',
      'Doblar las rodillas a mitad de camino para llegar más abajo.',
      'Dejar caer las piernas y golpear el piso con los talones.',
    ],
    ventana: { min: 6, max: 12 },
    series: 3,
    ccr: 0.72,
    descansoSegundos: 75,
  },
  {
    id: 'elevacion-rodillas-colgado',
    nombre: 'Elevación de rodillas colgado',
    patron: 'core',
    medida: 'repeticiones',
    nivel: 6,
    resumen:
      'Colgado de la barra, subir las rodillas al pecho. Suma trabajo de agarre al del abdomen.',
    tecnica: [
      'Colgate con los brazos estirados y los hombros activos.',
      'Subí las rodillas hacia el pecho enrollando la pelvis, no solo doblando la cadera.',
      'Frená el balanceo antes de cada repetición.',
      'Bajá controlado hasta quedar completamente estirado.',
    ],
    erroresComunes: [
      'Usar el envión del cuerpo para subir las rodillas.',
      'Subir solo hasta la cintura.',
      'Encogerse de hombros al colgarse.',
    ],
    ventana: { min: 5, max: 12 },
    series: 3,
    ccr: 0.8,
    descansoSegundos: 90,
  },
  {
    id: 'elevacion-piernas-colgado',
    nombre: 'Elevación de piernas colgado',
    patron: 'core',
    medida: 'repeticiones',
    nivel: 7,
    resumen:
      'Las piernas estiradas hasta la altura de la barra. Bastante más exigente que con las rodillas dobladas.',
    tecnica: [
      'Colgate con los brazos estirados y sin balanceo.',
      'Subí las piernas estiradas hasta que queden paralelas al piso o más arriba.',
      'Mantené las rodillas estiradas todo el recorrido.',
      'Bajá lento, sin dejarlas caer.',
    ],
    erroresComunes: [
      'Doblar las rodillas a mitad de camino.',
      'Balancearse para llegar.',
      'Bajar de golpe y castigar la espalda baja.',
    ],
    ventana: { min: 5, max: 10 },
    series: 3,
    ccr: 0.9,
    descansoSegundos: 120,
  },
  {
    id: 'palanca-frontal-negativa',
    nombre: 'Palanca frontal negativa',
    patron: 'core',
    medida: 'segundos',
    nivel: 8,
    resumen:
      'Desde colgado con las rodillas al pecho, bajar el cuerpo lo más lento posible hasta la horizontal. Los segundos que registrás son los de bajada controlada, sumados.',
    tecnica: [
      'Colgate con agarre prono, los brazos estirados y firmes, y llevá las rodillas al pecho.',
      'Rotá hasta quedar horizontal de espaldas al piso, con la espalda plana.',
      'Estirá las piernas de a poco mientras el cuerpo baja, resistiendo todo el camino.',
      'Cortá cuando ya no podés frenar la bajada y contá solo los segundos en que tuviste el control.',
    ],
    erroresComunes: [
      'Doblar los codos para aguantar un poco más. Van rectos y activos: el codo es lo que más se resiente acá, y se cuida cortando la serie antes.',
      'Arquear la espalda baja para simular la horizontal. Si la cadera se hunde, volvé a agrupar las rodillas y terminá ahí.',
      'Empezar con esto sin tener firmes la palanca agrupada y las dominadas completas.',
    ],
    ventana: { min: 8, max: 20 },
    series: 3,
    ccr: 1.0,
    descansoSegundos: 150,
  },
  {
    id: 'palanca-frontal-agrupada',
    nombre: 'Palanca frontal agrupada',
    patron: 'core',
    medida: 'segundos',
    nivel: 9,
    resumen:
      'Colgado y horizontal con las rodillas al pecho. La primera parada real en el camino a la palanca frontal.',
    tecnica: [
      'Colgate con agarre prono y los brazos estirados y firmes.',
      'Llevá las rodillas al pecho y rotá el cuerpo hasta quedar horizontal, de espaldas al piso.',
      'Empujá la barra hacia abajo con los brazos rectos para sostener la posición.',
      'Sostené el tiempo que puedas con la espalda plana.',
    ],
    erroresComunes: [
      'Doblar los codos para compensar.',
      'Arquear la espalda y perder la horizontal.',
      'Ir a esta posición sin tener dominadas y elevaciones de piernas firmes.',
    ],
    ventana: { min: 8, max: 20 },
    series: 3,
    ccr: 1.15,
    descansoSegundos: 150,
  },
]

export const CADENAS: Cadena[] = [
  {
    patron: 'empuje',
    nombre: 'Empuje',
    descripcion:
      'Pectoral, hombro y tríceps. De la pared a la flexión a una mano, sacándole apoyo al cuerpo en cada paso.',
    ejercicios: [
      'flexion-pared',
      'flexion-inclinada-alta',
      'flexion-inclinada',
      'flexion-inclinada-baja',
      'flexion-rodillas',
      'flexion-completa',
      'flexion-diamante',
      'flexion-declinada',
      'flexion-pseudoplancha',
      'flexion-arquera',
      'flexion-una-mano',
    ],
  },
  {
    patron: 'traccion',
    nombre: 'Tracción',
    descripcion:
      'Espalda, bíceps y agarre. El camino a la primera dominada y, mucho más adelante, a la dominada a un brazo.',
    ejercicios: [
      'remo-australiano-alto',
      'remo-australiano-medio',
      'remo-australiano-bajo',
      'remo-australiano-pies-elevados',
      'dominada-negativa',
      'dominada-asistida',
      'dominada-asistida-leve',
      'dominada-completa',
      'dominada-arquera',
      'dominada-un-brazo-asistida',
    ],
  },
  {
    patron: 'piernas',
    nombre: 'Piernas',
    descripcion:
      'Cuádriceps, glúteos y equilibrio. De la sentadilla al banco a la sentadilla a una pierna.',
    ejercicios: [
      'sentadilla-banco',
      'sentadilla-asistida',
      'sentadilla-completa',
      'zancada',
      'sentadilla-bulgara',
      'sentadilla-a-banco-una-pierna',
      'sentadilla-una-pierna-asistida',
      'pistol-squat',
      'pistol-con-pausa',
    ],
  },
  {
    patron: 'core',
    nombre: 'Core',
    descripcion:
      'Abdomen y estabilidad. Primero sostener la línea, después mover las piernas sin perderla.',
    ejercicios: [
      'plancha-rodillas',
      'plancha',
      'plancha-brazo-alternado',
      'elevacion-rodillas-suelo',
      'elevacion-piernas-suelo',
      'elevacion-rodillas-colgado',
      'elevacion-piernas-colgado',
      'palanca-frontal-negativa',
      'palanca-frontal-agrupada',
    ],
  },
]

/** Índice por id, para no recorrer el arreglo entero cada vez. */
export const POR_ID: Map<string, Ejercicio> = new Map(
  EJERCICIOS.map((e) => [e.id, e]),
)

export const CADENA_POR_PATRON: Map<Patron, Cadena> = new Map(
  CADENAS.map((c) => [c.patron, c]),
)

export function buscarEjercicio(id: string): Ejercicio | undefined {
  return POR_ID.get(id)
}

export function cadenaDe(patron: Patron): Cadena {
  const cadena = CADENA_POR_PATRON.get(patron)
  if (!cadena) throw new Error(`No existe la cadena de ${patron}.`)
  return cadena
}

export const NOMBRE_PATRON: Record<Patron, string> = {
  empuje: 'Empuje',
  traccion: 'Tracción',
  piernas: 'Piernas',
  core: 'Core',
}
