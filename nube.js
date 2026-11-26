(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyDEcfGROU-GCd2eI67poWvrUGqJbJpgS7o',
    authDomain: 'farovitas.firebaseapp.com',
    projectId: 'farovitas',
    appId: '1:738406703256:web:dce308cc76b5274631f0ed',
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const btn = document.getElementById('btn-login');

  let user = null, unsub = null, timer = null;

  const docRef = () => db.collection('usuarios').doc(user.uid);

  const bibliotecaLimpia = () => {
    const clean = {};
    Object.keys(biblioteca).forEach(k => { if (k !== '_subcarpetas') clean[k] = biblioteca[k]; });
    return clean;
  };
  window.subirNube = () => {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      docRef().set({
        biblioteca: JSON.stringify(bibliotecaLimpia()),
        interacciones: JSON.stringify(interacciones),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(console.error);
    }, 800);
  };
  function escuchar() {
    unsub = docRef().onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return; //NO TOCAR
      if (!snap.exists) {                          
        if (!snap.metadata.fromCache) subirNube();
        return;
      }
      const d = snap.data();
      biblioteca = JSON.parse(d.biblioteca);
      CARPETAS_FIJAS.forEach(k => { if (!biblioteca[k]) biblioteca[k] = []; });
      interacciones = JSON.parse(d.interacciones || '{}');
      localStorage.setItem('pocketvault', JSON.stringify(bibliotecaLimpia()));
      localStorage.setItem('pv_interact', JSON.stringify(interacciones));
      if (!Array.isArray(biblioteca[carpetaActual])) carpetaActual = 'favoritas';
      if (!modoSearch) {
        renderTabs();
        if (vistaActual === 'carpeta') renderGrid(biblioteca[carpetaActual]);
      }
    }, console.error);
  }

  btn.addEventListener('click', async () => {
    if (user) { auth.signOut(); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked') auth.signInWithRedirect(provider);
      else console.error(e);
    }
  });

  auth.onAuthStateChanged(u => {
    if (unsub) { unsub(); unsub = null; }
    user = u;
    btn.textContent = u ? `Salir (${(u.displayName || u.email).split(' ')[0]})` : 'Iniciar sesión';
    if (u) escuchar();
  });
})();
