(() => {
  const layer = document.getElementById('ambient-layer');
  const starsToggle = document.getElementById('stars-toggle');
  // Celular / tablet: sin mouse. Ahí las estrellas se mueven solas.
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)');
  const STORAGE_KEY = 'fv_stars';
  const bandHeight = 480;
  const overscan = 96;
  const planes = [
    { element: layer.querySelector('.star-plane--far'), bands: new Map(), speed: 0.24, count: 56, size: 0.9, sizeRange: 1, opacity: 0.25, opacityRange: 0.32 },
    { element: layer.querySelector('.star-plane--near'), bands: new Map(), speed: 0.47, count: 26, size: 1.5, sizeRange: 1.4, opacity: 0.43, opacityRange: 0.36 },
  ];
  let frame = null;
  let driftTimer = null;
  let offsetX = 0;
  let offsetY = 0;
  let skySeed = 0;
  let skyScroll = null;
  let skyHeight = 0;

  // Las estrellas arrancan encendidas; si las apagás, se recuerda al recargar.
  try { starsToggle.checked = localStorage.getItem(STORAGE_KEY) !== '0'; } catch {}

  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

  function createBand(plane, number) {
    const band = document.createElement('div');
    band.className = 'star-band';
    band.style.setProperty('--band-height', `${bandHeight}px`);
    let state = skySeed ^ Math.imul(number, 0x9e3779b1) ^ plane.count;
    const next = () => {
      state = (state + 0x6d2b79f5) | 0;
      let hash = Math.imul(state ^ (state >>> 15), state | 1);
      hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61);
      return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = 0; index < plane.count; index += 1) {
      const dot = document.createElement('span');
      dot.className = 'star-point';
      dot.style.setProperty('--star-left', `${(next() * 100).toFixed(2)}%`);
      dot.style.setProperty('--star-top', `${(next() * 100).toFixed(2)}%`);
      dot.style.setProperty('--star-size', `${(plane.size + next() * plane.sizeRange).toFixed(2)}px`);
      dot.style.setProperty('--star-opacity', (plane.opacity + next() * plane.opacityRange).toFixed(2));
      band.append(dot);
    }
    plane.element.append(band);
    return band;
  }

  function drawSky() {
    const scroll = starsToggle.checked ? window.scrollY : 0;
    const height = window.innerHeight;
    if (scroll === skyScroll && height === skyHeight) return;
    skyScroll = scroll;
    skyHeight = height;
    for (const plane of planes) {
      const offset = scroll * plane.speed;
      const first = Math.floor((offset - overscan) / bandHeight);
      const last = Math.floor((offset + height + overscan) / bandHeight);
      for (const [number, band] of plane.bands) {
        if (number >= first && number <= last) continue;
        band.remove();
        plane.bands.delete(number);
      }
      for (let number = first; number <= last; number += 1) {
        if (!plane.bands.has(number)) plane.bands.set(number, createBand(plane, number));
        plane.bands.get(number).style.transform = `translateY(${number * bandHeight - offset}px)`;
      }
    }
  }

  function queuePaint() {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (!starsToggle.checked) return;
      layer.style.setProperty('--ambient-x', `${offsetX}px`);
      layer.style.setProperty('--ambient-y', `${offsetY}px`);
      drawSky();
    });
  }

  function regenerateSky() {
    if (!starsToggle.checked) return;
    skySeed = (Math.random() * 4294967296) | 0;
    skyScroll = null;
    for (const plane of planes) {
      plane.bands.clear();
      plane.element.replaceChildren();
    }
    drawSky();
  }

  function moveBackground(horizontal, vertical) {
    const nextX = Math.round(clamp(horizontal, 72));
    const nextY = Math.round(clamp(vertical, 64));
    if (nextX === offsetX && nextY === offsetY) return;
    offsetX = nextX;
    offsetY = nextY;
    queuePaint();
  }

  // Celular: deriva lenta y "aleatoria" (suma de ondas con ritmos distintos + fase al azar)
  function startDrift() {
    stopDrift();
    const phase = Math.random() * 1000;
    driftTimer = window.setInterval(() => {
      const t = phase + performance.now() / 1000;
      moveBackground(
        Math.sin(t * 0.18) * 44 + Math.sin(t * 0.43 + 1.7) * 22,
        Math.cos(t * 0.15 + 0.6) * 38 + Math.sin(t * 0.39 + 2.4) * 20
      );
    }, 50);
  }

  function stopDrift() {
    window.clearInterval(driftTimer);
    driftTimer = null;
  }

  function syncStars() {
    stopDrift();
    const on = starsToggle.checked;
    layer.hidden = !on;
    layer.classList.toggle('motion-on', on);
    moveBackground(0, 0);
    if (on && touchOnly.matches) startDrift();
    queuePaint();
  }

  // PC: las estrellas siguen al mouse
  function followPointer(event) {
    if (!starsToggle.checked || touchOnly.matches || event.pointerType === 'touch') return;
    moveBackground((event.clientX / window.innerWidth - 0.5) * 144, (event.clientY / window.innerHeight - 0.5) * 128);
  }
  window.addEventListener('pointermove', followPointer, { capture: true, passive: true });
  window.addEventListener('pointerout', (event) => {
    if (!touchOnly.matches && event.pointerType !== 'touch' && !event.relatedTarget) moveBackground(0, 0);
  });
  window.addEventListener('blur', () => { if (!touchOnly.matches) moveBackground(0, 0); });

  starsToggle.addEventListener('change', () => {
    try { localStorage.setItem(STORAGE_KEY, starsToggle.checked ? '1' : '0'); } catch {}
    syncStars();
    regenerateSky();
  });

  touchOnly.addEventListener('change', syncStars);
  window.addEventListener('scroll', () => { if (starsToggle.checked) queuePaint(); }, { passive: true });
  window.addEventListener('resize', queuePaint, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) regenerateSky(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) regenerateSky(); });
  new MutationObserver(regenerateSky).observe(document.getElementById('titulo-seccion'), { childList: true });
  syncStars();
  regenerateSky();
})();
