// The honeycomb. Nineteen cells in three rings, drawn on a canvas.
//
//   idle       the comb breathes, and now and then a single cell fills
//   listening  your voice ripples outward from the centre cell
//   thinking   the rings lift apart and turn on different axes, like a gyroscope
//   speaking   her voice drives the cells, hot at the centre
//
// Everything is computed in "cell units" (one unit = a cell's corner radius)
// and projected through a small perspective camera, so the gyroscope is real
// 3D rather than a canned animation.

const SQ3 = Math.sqrt(3);
const TAU = Math.PI * 2;
const HONEY = [255, 181, 46];
const ICE = [196, 226, 255];
const WHITE = [255, 246, 222];
const RINGS = 3; // rings 0-2 are the comb, ring 3 is a faint ghost edge
const FRAME_RADIUS = 6.95;
const CAMERA = 17;

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

function buildCells() {
  const cells = [];
  for (let q = -RINGS; q <= RINGS; q++) {
    for (let r = -RINGS; r <= RINGS; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      if (ring > RINGS) continue;
      const x = SQ3 * (q + r / 2);
      const y = 1.5 * r;
      cells.push({ q, r, ring, x, y, angle: Math.atan2(y, x), seed: Math.random() * 100, e: 0, boost: 0 });
    }
  }
  return cells;
}

// A hexagon with a corner pointing up, as the cells of a comb sit.
const CORNERS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i + 30);
  return [Math.cos(a), Math.sin(a)];
});

export class Honeycomb {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cells = buildCells();
    this.state = "idle";
    this.docked = false;
    /** Called every frame for the current loudness, 0 to 1. */
    this.source = () => 0;

    this.time = 0;
    this.gyro = 0; // 0 flat, 1 fully lifted into the gyroscope
    this.tint = 0; // 0 honey, 1 ice
    this.heat = 0;
    this.level = 0;
    this.history = new Float32Array(48);
    this.spin = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    this.frameSpin = { x: 0, y: 0, z: 0 };
    this.nextSpark = 1;
    this.calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    new ResizeObserver(this.resize).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? this.stop() : this.start()));
    this.resize();
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    // The canvas is laid out at full size and only scaled by CSS when docked,
    // so measure the layout box, not the transformed one.
    const css = this.canvas.offsetWidth || box.width || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(160, Math.round(css * dpr));
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    this.size = px;
    this.unit = px * 0.0585;
    this.px = px / 560; // line widths are authored for a 560px canvas
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  set(state) {
    this.state = state;
  }

  tick(now) {
    // The frame timestamp can be a hair earlier than the clock read in start().
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.tick);
  }

  update(dt) {
    const { state } = this;
    this.time += dt;
    const t = this.time;
    const thinking = state === "thinking";
    const voiced = state === "listening" || state === "speaking";

    // Loudness: fast to rise, slower to fall, then pushed down a delay line
    // so each ring reacts a moment after the one inside it.
    const raw = voiced ? clamp01(this.source() || 0) : 0;
    this.level = ease(this.level, raw, raw > this.level ? 40 : 9, dt);
    this.history.copyWithin(1, 0);
    this.history[0] = this.level;

    this.gyro = ease(this.gyro, thinking ? 1 : 0, thinking ? 3.2 : 4.5, dt);
    this.tint = ease(this.tint, state === "listening" ? 0.62 : thinking ? 0.4 : 0, 5, dt);
    this.heat = ease(this.heat, state === "speaking" ? 1 : 0, 5, dt);

    // Each ring has its own axis. Turning is driven only while thinking;
    // afterwards every ring settles onto the nearest flat position.
    const rate = this.calm ? 0.25 : 1;
    const speeds = [
      { x: 0, y: 0, z: 2.6 },
      { x: 2.1, y: 0.35, z: 0.5 },
      { x: 0.3, y: -1.55, z: -0.35 },
      { x: 0, y: 0, z: 0 },
    ];
    for (let k = 0; k < 4; k++) {
      const s = this.spin[k];
      for (const axis of ["x", "y", "z"]) {
        if (thinking) s[axis] += speeds[k][axis] * rate * dt * Math.min(1, this.gyro * 1.6);
        else {
          const step = axis === "z" ? Math.PI / 3 : Math.PI; // the comb looks the same every 60 degrees
          s[axis] = ease(s[axis], Math.round(s[axis] / step) * step, 5.5, dt);
        }
      }
    }
    const f = this.frameSpin;
    f.z += (thinking ? 0.5 : 0.07) * rate * dt;
    if (thinking) {
      f.x += 0.9 * rate * dt * this.gyro;
      f.y += 0.62 * rate * dt * this.gyro;
    } else {
      f.x = ease(f.x, Math.round(f.x / Math.PI) * Math.PI, 5, dt);
      f.y = ease(f.y, Math.round(f.y / Math.PI) * Math.PI, 5, dt);
    }

    // The odd cell fills by itself when nothing else is going on.
    this.nextSpark -= dt;
    if (this.nextSpark <= 0 && !this.calm) {
      const quiet = state === "idle" || (state === "listening" && this.level < 0.08);
      if (quiet) {
        const pool = this.cells.filter((c) => c.ring <= 2);
        pool[(Math.random() * pool.length) | 0].boost = 1;
      }
      this.nextSpark = 0.7 + Math.random() * 1.6;
    }

    for (const c of this.cells) {
      c.boost = Math.max(0, c.boost - dt * 1.5);
      let target;
      if (thinking) {
        // A bright point runs round each ring, in alternating directions.
        const dir = c.ring % 2 ? 1 : -1;
        const head = t * 3.4 * dir + c.ring * 1.3;
        const chase = c.ring === 0 ? 0.5 + 0.5 * Math.sin(t * 5) : Math.pow(Math.max(0, Math.cos(c.angle - head)), 8);
        target = 0.16 + 0.84 * chase;
      } else if (voiced) {
        const delayed = this.history[Math.min(this.history.length - 1, c.ring * 4)];
        const flutter = 0.72 + 0.28 * Math.sin(c.seed * 7 + t * 11);
        target = 0.13 + 0.87 * delayed * flutter * (1 - c.ring * 0.13);
      } else {
        target = 0.12 + 0.07 * Math.sin(t * 1.15 - Math.hypot(c.x, c.y) * 0.85 + c.seed * 0.05);
      }
      target = Math.max(target, c.boost * 0.85);
      if (c.ring === RINGS) target *= 0.5;
      c.e = ease(c.e, clamp01(target), target > c.e ? 22 : 6, dt);
    }
  }

  /** Rotates a flat point by a ring's spin and projects it to the canvas. */
  project(x, y, s) {
    let z = 0;
    // z axis
    let c = Math.cos(s.z);
    let n = Math.sin(s.z);
    [x, y] = [x * c - y * n, x * n + y * c];
    // x axis
    c = Math.cos(s.x);
    n = Math.sin(s.x);
    [y, z] = [y * c - z * n, y * n + z * c];
    // y axis
    c = Math.cos(s.y);
    n = Math.sin(s.y);
    [x, z] = [x * c + z * n, -x * n + z * c];
    const k = CAMERA / (CAMERA - z);
    const half = this.size / 2;
    return [half + x * k * this.unit, half + y * k * this.unit, z];
  }

  hexPath(cx, cy, radius, s) {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [px, py] = this.project(cx + CORNERS[i][0] * radius, cy + CORNERS[i][1] * radius, s);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  draw() {
    const { ctx, size, cells, gyro, px } = this;
    const half = size / 2;
    const bold = this.docked ? 2.3 : 1;
    const edge = mix(HONEY, ICE, this.tint);

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";

    // Glow behind everything, brighter with the comb's overall energy.
    let energy = 0;
    for (const c of cells) if (c.ring <= 2) energy += c.e;
    energy /= 19;
    const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
    glow.addColorStop(0, rgba(HONEY, 0.1 + energy * 0.32));
    glow.addColorStop(0.45, rgba(HONEY, 0.04 + energy * 0.1));
    glow.addColorStop(1, rgba(HONEY, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    this.drawFrame(edge, bold);

    // Far cells first, so near rings pass in front of far ones.
    const spread = [1, 1 + 0.16 * gyro, 1 + 0.3 * gyro, 1];
    const order = cells
      .map((c) => {
        const s = this.spin[c.ring];
        const cx = c.x * spread[c.ring];
        const cy = c.y * spread[c.ring];
        return { c, s, cx, cy, z: this.project(cx, cy, s)[2] };
      })
      .sort((a, b) => a.z - b.z);

    const cellRadius = 0.9 - 0.1 * gyro;
    const named = 1 - gyro; // how much of the wordmark is showing

    for (const { c, s, cx, cy, z } of order) {
      const ghost = c.ring === RINGS;
      const depth = 0.72 + 0.28 * clamp01((z + 5) / 10);
      const e = c.e;

      if (ghost) {
        const alpha = (0.07 + e * 0.5) * (1 - gyro) * depth;
        if (alpha < 0.01) continue;
        this.hexPath(cx, cy, cellRadius, s);
        ctx.strokeStyle = rgba(edge, alpha);
        ctx.lineWidth = 1 * px * bold;
        ctx.stroke();
        continue;
      }

      // The centre row sits behind her name, so it stays dark enough to read over.
      const behindName = c.r === 0 ? 1 - 0.62 * named : 1;

      this.hexPath(cx, cy, cellRadius, s);
      ctx.fillStyle = rgba(mix(HONEY, WHITE, this.heat * e * 0.35), (0.05 + 0.5 * Math.pow(e, 1.35)) * depth * behindName);
      ctx.fill();
      ctx.strokeStyle = rgba(edge, (0.08 + 0.26 * e) * depth);
      ctx.lineWidth = 6 * px * bold;
      ctx.stroke();
      ctx.strokeStyle = rgba(mix(edge, WHITE, e * 0.75), (0.5 + 0.5 * e) * depth);
      ctx.lineWidth = 1.5 * px * bold;
      ctx.stroke();

      if (e > 0.34 && behindName > 0.9) {
        this.hexPath(cx, cy, cellRadius * (0.26 + 0.3 * e), s);
        ctx.fillStyle = rgba(WHITE, (e - 0.34) * 1.05 * depth);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = "source-over";
  }

  /** The outer bezel: a hexagon with tick marks, turning slowly. */
  drawFrame(edge, bold) {
    const { ctx, px } = this;
    const s = this.frameSpin;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.7);
    const outer = [];
    for (let i = 0; i < 6; i++) {
      const a = (TAU / 6) * i;
      outer.push([Math.cos(a) * FRAME_RADIUS, Math.sin(a) * FRAME_RADIUS]);
    }

    ctx.beginPath();
    outer.forEach(([x, y], i) => {
      const [u, v] = this.project(x, y, s);
      if (i === 0) ctx.moveTo(u, v);
      else ctx.lineTo(u, v);
    });
    ctx.closePath();
    ctx.strokeStyle = rgba(edge, 0.1 + 0.05 * pulse);
    ctx.lineWidth = 5 * px * bold;
    ctx.stroke();
    ctx.strokeStyle = rgba(mix(edge, ICE, 0.5), 0.55);
    ctx.lineWidth = 1.2 * px * bold;
    ctx.stroke();

    if (this.docked) return;

    // Ticks along each side, longer at the middle.
    ctx.strokeStyle = rgba(ICE, 0.5);
    ctx.lineWidth = 1 * px;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = outer[i];
      const [bx, by] = outer[(i + 1) % 6];
      for (let j = 1; j < 12; j++) {
        const f = j / 12;
        const x = ax + (bx - ax) * f;
        const y = ay + (by - ay) * f;
        const inward = j === 6 ? 0.93 : j % 3 === 0 ? 0.955 : 0.975;
        const [u1, v1] = this.project(x, y, s);
        const [u2, v2] = this.project(x * inward, y * inward, s);
        ctx.moveTo(u1, v1);
        ctx.lineTo(u2, v2);
      }
    }
    ctx.stroke();

    // A marker at each corner, and three that travel round the bezel.
    ctx.fillStyle = rgba(ICE, 0.85);
    for (const [x, y] of outer) {
      const [u, v] = this.project(x * 1.035, y * 1.035, s);
      ctx.beginPath();
      ctx.arc(u, v, 2.1 * px, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba(HONEY, 0.95);
    for (let i = 0; i < 3; i++) {
      const along = ((this.time * 0.11 + i / 3) % 1) * 6;
      const side = Math.min(5, Math.floor(along));
      const f = along - side;
      const [ax, ay] = outer[side];
      const [bx, by] = outer[(side + 1) % 6];
      const [u, v] = this.project((ax + (bx - ax) * f) * 0.905, (ay + (by - ay) * f) * 0.905, s);
      ctx.beginPath();
      ctx.arc(u, v, 2.6 * px, 0, TAU);
      ctx.fill();
    }
  }
}
