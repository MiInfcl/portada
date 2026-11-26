// Al tintero: la gota del logo abre un minijuego. Las gotas caen y hay que atraparlas con el tintero.
// Cada gota que se escapa mancha la hoja; a la tercera mancha se acaba.
(function () {
  var boton = document.querySelector('.gota-boton');
  var dlg = document.getElementById('juego');
  if (!boton || !dlg || !dlg.showModal) return;

  var lienzo = dlg.querySelector('canvas');
  var ctx = lienzo.getContext('2d');
  var elPuntos = dlg.querySelector('.puntos b');
  var elRecord = dlg.querySelector('.record b');
  var elManchas = dlg.querySelectorAll('.vidas span');
  var aviso = dlg.querySelector('.aviso');
  var avisoTitulo = aviso.querySelector('h3');
  var avisoTexto = aviso.querySelector('p');
  var avisoBoton = aviso.querySelector('button');

  var W = 360, H = 480, SUELO = H - 26;
  var TINTA = '#1d1a16', HOJA = '#fffdf8', RAYA = '#ece5d6';
  var GOTA = new Path2D('M16 2S4 18 4 26a12 12 0 0 0 24 0C28 18 16 2 16 2z');

  var record = 0;
  try { record = Number(localStorage.getItem('taller-tintero')) || 0; } catch (e) {}
  elRecord.textContent = record;

  var estado = 'espera'; // espera, juego, fin
  var gotas, manchas, salpicones, tintero, puntos, vidas, reloj, proxima, ultimo, raf;
  var teclas = { izq: false, der: false };

  function reiniciar() {
    gotas = []; manchas = []; salpicones = [];
    tintero = { x: W / 2, objetivo: W / 2, nivel: 0, golpe: 0 };
    puntos = 0; vidas = 3; reloj = 0; proxima = 600;
    elPuntos.textContent = '0';
    elManchas.forEach(function (s) { s.classList.remove('gastada'); });
  }

  function ajustar() {
    var r = window.devicePixelRatio || 1;
    lienzo.width = W * r; lienzo.height = H * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }

  // ---------- dibujo ----------
  function hoja() {
    ctx.fillStyle = HOJA; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = RAYA; ctx.lineWidth = 1;
    for (var y = 40; y < SUELO; y += 28) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    ctx.strokeStyle = TINTA; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, SUELO); ctx.lineTo(W - 6, SUELO); ctx.stroke();
  }

  function dibujarGota(g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.t, g.t * (1 + Math.min(g.v / 2400, .18)));
    ctx.translate(-16, -40);
    ctx.fillStyle = TINTA; ctx.fill(GOTA);
    ctx.restore();
  }

  function dibujarMancha(m) {
    ctx.fillStyle = TINTA;
    m.puntos.forEach(function (p) { ctx.beginPath(); ctx.arc(m.x + p[0], m.y + p[1], p[2], 0, 6.283); ctx.fill(); });
  }

  function dibujarTintero() {
    var x = tintero.x, base = SUELO - 2, g = tintero.golpe;
    ctx.save();
    ctx.translate(x, base); ctx.scale(1 + .07 * g, 1 - .09 * g); ctx.translate(-x, -base);
    // cuerpo
    ctx.fillStyle = HOJA; ctx.strokeStyle = TINTA; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.roundRect(x - 34, base - 40, 68, 40, 10); ctx.fill();
    // tinta adentro, sube con cada gota
    var alto = 6 + Math.min(tintero.nivel, 1) * 26;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x - 34, base - 40, 68, 40, 10); ctx.clip();
    ctx.fillStyle = TINTA; ctx.fillRect(x - 34, base - alto, 68, alto);
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(x - 34, base - 40, 68, 40, 10); ctx.stroke();
    // cuello
    ctx.fillStyle = HOJA;
    ctx.beginPath(); ctx.roundRect(x - 18, base - 52, 36, 14, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function dibujarSalpicon(p) {
    ctx.globalAlpha = Math.max(0, p.vida);
    ctx.fillStyle = TINTA;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function pintar() {
    hoja();
    manchas.forEach(dibujarMancha);
    gotas.forEach(dibujarGota);
    salpicones.forEach(dibujarSalpicon);
    dibujarTintero();
  }

  // ---------- reglas ----------
  function soltar() {
    var dificultad = Math.min(puntos / 40, 1);
    gotas.push({ x: 24 + Math.random() * (W - 48), y: -10, v: 120 + dificultad * 210 + Math.random() * 40, t: 0 });
    proxima = 1000 - dificultad * 600 + Math.random() * 260;
  }

  function salpicar(x, y, n, fuerza) {
    for (var i = 0; i < n; i++) {
      var a = -Math.PI * (.15 + Math.random() * .7);
      salpicones.push({ x: x, y: y, vx: Math.cos(a) * fuerza * (.5 + Math.random()), vy: Math.sin(a) * fuerza * (.5 + Math.random()), r: 1.5 + Math.random() * 2.5, vida: 1 });
    }
  }

  function manchar(x) {
    var pts = [[0, 0, 9 + Math.random() * 4]];
    for (var i = 0; i < 7; i++) {
      var a = Math.random() * Math.PI, d = 10 + Math.random() * 14;
      pts.push([Math.cos(a) * d * (Math.random() < .5 ? -1 : 1), -Math.sin(a) * d * .45, 1.5 + Math.random() * 3.5]);
    }
    manchas.push({ x: x, y: SUELO, puntos: pts });
    vidas--;
    elManchas[2 - vidas] && elManchas[2 - vidas].classList.add('gastada');
    if (vidas <= 0) terminar();
  }

  function avanzar(dt) {
    reloj += dt;
    if ((proxima -= dt * 1000) <= 0) soltar();

    if (teclas.izq) tintero.objetivo -= 420 * dt;
    if (teclas.der) tintero.objetivo += 420 * dt;
    tintero.objetivo = Math.max(36, Math.min(W - 36, tintero.objetivo));
    tintero.x += (tintero.objetivo - tintero.x) * Math.min(1, dt * 18);
    tintero.golpe = Math.max(0, tintero.golpe - dt * 5);

    for (var i = gotas.length - 1; i >= 0; i--) {
      var g = gotas[i];
      g.t = Math.min(1, g.t + dt * 5);
      g.y += g.v * dt;
      var boca = SUELO - 54;
      if (g.y >= boca && g.y - g.v * dt < boca + 6 && Math.abs(g.x - tintero.x) < 22) {
        gotas.splice(i, 1);
        puntos++; elPuntos.textContent = puntos;
        tintero.nivel = Math.min(1, tintero.nivel + .06); tintero.golpe = 1;
        salpicar(g.x, boca, 4, 90);
      } else if (g.y >= SUELO) {
        gotas.splice(i, 1);
        salpicar(g.x, SUELO, 8, 150);
        manchar(g.x);
        if (estado !== 'juego') return;
      }
    }
    for (var j = salpicones.length - 1; j >= 0; j--) {
      var p = salpicones[j];
      p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt * 2.2;
      if (p.vida <= 0) salpicones.splice(j, 1);
    }
  }

  function cuadro(t) {
    var dt = Math.min(.05, (t - ultimo) / 1000 || 0);
    ultimo = t;
    if (estado === 'juego') avanzar(dt);
    pintar();
    if (estado === 'juego') raf = requestAnimationFrame(cuadro);
  }

  function empezar() {
    reiniciar();
    estado = 'juego';
    aviso.hidden = true;
    lienzo.focus({ preventScroll: true });
    ultimo = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(cuadro);
  }

  function terminar() {
    estado = 'fin';
    var nuevo = puntos > record;
    if (nuevo) {
      record = puntos; elRecord.textContent = record;
      try { localStorage.setItem('taller-tintero', String(record)); } catch (e) {}
    }
    avisoTitulo.textContent = 'Se manchó la hoja';
    avisoTexto.textContent = puntos === 0 ? 'Ninguna gota llegó al tintero.'
      : (puntos === 1 ? 'Una gota' : puntos + ' gotas') + ' en el tintero' + (nuevo && puntos > 0 ? ', tu mejor marca.' : '.');
    avisoBoton.textContent = 'Otra vez';
    setTimeout(function () { pintar(); aviso.hidden = false; avisoBoton.focus(); }, 350);
  }

  // ---------- control ----------
  function mover(e) {
    var r = lienzo.getBoundingClientRect();
    tintero.objetivo = (e.clientX - r.left) / r.width * W;
  }
  lienzo.addEventListener('pointermove', mover);
  lienzo.addEventListener('pointerdown', function (e) { mover(e); lienzo.setPointerCapture(e.pointerId); });

  dlg.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { teclas.izq = true; e.preventDefault(); }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { teclas.der = true; e.preventDefault(); }
  });
  dlg.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') teclas.izq = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') teclas.der = false;
  });

  avisoBoton.addEventListener('click', empezar);

  boton.addEventListener('click', function () {
    boton.classList.remove('cae'); void boton.offsetWidth; boton.classList.add('cae');
    setTimeout(function () {
      ajustar(); reiniciar();
      estado = 'espera';
      avisoTitulo.textContent = 'Que no se manche la hoja';
      avisoTexto.textContent = 'Mueve el tintero y atrapa las gotas. Cada una que se escapa mancha la hoja; a la tercera se acaba.';
      avisoBoton.textContent = 'Empezar';
      aviso.hidden = false;
      pintar();
      dlg.showModal();
      avisoBoton.focus();
    }, 260);
  });

  dlg.addEventListener('close', function () {
    estado = 'espera'; cancelAnimationFrame(raf);
    teclas.izq = teclas.der = false;
    boton.classList.remove('cae');
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
