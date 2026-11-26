(() => {
  document.getElementById('btn-ajustes').addEventListener('click', () => abrirModal('modal-ajustes'));
  document.getElementById('btn-cerrar-ajustes').addEventListener('click', () => cerrarModal('modal-ajustes'));

  // Recordar modo claro/oscuro (se restaura en index.html antes de pintar)
  const theme = document.getElementById('theme-toggle');
  theme.addEventListener('change', () => {
    try { localStorage.setItem('fv_theme', theme.checked ? 'light' : 'dark'); } catch {}
  });
})();
