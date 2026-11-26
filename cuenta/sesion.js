// Sesión única de Taller. Cualquier app de *.taller.ink lo importa:
//   import { conectarSesion, salir } from 'https://taller.ink/cuenta/sesion.js';
//   conectarSesion(auth);          // justo después de getAuth(app)
//   botón Salir -> salir(auth)     // cierra la sesión en todos los subdominios
// Requiere el Firebase tiempos-921ec y la misma versión del SDK (10.12.2).
import {
  onAuthStateChanged, getRedirectResult, signInWithCustomToken, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export const CUENTA = 'https://cuenta.taller.ink';
const MARCA = 'taller-sesion-uid'; // este navegador ya tuvo sesión común con este uid

const marca = {
  leer() { try { return localStorage.getItem(MARCA); } catch { return null; } },
  poner(uid) { try { localStorage.setItem(MARCA, uid); } catch {} },
  quitar() { try { localStorage.removeItem(MARCA); } catch {} },
};

// null = el Worker dijo que no (401, 403); undefined = no se pudo hablar con él.
async function pedir(ruta, opciones = {}) {
  try {
    const r = await fetch(CUENTA + ruta, { credentials: 'include', ...opciones });
    return r.ok ? await r.json() : null;
  } catch {
    return undefined;
  }
}

async function publicar(u) {
  const idToken = await u.getIdToken();
  const r = await pedir('/sesion', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  if (r && r.uid === u.uid) marca.poner(u.uid);
}

async function entrarConToken(auth) {
  const t = await pedir('/token');
  if (t && t.token) {
    marca.poner(t.uid);
    await signInWithCustomToken(auth, t.token);
  }
}

export function conectarSesion(auth) {
  let primera = true;
  const listo = getRedirectResult(auth).catch(() => null);
  onAuthStateChanged(auth, async (u) => {
    const redir = await listo;
    const esPrimera = primera;
    primera = false;

    if (!u) {
      if (esPrimera) await entrarConToken(auth);
      return;
    }
    // Entró recién en esta página (ventana o redirección de Google, o custom token): avisa a la cuenta común.
    if (!esPrimera || (redir && redir.user)) return publicar(u);

    // Ya traía sesión de Firebase de antes: comprueba que la sesión común siga viva.
    const e = await pedir('/estado');
    if (e === undefined) return;                      // Worker inalcanzable: no tocar nada
    if (e && e.uid === u.uid) return marca.poner(u.uid);
    if (e && e.uid !== u.uid) {                       // otra cuenta entró en otro subdominio
      await signOut(auth);
      return entrarConToken(auth);
    }
    if (marca.leer() === u.uid) {                     // salió en otro subdominio
      marca.quitar();
      return signOut(auth);
    }
    return publicar(u);                               // sesión de antes del Worker: la sube
  });
}

export async function salir(auth) {
  await pedir('/salir', { method: 'POST' });
  marca.quitar();
  await signOut(auth);
}
