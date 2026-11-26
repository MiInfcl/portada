// Cuenta común del taller: Firebase de Tiempos (tiempos-921ec).
// Esquema: users/{uid} (perfil) y users/{uid}/<app>/{id} para cada app.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { conectarSesion, salir } from './sesion.js';
import {
  getFirestore, collection, doc, getDoc, setDoc, getCountFromServer, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);

// Qué mostrar de cada app. «otras» son colecciones viejas que todavía cuentan (Tiempos usaba «listas»).
const APPS = {
  tiempos: { otras: ['listas'], una: 'lista de tiempos', varias: 'listas de tiempos' },
  // Pendientes guarda todo en un documento: users/{uid}/pendientes/lista = { tareas: [...] }
  pendientes: { otras: [], doc: 'lista', campo: 'tareas', una: 'tarea', varias: 'tareas' },
  reproductor: { otras: [], una: 'cosa guardada', varias: 'cosas guardadas' },
};

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
auth.languageCode = 'es';
const db = getFirestore(app);
conectarSesion(auth);

function mostrarError(texto) {
  $('error').textContent = texto;
  $('error').hidden = false;
}

$('entrar').addEventListener('click', async () => {
  $('error').hidden = true;
  $('entrar').disabled = true;
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, proveedor);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, proveedor);
      return;
    }
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      mostrarError('No se pudo entrar con Google. Prueba otra vez en un momento.');
      console.warn(e);
    }
  } finally {
    $('entrar').disabled = false;
  }
});

$('salir').addEventListener('click', () => salir(auth));

async function contar(uid, nombre) {
  const { otras, una, varias, doc: unico, campo } = APPS[nombre];
  let total = 0;
  if (unico) {
    try {
      const d = await getDoc(doc(db, 'users', uid, nombre, unico));
      total = d.exists() && Array.isArray(d.data()[campo]) ? d.data()[campo].length : 0;
    } catch (e) {
      console.warn(nombre, e);
    }
  } else for (const c of [nombre, ...otras]) {
    try {
      total += (await getCountFromServer(collection(db, 'users', uid, c))).data().count;
    } catch (e) {
      console.warn(nombre, c, e);
    }
  }
  return total === 0 ? 'Nada sincronizado todavía' : `${total} ${total === 1 ? una : varias}`;
}

onAuthStateChanged(auth, async (u) => {
  $('fuera').hidden = !!u;
  $('dentro').hidden = !u;
  if (!u) return;

  $('nombre').textContent = u.displayName || 'Sin nombre';
  $('correo').textContent = u.email || '';
  $('inicial').textContent = (u.displayName || u.email || '?').trim().charAt(0).toUpperCase();
  if (u.photoURL && !$('foto')) {
    const img = document.createElement('img');
    img.id = 'foto';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.src = u.photoURL;
    img.hidden = true;
    img.onload = () => { img.hidden = false; $('inicial').hidden = true; };
    img.onerror = () => img.remove();
    $('inicial').before(img);
  }

  // Perfil común: lo leen las demás apps para saber que la cuenta existe.
  setDoc(doc(db, 'users', u.uid), {
    nombre: u.displayName || '', correo: u.email || '', visto: serverTimestamp(),
  }, { merge: true }).catch((e) => console.warn('perfil', e));

  for (const p of document.querySelectorAll('[data-app]')) {
    p.textContent = await contar(u.uid, p.dataset.app);
  }
});
