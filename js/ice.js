/* ════════════════════════════════════════════════════════════════
   ice.js · raymarched ice-crystal hero scene
   Raw WebGL 1. No dependencies. Degrades to CSS if unsupported.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const FRAG = (STEPS, INNER) => `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;      // -1 .. 1, smoothed
uniform float uScroll;     // 0 .. 1 through the hero
uniform float uIntro;      // 0 .. 1 reveal
uniform vec2  uCenter;     // subject offset in uv space
uniform float uDist;       // camera orbit radius
uniform mat3  uRot;        // main crystal orientation
uniform mat3  uRotB;       // shard orientation
uniform vec3  uShardA;
uniform vec3  uShardB;

#define STEPS ${STEPS}
#define INNER ${INNER}
#define BOUND 2.35
#define SURF  0.0018

const float PI = 3.14159265359;

/* ── hashes & noise ─────────────────────────────────────────── */
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x),
        mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
        mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

/* ── SDFs ───────────────────────────────────────────────────── */
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float sdOcta(vec3 p, float s) {
  p = abs(p);
  return (p.x + p.y + p.z - s) * 0.57735027;
}

float sdHexPrism(vec3 p, vec2 h) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  p = abs(p);
  p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
  vec2 d = vec2(
    length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
    p.z - h.y);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/* Quartz-like point: hexagonal prism capped by an elongated octahedron */
float mapCrystal(vec3 p) {
  vec3 q = uRot * p;
  // hexagonal column, its ends sheared into points by an elongated octahedron
  float prism = sdHexPrism(q.xzy, vec2(0.40, 0.95));
  vec3 o = q; o.y *= 0.78;
  float octa = sdOcta(o, 0.68);
  return smax(prism, octa, 0.05);
}

float mapShard(vec3 p, vec3 c, float s) {
  vec3 q = uRotB * (p - c);
  float d = sdOcta(q, s);
  return smax(d, length(q) - s * 0.74, s * 0.3);
}

float map(vec3 p) {
  float d = mapCrystal(p);
  d = min(d, mapShard(p, uShardA, 0.20));
  d = min(d, mapShard(p, uShardB, 0.13));
  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0016, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

vec2 sphHit(vec3 ro, vec3 rd, float ra) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - ra * ra;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

/* ── environment ────────────────────────────────────────────── */
const vec3 KEY  = vec3(0.5199, 0.6812, -0.5152);   // normalized( 0.55, 0.72,-0.545)
const vec3 RIM  = vec3(-0.7327, -0.1758, 0.6570);  // normalized(-0.75,-0.18, 0.672)

/* Studio the crystal reflects and refracts — bright, so the gem has
   something to gather. Never drawn directly. */
vec3 envLight(vec3 rd) {
  float y = rd.y * 0.5 + 0.5;
  vec3 c = mix(vec3(0.020, 0.055, 0.135), vec3(0.30, 0.56, 1.00), pow(y, 1.55));

  // overhead soft box
  c += vec3(1.45, 1.60, 1.80) * smoothstep(0.52, 0.96, rd.y) * 1.15;
  // horizon strip light
  c += vec3(0.50, 0.82, 1.35) * pow(max(1.0 - abs(rd.y - 0.04) * 5.5, 0.0), 3.0) * 0.75;
  // hard key
  c += vec3(2.30, 2.38, 2.50) * pow(max(dot(rd, KEY), 0.0), 44.0) * 3.4;
  // cold rim
  c += vec3(0.26, 0.72, 2.10) * pow(max(dot(rd, RIM), 0.0), 9.0) * 1.5;
  // floor bounce
  c += vec3(0.05, 0.11, 0.28) * smoothstep(0.18, -0.95, rd.y);
  return c;
}

vec3 env(vec3 rd) {
  float y = rd.y * 0.5 + 0.5;
  // matched to --ink-000 after tone mapping so the hero does not read as a
  // darker patch than the rest of the page
  vec3 col = mix(vec3(0.034, 0.046, 0.082), vec3(0.055, 0.115, 0.215), pow(y, 1.3));

  // horizon haze
  col += vec3(0.016, 0.040, 0.084) * pow(1.0 - abs(rd.y), 9.0);

  // key highlight
  col += vec3(0.92, 0.97, 1.0) * pow(max(dot(rd, KEY), 0.0), 30.0) * 2.6;
  // wide cold fill
  col += vec3(0.16, 0.42, 1.00) * pow(max(dot(rd, RIM), 0.0), 8.0) * 0.34;

  // aurora drift
  float au = fbm(vec3(rd.xz * 2.2, uTime * 0.045));
  col += vec3(0.05, 0.16, 0.30) * smoothstep(0.55, 0.94, au) * (0.16 + 0.20 * y);

  // dust — round points on a fine lattice
  vec3 sd = rd * 250.0;
  vec3 sc = fract(sd) - 0.5;
  float st = smoothstep(0.9968, 1.0, hash31(floor(sd)))
           * smoothstep(0.46, 0.06, length(sc));
  col += vec3(0.75, 0.88, 1.0) * st * 1.15;

  return col;
}

/* ── shading ────────────────────────────────────────────────── */
vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);

  // frosted micro-relief
  float frost = fbm(p * 5.0 + vec3(0.0, uTime * 0.04, 0.0));
  n = normalize(n + (frost - 0.5) * 0.035);

  float ndv = max(dot(n, -rd), 0.0);
  float fres = mix(0.045, 1.0, pow(1.0 - ndv, 4.2));

  // ── refraction: march to the far wall from the inside
  vec3 rdIn = refract(rd, n, 1.0 / 1.31);
  vec3 pIn = p - n * 0.006;
  float ti = 0.0;
  for (int i = 0; i < INNER; i++) {
    float d = -map(pIn + rdIn * ti);
    if (d < 0.0016) break;
    ti += max(d, 0.012);
    if (ti > 5.0) break;
  }
  vec3 pOut = pIn + rdIn * ti;
  vec3 nOut = -calcNormal(pOut);
  vec3 rdOut = refract(rdIn, nOut, 1.31);
  if (dot(rdOut, rdOut) < 0.0001) rdOut = reflect(rdIn, nOut);

  // chromatic dispersion
  float disp = 0.022;
  vec3 refr;
  refr.r = envLight(normalize(rdOut + nOut * disp)).r;
  refr.g = envLight(rdOut).g;
  refr.b = envLight(normalize(rdOut - nOut * disp)).b;

  // Beer–Lambert absorption tints the interior glacier-blue
  refr *= exp(-ti * vec3(0.50, 0.19, 0.085) * 0.72);

  // internal frost veins
  float vein = fbm(pOut * 2.6 + 2.7);
  float crack = smoothstep(0.470, 0.500, vein) - smoothstep(0.500, 0.530, vein);
  refr += vec3(0.45, 0.75, 1.0) * crack * 0.26;

  vec3 refl = envLight(reflect(rd, n));

  // cold core burning deep inside the body
  refr += vec3(0.30, 0.66, 1.25) * exp(-length(pOut) * 1.7) * 0.55;

  vec3 col = mix(refr, refl, fres);

  // hard specular glints
  vec3 h1 = normalize(KEY - rd);
  col += vec3(1.0, 0.985, 0.96) * pow(max(dot(n, h1), 0.0), 240.0) * 3.0;
  vec3 h2 = normalize(RIM - rd);
  col += vec3(0.42, 0.70, 1.0) * pow(max(dot(n, h2), 0.0), 60.0) * 0.55;

  // sparkle: tiny facets catching the key light
  float sp = pow(vnoise(p * 15.0), 22.0);
  col += vec3(0.88, 0.95, 1.0) * sp * 2.6 * max(dot(n, KEY), 0.0);

  // fresnel rim glow, plus a thin bright edge so the silhouette reads
  col += vec3(0.34, 0.70, 1.0) * pow(fres, 1.5) * 0.52;
  col += vec3(0.80, 0.92, 1.0) * pow(fres, 7.0) * 0.95;

  return col;
}

/* ── main ───────────────────────────────────────────────────── */
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  uv -= uCenter;

  float scale = mix(0.55, 1.0, uIntro);

  // camera
  float orbit = uTime * 0.045 + uMouse.x * 0.30;
  vec3 ro = vec3(sin(orbit) * uDist, 0.30 + uMouse.y * 0.5 + uScroll * 0.75, cos(orbit) * uDist);
  ro *= mix(1.35, 1.0, uIntro);
  vec3 ta = vec3(0.0, uScroll * 0.28, 0.0);

  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.55 * fw);

  vec3 col = env(rd);

  // volumetric halo around the subject
  float b = max(dot(rd, -ro), 0.0);
  float dc = length(ro + rd * b);
  col += vec3(0.15, 0.40, 0.95) * exp(-dc * dc * 2.10) * 0.44 * uIntro;
  col += vec3(0.55, 0.80, 1.00) * exp(-dc * dc * 6.5) * 0.20 * uIntro;

  // ── trace the crystal
  vec3 roS = ro / scale;
  vec2 bs = sphHit(roS, rd, BOUND);
  if (bs.y > 0.0) {
    float t = max(bs.x, 0.0);
    float hit = -1.0;
    for (int i = 0; i < STEPS; i++) {
      vec3 p = roS + rd * t;
      float d = map(p);
      if (d < SURF * (1.0 + t * 0.35)) { hit = t; break; }
      t += d * 0.86;
      if (t > bs.y) break;
    }
    if (hit > 0.0) {
      vec3 cc = shade(roS, rd, hit);
      col = mix(col, cc, uIntro);
    }
  }

  // fade the whole scene as the hero scrolls away
  col *= 1.0 - smoothstep(0.15, 0.95, uScroll) * 0.9;

  // tone map only — the palette below is authored in display space, so a
  // gamma lift here would wash every black in the scene out to slate grey
  col = col / (1.0 + col);
  col = max(col, 0.0);

  // corner falloff
  col *= 1.0 - 0.30 * pow(length(uv + uCenter) * 0.72, 2.4);

  // dither to kill banding
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

  /* ── mat3 helpers (column-major) ───────────────────────────── */
  function m3mul(a, b) {
    const o = new Float32Array(9);
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += a[k * 3 + r] * b[c * 3 + k];
        o[c * 3 + r] = s;
      }
    return o;
  }
  const rX = a => { const s = Math.sin(a), c = Math.cos(a); return new Float32Array([1, 0, 0, 0, c, s, 0, -s, c]); };
  const rY = a => { const s = Math.sin(a), c = Math.cos(a); return new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]); };
  const rZ = a => { const s = Math.sin(a), c = Math.cos(a); return new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]); };

  /* ── scene ─────────────────────────────────────────────────── */
  function mount(canvas, opts) {
    opts = opts || {};
    let gl;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, powerPreference: 'high-performance',
        preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false
      }) || canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return null;

    const coarse = matchMedia('(pointer: coarse)').matches;
    const narrow = innerWidth < 760;

    // quality tiers: [renderScale, dprCap, steps, innerSteps]
    const TIERS = [
      [1.00, 1.5, 78, 26],
      [0.85, 1.25, 64, 20],
      [0.68, 1.0, 52, 14],
      [0.52, 1.0, 40, 10]
    ];
    let tier = coarse || narrow ? 1 : 1;

    let prog = null, uni = {}, buf = null;

    function compile(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[ice] shader:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    function build() {
      const vs = compile(VERT, gl.VERTEX_SHADER);
      const fs = compile(FRAG(TIERS[tier][2], TIERS[tier][3]), gl.FRAGMENT_SHADER);
      if (!vs || !fs) return false;
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn('[ice] link:', gl.getProgramInfoLog(p));
        return false;
      }
      if (prog) gl.deleteProgram(prog);
      prog = p;
      gl.useProgram(prog);
      ['uRes', 'uTime', 'uMouse', 'uScroll', 'uIntro', 'uCenter', 'uDist', 'uRot', 'uRotB', 'uShardA', 'uShardB']
        .forEach(n => { uni[n] = gl.getUniformLocation(prog, n); });
      return true;
    }

    if (!build()) return null;

    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* state */
    const state = {
      mx: 0, my: 0, tmx: 0, tmy: 0,
      scroll: 0, tscroll: 0,
      intro: 0,
      running: false, visible: true, lost: false,
      w: 0, h: 0
    };

    let needResize = true;
    addEventListener('resize', () => { needResize = true; }, { passive: true });

    function resize() {
      if (!needResize) return;
      needResize = false;
      const [rs, dprCap] = TIERS[tier];
      const dpr = Math.min(devicePixelRatio || 1, dprCap);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr * rs));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr * rs));
      if (w === state.w && h === state.h) return;
      state.w = canvas.width = w;
      state.h = canvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    /* adaptive quality */
    let frames = 0, acc = 0, checked = 0;
    function sample(dt) {
      acc += dt; frames++;
      if (frames < 45) return;
      const avg = acc / frames;
      frames = 0; acc = 0;
      if (avg > 26 && tier < TIERS.length - 1 && checked < 3) {
        tier++; checked++; build(); state.w = state.h = 0; needResize = true; resize();
      }
    }

    const start = performance.now();
    let last = start;

    function frame(now) {
      if (!state.running || state.lost) return;
      requestAnimationFrame(frame);
      const dt = Math.min(now - last, 50);
      last = now;
      if (!state.visible) return;

      sample(dt);
      resize();

      const t = (now - start) / 1000;
      const k = 1 - Math.pow(0.001, dt / 1000);
      state.mx += (state.tmx - state.mx) * k * 0.9;
      state.my += (state.tmy - state.my) * k * 0.9;
      state.scroll += (state.tscroll - state.scroll) * k;
      state.intro = Math.min(1, state.intro + dt / 1400);
      const intro = 1 - Math.pow(1 - state.intro, 3);

      const rot = m3mul(m3mul(rY(t * 0.22 + state.mx * 0.35), rX(-0.28 + state.my * 0.28)), rZ(Math.sin(t * 0.17) * 0.14));
      const rotB = m3mul(rY(-t * 0.5), rX(t * 0.36));

      gl.useProgram(prog);
      gl.uniform2f(uni.uRes, state.w, state.h);
      gl.uniform1f(uni.uTime, t);
      gl.uniform2f(uni.uMouse, state.mx, state.my);
      gl.uniform1f(uni.uScroll, state.scroll);
      gl.uniform1f(uni.uIntro, intro);
      gl.uniform2f(uni.uCenter, opts.center ? opts.center()[0] : 0, opts.center ? opts.center()[1] : 0);
      gl.uniform1f(uni.uDist, opts.dist ? opts.dist() : 3.30);
      gl.uniformMatrix3fv(uni.uRot, false, rot);
      gl.uniformMatrix3fv(uni.uRotB, false, rotB);
      gl.uniform3f(uni.uShardA, Math.sin(t * 0.42) * 1.75, 0.95 + Math.sin(t * 0.63) * 0.28, Math.cos(t * 0.42) * 1.75);
      gl.uniform3f(uni.uShardB, Math.cos(t * 0.33 + 2.1) * 1.55, -1.02 + Math.cos(t * 0.5) * 0.2, Math.sin(t * 0.33 + 2.1) * 1.55);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); state.lost = true; state.running = false; });
    canvas.addEventListener('webglcontextrestored', () => {
      state.lost = false;
      if (build()) { state.w = state.h = 0; needResize = true; api.start(); }
    });

    const api = {
      gl,
      start() { if (state.running) return; state.running = true; last = performance.now(); requestAnimationFrame(frame); },
      stop() { state.running = false; },
      setVisible(v) { state.visible = v; },
      pointer(x, y) { state.tmx = x; state.tmy = y; },
      setScroll(v) { state.tscroll = v; },
      renderOnce() {
        needResize = true;
        resize();
        state.intro = 1;
        state.running = true;
        frame(performance.now());
        state.running = false;
      }
    };
    return api;
  }

  window.IceScene = { mount };
})();
