/*
 * The victory fireworks: rockets climb from the bottom of the table and burst into sparks that
 * fall and fade. Trails come from fading the canvas a little each frame rather than clearing it.
 */

const COLORS = ['#ff4fa3', '#ffd34d', '#7cf5ff', '#9dff7a', '#ff7a59', '#c89bff', '#ffffff'];

/** Runs fireworks on `canvas` for `duration` ms, then calls onDone. Returns a stop function. */
export function runFireworks(canvas, { duration = 7000, onDone, rng = Math.random } = {}) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) {
    onDone?.();
    return () => {};
  }

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.scale(dpr, dpr);

  const unit = Math.max(0.6, Math.min(1.6, Math.min(width, height) / 500));
  const rockets = [];
  const sparks = [];
  let raf = 0;
  let stopped = false;
  let nextLaunch = 0;
  const start = performance.now();

  const launch = () => {
    rockets.push({
      x: width * (0.15 + rng() * 0.7),
      y: height,
      vx: (rng() - 0.5) * 1.5 * unit,
      vy: -(7 + rng() * 4) * unit * Math.sqrt(height / 600),
      color: COLORS[Math.floor(rng() * COLORS.length)],
    });
  };

  const burst = (r) => {
    const count = 50 + Math.floor(rng() * 30);
    const second = COLORS[Math.floor(rng() * COLORS.length)];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.2;
      const speed = (1.5 + rng() * 3.5) * unit;
      sparks.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + rng() * 0.012,
        color: i % 3 === 0 ? second : r.color,
      });
    }
  };

  const frame = (now) => {
    if (stopped) return;
    const t = now - start;
    if (t < duration && now >= nextLaunch) {
      launch();
      if (rng() < 0.35) launch();
      nextLaunch = now + 350 + rng() * 450;
    }

    // Fade what's there instead of clearing, so everything leaves a trail.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const r = rockets[i];
      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.12 * unit;
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x - 1.5, r.y - 1.5, 3, 3);
      if (r.vy >= -0.5) {
        burst(r);
        rockets.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.985;
      s.vy = s.vy * 0.985 + 0.05 * unit;
      s.life -= s.decay;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (t >= duration && !rockets.length && !sparks.length) {
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame((now) => {
    nextLaunch = now;
    frame(now);
  });

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, width, height);
  };
}
