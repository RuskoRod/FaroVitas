(() => {
  const layer = document.getElementById('ambient-layer');
  const starsToggle = document.getElementById('stars-toggle');
  const help = document.getElementById('stars-help');
  const hint = document.getElementById('stars-hint');
  const openPreview = document.getElementById('stars-open');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchInput = window.matchMedia('(pointer: coarse)');
  const orientationEvent = window.DeviceOrientationEvent;
  const requiresPermission = typeof orientationEvent?.requestPermission === 'function';
  const policy = document.permissionsPolicy ?? document.featurePolicy;
  const sensorBlocked = ['accelerometer', 'gyroscope'].some((sensor) => policy?.allowsFeature?.(sensor) === false);
  const embedded = window.self !== window.top;
  const bandHeight = 480;
  const overscan = 96;
  const planes = [
    { element: layer.querySelector('.star-plane--far'), bands: new Map(), speed: 0.24, count: 56, size: 0.9, sizeRange: 1, opacity: 0.25, opacityRange: 0.32 },
    { element: layer.querySelector('.star-plane--near'), bands: new Map(), speed: 0.47, count: 26, size: 1.5, sizeRange: 1.4, opacity: 0.43, opacityRange: 0.36 },
  ];
  let permission = requiresPermission ? 'prompt' : 'granted';
  let motionOptIn = false;
  let sensorReady = false;
  let lastPointer = -Infinity;
  let restingTilt = null;
  let touchOrigin = null;
  let frame = null;
  let offsetX = 0;
  let offsetY = 0;
  let skySeed = 0;
  let skyScroll = null;
  let skyHeight = 0;

  const motionEnabled = () => starsToggle.checked && (!reducedMotion.matches || motionOptIn);
  const canUseSensor = () => window.isSecureContext && !!orientationEvent && !sensorBlocked && (touchInput.matches || navigator.maxTouchPoints > 0);
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
    const scroll = motionEnabled() ? window.scrollY : 0;
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

  function resetMotion() {
    lastPointer = -Infinity;
    restingTilt = null;
    touchOrigin = null;
    moveBackground(0, 0);
  }

  function onTilt({ beta, gamma }) {
    if (performance.now() - lastPointer < 800 || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    if (!sensorReady) {
      sensorReady = true;
      touchOrigin = null;
      updateHint();
    }
    const angle = window.screen.orientation?.angle ?? window.orientation ?? 0;
    if (!restingTilt || restingTilt.angle !== angle) {
      restingTilt = { beta, gamma, angle };
      moveBackground(0, 0);
      return;
    }
    const sideways = gamma - restingTilt.gamma;
    const forward = ((beta - restingTilt.beta + 540) % 360) - 180;
    const radians = angle * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    moveBackground((sideways * cosine + forward * sine) * 3.2, (forward * cosine - sideways * sine) * 3.2);
  }

  function updateHint() {
    let message = '';
    let showLink = false;
    if (starsToggle.checked && !motionEnabled()) {
      message = 'Movimiento reducido. Apagá y volvé a encender las estrellas para moverlas.';
    } else if (motionEnabled() && touchInput.matches && !sensorReady) {
      if (embedded) {
        message = 'Deslizá para mover las estrellas. Para probar la inclinación:';
        showLink = true;
      } else if (canUseSensor() && permission === 'prompt') {
        message = 'Para permitir la inclinación, apagá y volvé a encender las estrellas.';
      } else if (!canUseSensor() || permission === 'denied') {
        message = 'Deslizá el dedo para mover las estrellas.';
      }
    }
    hint.textContent = message;
    openPreview.hidden = !showLink;
    help.hidden = !message;
  }

  function syncOrientation() {
    window.removeEventListener('deviceorientation', onTilt);
    sensorReady = false;
    if (motionEnabled() && canUseSensor() && permission === 'granted') {
      window.addEventListener('deviceorientation', onTilt, { passive: true });
    }
    resetMotion();
    layer.classList.toggle('motion-on', motionEnabled());
    updateHint();
    queuePaint();
  }

  function followPointer(event) {
    if (!motionEnabled() || event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) return;
    lastPointer = performance.now();
    moveBackground((event.clientX / window.innerWidth - 0.5) * 144, (event.clientY / window.innerHeight - 0.5) * 128);
  }
  window.addEventListener('pointermove', followPointer, { capture: true, passive: true });
  window.addEventListener('mousemove', followPointer, { capture: true, passive: true });

  window.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'touch' && !event.relatedTarget) resetMotion();
  });
  window.addEventListener('touchstart', (event) => {
    lastPointer = -Infinity;
    if (!motionEnabled() || sensorReady || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchOrigin = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  window.addEventListener('touchmove', (event) => {
    if (!touchOrigin || event.touches.length !== 1) return;
    const touch = event.touches[0];
    moveBackground((touch.clientX - touchOrigin.x) * 0.65, (touch.clientY - touchOrigin.y) * 0.65);
  }, { passive: true });
  function endTouch() {
    if (!touchOrigin) return;
    touchOrigin = null;
    moveBackground(0, 0);
  }
  window.addEventListener('touchend', endTouch, { passive: true });
  window.addEventListener('touchcancel', endTouch, { passive: true });
  window.addEventListener('blur', resetMotion);

  starsToggle.addEventListener('change', async () => {
    layer.hidden = !starsToggle.checked;
    motionOptIn = starsToggle.checked;
    syncOrientation();
    regenerateSky();
    if (motionEnabled() && canUseSensor() && permission === 'prompt') {
      permission = 'requesting';
      try {
        permission = await orientationEvent.requestPermission();
      } catch {
        permission = 'denied';
      }
      syncOrientation();
    }
  });

  reducedMotion.addEventListener('change', () => {
    motionOptIn = false;
    syncOrientation();
  });
  touchInput.addEventListener('change', syncOrientation);
  window.addEventListener('scroll', () => { if (motionEnabled()) queuePaint(); }, { passive: true });
  window.addEventListener('resize', queuePaint, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) regenerateSky(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) regenerateSky(); });
  new MutationObserver(regenerateSky).observe(document.getElementById('titulo-seccion'), { childList: true });
  layer.hidden = !starsToggle.checked;
  syncOrientation();
  regenerateSky();
})();
