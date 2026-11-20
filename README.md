<!-- PROTOTYPE - NOT FOR PRODUCTION -->
# Stock Out!

Juego cooperativo de caos en una tienda de conveniencia peruana 24 horas: un turno de 4 minutos reponiendo góndolas, cobrando en dos cajas, calentando empanadas y hamburguesas, entregando postres y trapeando derrames.

**Jugar:** https://carlosdavila310.github.io/stock-out/

## Controles

- **J1:** WASD moverse · E agarrar/soltar · F trabajar (mantener) · Q avisar
- **J2:** flechas · K agarrar/soltar · L trabajar · J avisar (pulsa K en el título para unirte; si no, juega el BOT)
- **Título:** 1 Tutorial · 2 Fácil · 3 Intermedio · 4 Difícil · Enter empezar
- P pausa · M silencio

## Jugar online (hasta 4)

Cada persona juega en su propio navegador, con WASD · E · F · Q.

1. En el título pulsa **O**. Quien crea la sala (J1, el anfitrión) pulsa **1** y comparte el código de 4 letras o el enlace (`?sala=CÓDIGO`; **L** lo copia).
2. Los demás pulsan **O**, escriben el código y **Enter**, o abren el enlace.
3. El anfitrión elige la dificultad (**2** a **4**), puede poner un bot (**B**) y empieza con **Enter**.

El turno corre en el navegador del anfitrión: debe mantener su pestaña abierta y a la vista. Con más de dos trabajadores llegan más clientes y las estrellas cuestan más. Sin pausa online.

La conexión es directa entre navegadores (WebRTC con PeerJS, MIT). Solo la creación de la sala pasa por el servicio público gratuito de PeerJS; si una red bloquea la conexión directa, puede que no conecte.

Prototipo hecho en el navegador con three.js (licencia MIT). Productos y tienda genéricos, sin marcas reales.
