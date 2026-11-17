'use strict';

/* ============================================================
   SkySignal — live animated sky canvas
   Draws weather ambience behind the app: sun + rays, moon,
   twinkling & shooting stars, drifting clouds, falling rain,
   snow, fog, lightning flashes — plus optional seasonal
   particles (winter flurry, monsoon drizzle, autumn leaves,
   spring petals). Pure canvas, no dependencies.
   ============================================================ */

const Sky = (function () {
  let canvas = null, ctx = null;
  let W = 0, H = 0, dpr = 1;
  let rafId = 0, lastTs = 0, t = 0;
  let reduced = false;

  const scene = { kind: 'clear', night: false, intensity: 0.5, accent: null };
  let stars = [], clouds = [], drops = [], flakes = [], motes = [], blobs = [];
  let shooting = null, nextShootAt = 0;
  let flash = 0, nextFlashAt = 0, bolt = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  /* ---------- lifecycle ---------- */

  function mount(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!reduced) {
        lastTs = 0;
        loop(performance.now());
      }
    });
    if (reduced) { render(0); } else { lastTs = 0; loop(performance.now()); }
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduced) render(0);
  }

  function setScene(next) {
    Object.assign(scene, next || {});
    rebuild();
    if (reduced) render(0);
  }

  /* ---------- scene construction ---------- */

  function rebuild() {
    stars = []; clouds = []; drops = []; flakes = []; motes = []; blobs = [];
    bolt = null; shooting = null; flash = 0;
    const { kind, night, intensity, accent } = scene;

    if (night && kind !== 'fog') {
      const n = kind === 'clear' ? 110 : kind === 'partly' ? 80 : kind === 'clouds' ? 36 : 18;
      for (let i = 0; i < n; i++) {
        stars.push({ x: rnd(0, 1), y: rnd(0, 0.62), r: rnd(0.4, 1.5), p: rnd(0, TAU), s: rnd(0.5, 2) });
      }
    }

    const cloudN = { clear: 2, partly: 4, clouds: 7, rain: 8, snow: 8, thunder: 9, fog: 3 }[kind] || 3;
    const cloudA = { clear: 0.3, partly: 0.45, clouds: 0.55, rain: 0.5, snow: 0.45, thunder: 0.55, fog: 0.2 }[kind] || 0.4;
    for (let i = 0; i < cloudN; i++) {
      clouds.push({
        x: rnd(-0.15, 1.1), y: rnd(0.02, 0.3), s: rnd(0.55, 1.35),
        v: rnd(0.004, 0.012) * (Math.random() < 0.5 ? 1 : -1) * (0.6 + intensity),
        a: cloudA * rnd(0.8, 1.1),
      });
    }

    if (kind === 'rain' || kind === 'thunder') {
      const n = Math.round(70 + 150 * (kind === 'thunder' ? 1 : intensity));
      for (let i = 0; i < n; i++) drops.push(newDrop(true));
    }
    if (kind === 'snow') {
      const n = Math.round(70 + 70 * intensity);
      for (let i = 0; i < n; i++) flakes.push(newFlake(true));
    }
    if (kind === 'fog') {
      for (let i = 0; i < 6; i++) {
        blobs.push({ x: rnd(0, 1), y: rnd(0.15, 0.9), r: rnd(0.25, 0.5), v: rnd(0.005, 0.014) * (Math.random() < 0.5 ? 1 : -1) });
      }
    }

    /* seasonal accents — only while the real weather is calm */
    const calm = kind === 'clear' || kind === 'partly' || kind === 'clouds';
    if (calm && accent) {
      if (accent === 'winter') for (let i = 0; i < 26; i++) flakes.push(newFlake(true, true));
      if (accent === 'monsoon') for (let i = 0; i < 34; i++) drops.push(newDrop(true, 0.3));
      if (accent === 'autumn') for (let i = 0; i < 14; i++) motes.push(newMote('leaf'));
      if (accent === 'spring') for (let i = 0; i < 16; i++) motes.push(newMote('petal'));
    }

    nextShootAt = performance.now() + rnd(4000, 9000);
    nextFlashAt = performance.now() + rnd(2500, 6000);
  }

  function newDrop(anywhere, forceAlpha) {
    return {
      x: rnd(-0.05, 1.05), y: anywhere ? rnd(-0.1, 1) : rnd(-0.3, -0.02),
      len: rnd(0.012, 0.026), v: rnd(0.9, 1.7), drift: rnd(-0.06, 0.14),
      a: forceAlpha != null ? forceAlpha : rnd(0.25, 0.55),
    };
  }

  function newFlake(anywhere, sparse) {
    return {
      x: rnd(-0.05, 1.05), y: anywhere ? rnd(-0.1, 1) : rnd(-0.2, -0.01),
      r: rnd(1, 3.1), v: rnd(0.1, 0.35), sw: rnd(0.4, 1.4), p: rnd(0, TAU),
      a: sparse ? rnd(0.35, 0.6) : rnd(0.5, 0.95),
    };
  }

  function newMote(type) {
    return {
      type, x: rnd(0, 1), y: rnd(-0.2, 0.9),
      r: type === 'leaf' ? rnd(3, 5.5) : rnd(2, 3.6),
      v: rnd(0.08, 0.22), sw: rnd(0.6, 1.6), p: rnd(0, TAU),
      rot: rnd(0, TAU), vr: rnd(-1.4, 1.4),
      hue: type === 'leaf' ? rnd(22, 42) : rnd(330, 350),
    };
  }

  /* ---------- main loop ---------- */

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;
    t += dt;
    render(dt);
  }

  function render(dt) {
    if (!ctx) return;
    const kind = scene.kind, night = scene.night;

    ctx.clearRect(0, 0, W, H);
    drawTint();
    if (night && kind !== 'fog') drawStars();
    if (night && kind !== 'fog') drawShooting(dt);
    if (!night && (kind === 'clear' || kind === 'partly')) drawSun(kind === 'partly' ? 0.85 : 1);
    if (night) drawMoon({ clear: 1, partly: 0.85, clouds: 0.55, rain: 0.3, snow: 0.3, thunder: 0.2, fog: 0.12 }[kind] || 0.3);
    drawClouds(dt);
    drawFog(dt);
    drawRain(dt);
    drawSnow(dt);
    drawMotes(dt);
    drawLightning(dt);
  }

  /* ---------- layers ---------- */

  /* Weather tint: darkens/washes the sky gradient so rain, snow, thunder
     and fog read clearly even when a warm season palette is active. */
  function drawTint() {
    const tints = {
      rain: 'rgba(20, 40, 62, 0.42)',
      thunder: 'rgba(30, 22, 52, 0.5)',
      snow: 'rgba(190, 215, 240, 0.18)',
      fog: 'rgba(205, 210, 215, 0.22)',
    };
    const tint = tints[scene.kind];
    if (!tint) return;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars() {
    const base = { clear: 1, partly: 0.8, clouds: 0.4, rain: 0.18, snow: 0.18, thunder: 0.12 }[scene.kind] || 0.3;
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = base * (0.55 + 0.45 * Math.sin(t * s.s + s.p));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShooting(dt) {
    const now = performance.now();
    if (!shooting && now > nextShootAt && (scene.kind === 'clear' || scene.kind === 'partly')) {
      shooting = { x: rnd(0.15, 0.85) * W, y: rnd(0.05, 0.28) * H, vx: rnd(400, 700) * (Math.random() < 0.5 ? -1 : 1), vy: rnd(150, 280), life: 0.9 };
      nextShootAt = now + rnd(5000, 11000);
    }
    if (!shooting) return;
    shooting.x += shooting.vx * dt;
    shooting.y += shooting.vy * dt;
    shooting.life -= dt;
    if (shooting.life <= 0) { shooting = null; return; }
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * shooting.life})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(shooting.x, shooting.y);
    ctx.lineTo(shooting.x - shooting.vx * 0.12, shooting.y - shooting.vy * 0.12);
    ctx.stroke();
  }

  function drawSun(dim) {
    const x = 0.8 * W, y = 0.16 * H, R = Math.min(W, H) * 0.07;
    ctx.globalAlpha = dim;
    const g = ctx.createRadialGradient(x, y, R * 0.4, x, y, R * 4);
    g.addColorStop(0, 'rgba(255,214,112,0.55)');
    g.addColorStop(1, 'rgba(255,214,112,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - R * 4, y - R * 4, R * 8, R * 8);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.03);
    ctx.strokeStyle = 'rgba(255,224,130,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(R * 1.35, 0);
      ctx.lineTo(R * 1.95, 0);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,236,170,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawMoon(alpha) {
    const x = 0.78 * W, y = 0.15 * H, R = Math.min(W, H) * 0.05;
    const g = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 4);
    g.addColorStop(0, `rgba(226,236,255,${0.5 * alpha})`);
    g.addColorStop(1, 'rgba(226,236,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - R * 4, y - R * 4, R * 8, R * 8);

    ctx.fillStyle = `rgba(240,244,255,${0.95 * alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `rgba(178,190,215,${0.35 * alpha})`;
    ctx.beginPath(); ctx.arc(x - R * 0.3, y - R * 0.2, R * 0.22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + R * 0.25, y + R * 0.15, R * 0.16, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + R * 0.05, y - R * 0.42, R * 0.12, 0, TAU); ctx.fill();
  }

  function drawClouds(dt) {
    const kind = scene.kind, night = scene.night;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > 1.18) c.x = -0.18;
      if (c.x < -0.18) c.x = 1.18;
      const cx = c.x * W, cy = c.y * H, s = c.s * 0.09 * H;
      let color;
      if (kind === 'thunder') color = `rgba(62,62,92,${c.a})`;
      else if (night) color = `rgba(185,198,225,${c.a})`;
      else if (kind === 'fog') color = `rgba(255,255,255,${c.a * 0.6})`;
      else color = `rgba(255,255,255,${c.a})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, TAU);
      ctx.arc(cx + s * 0.9, cy + s * 0.15, s * 0.75, 0, TAU);
      ctx.arc(cx - s * 0.9, cy + s * 0.2, s * 0.7, 0, TAU);
      ctx.arc(cx + s * 0.35, cy - s * 0.45, s * 0.65, 0, TAU);
      ctx.arc(cx - s * 0.4, cy - s * 0.3, s * 0.6, 0, TAU);
      ctx.fill();
    }
  }

  function drawFog(dt) {
    for (const b of blobs) {
      b.x += b.v * dt;
      if (b.x > 1.3) b.x = -0.3;
      if (b.x < -0.3) b.x = 1.3;
      const cx = b.x * W, cy = b.y * H, r = b.r * Math.max(W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  function drawRain(dt) {
    if (!drops.length) return;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(200,225,255,0.5)';
    for (const d of drops) {
      d.y += d.v * dt;
      d.x += d.drift * dt;
      if (d.y > 1.05) { d.y = rnd(-0.2, -0.01); d.x = rnd(-0.05, 1.05); }
      if (d.x > 1.1) d.x = -0.1;
      const px = d.x * W, py = d.y * H, len = d.len * H;
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - d.drift * len, py - len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow(dt) {
    ctx.fillStyle = '#ffffff';
    for (const f of flakes) {
      f.y += f.v * dt;
      f.x += Math.sin(t * f.sw + f.p) * dt * 0.03;
      if (f.y > 1.05) { f.y = rnd(-0.15, -0.01); f.x = rnd(-0.05, 1.05); }
      if (f.x > 1.1) f.x = -0.1;
      if (f.x < -0.1) f.x = 1.1;
      ctx.globalAlpha = f.a;
      ctx.beginPath();
      ctx.arc(f.x * W, f.y * H, f.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(dt) {
    for (const m of motes) {
      m.y += m.v * dt;
      m.x += Math.sin(t * m.sw + m.p) * dt * 0.05;
      m.rot += m.vr * dt;
      if (m.y > 1.08) { m.y = rnd(-0.25, -0.02); m.x = rnd(0, 1); }
      ctx.save();
      ctx.translate(m.x * W, m.y * H);
      ctx.rotate(m.rot);
      ctx.fillStyle = m.type === 'leaf'
        ? `hsla(${m.hue},65%,52%,0.8)`
        : `hsla(${m.hue},75%,82%,0.85)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.r, m.r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawLightning(dt) {
    if (scene.kind !== 'thunder') return;
    const now = performance.now();
    if (now > nextFlashAt) {
      flash = 1;
      bolt = makeBolt();
      nextFlashAt = now + rnd(2500, 7000);
    }
    if (flash <= 0) return;
    flash = Math.max(0, flash - dt * 2.2);
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.45})`;
    ctx.fillRect(0, 0, W, H);
    if (bolt && flash > 0.05) {
      ctx.strokeStyle = `rgba(255,255,240,${flash})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bolt[0][0], bolt[0][1]);
      for (const p of bolt) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,240,${flash * 0.35})`;
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    if (flash <= 0) bolt = null;
  }

  function makeBolt() {
    let x = rnd(0.2, 0.8) * W, y = rnd(0, 0.12) * H;
    const pts = [[x, y]];
    while (y < H * 0.55) {
      y += rnd(0.04, 0.1) * H;
      x += rnd(-0.05, 0.05) * W;
      pts.push([x, y]);
    }
    return pts;
  }

  return { mount, setScene };
})();
