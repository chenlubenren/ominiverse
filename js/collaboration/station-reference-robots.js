/* Models and articulated mechanisms adapted from the user-supplied 太空站机器人.html.
 * Only robot geometry and articulation are retained; the station owns navigation,
 * rendering, lighting, and task timing. No second renderer or demo scene is created.
 */
(() => {
  'use strict';
  const C = window.CoScene,
    T = THREE;
  const Fi = T.MeshPhysicalMaterial,
    ln = T.MeshStandardMaterial,
    We = T.MeshBasicMaterial,
    Rt = T.Color,
    Pn = T.CanvasTexture,
    Ne = T.Group,
    Ue = T.BufferAttribute,
    an = T.Euler,
    Ee = T.Quaternion,
    F = T.Vector3,
    Wt = T.Matrix4,
    oe = T.Mesh,
    pi = class extends T.LatheGeometry {
      constructor(points, segments = 48, ...rest) {
        super(points, Math.min(segments, 28), ...rest);
      }
    },
    pt = T.Vector2,
    ie = class extends T.SphereGeometry {
      constructor(radius, width = 32, height = 16, ...rest) {
        super(radius, Math.min(width, 24), Math.min(height, 12), ...rest);
      }
    },
    Vt = class extends T.CylinderGeometry {
      constructor(top, bottom, height, radial = 24, levels = 1, ...rest) {
        super(top, bottom, height, Math.min(radial, 20), levels, ...rest);
      }
    },
    jt = class extends T.TorusGeometry {
      constructor(radius, tube, radial = 8, tubular = 48, ...rest) {
        super(radius, tube, Math.min(radial, 6), Math.min(tubular, 24), ...rest);
      }
    },
    Me = T.BoxGeometry,
    we = T.Object3D,
    ls = T.Shape,
    Ks = T.ExtrudeGeometry,
    di = T.InstancedMesh,
    os = T.CircleGeometry,
    us = T.SpotLight,
    ze = T.ShaderMaterial,
    as = T.ConeGeometry,
    ds = T.PointLight,
    Zs = T.CatmullRomCurve3,
    to = T.TubeGeometry,
    Re = T.BufferGeometry;
  const Ze = T.sRGBEncoding,
    hi = T.RepeatWrapping,
    Kn = T.DynamicDrawUsage,
    _i = T.AdditiveBlending,
    xn = T.DoubleSide;
  // Keep the exhibit's shapes while reducing tessellation for a whole active cabin.
  const Ft = (w, h, d, r) => {
    r = Math.min(r || Math.min(w, h, d) * 0.14, w / 2, h / 2, d / 2);
    const g = new T.BoxGeometry(w, h, d, 2, 2, 2),
      a = g.attributes.position,
      inner = new T.Vector3(w / 2 - r, h / 2 - r, d / 2 - r),
      low = inner.clone().negate(),
      p = new T.Vector3(),
      q = new T.Vector3();
    for (let i = 0; i < a.count; i++) {
      p.fromBufferAttribute(a, i);
      q.copy(p).clamp(low, inner);
      p.sub(q).normalize().multiplyScalar(r).add(q);
      a.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  };
  // Merge only mesh attributes, preserving the source's material batches.
  function wo(parts) {
    const arrays = parts.map((g) => (g.index ? g.toNonIndexed() : g)),
      out = new T.BufferGeometry();
    const names = ['position', 'normal', 'uv'].filter((name) => arrays.every((g) => g.attributes[name]));
    for (const name of names) {
      const size = arrays[0].attributes[name].itemSize,
        data = new Float32Array(arrays.reduce((n, g) => n + g.attributes[name].array.length, 0));
      let at = 0;
      for (const g of arrays) {
        data.set(g.attributes[name].array, at);
        at += g.attributes[name].array.length;
      }
      out.setAttribute(name, new T.BufferAttribute(data, size));
    }
    if (!out.attributes.normal) out.computeVertexNormals();
    return out;
  }
  // The reference's studio, dust, and free-flight trails are presentation effects.
  function ei() {
    return { scene: new T.Group(), sky: null, follow() {} };
  }
  const Vl = () => null;
  class hr {
    constructor() {
      this.points = new T.Group();
    }
    emit() {}
    update() {}
  }
  var Kt = Math.PI * 2;
  var He = (i, t, e) => Math.min(e, Math.max(t, i));
  var ye = (i, t, e) => i + (t - i) * e;
  var le = (i) => ((i = He(i, 0, 1)), i * i * (3 - 2 * i));
  var Xe = (i, t, e, n) => ye(i, t, 1 - Math.exp(-e * n));
  var nt = (i = 0, t = 0, e = 0) => new F(i, t, e);
  function Lh(i = 1) {
    let t = i >>> 0;
    return () => {
      t = (t + 1831565813) >>> 0;
      let e = t;
      return (
        (e = Math.imul(e ^ (e >>> 15), e | 1)),
        (e ^= e + Math.imul(e ^ (e >>> 7), e | 61)),
        ((e ^ (e >>> 14)) >>> 0) / 4294967296
      );
    };
  }
  function Sf(i, t, e) {
    e = He(e, Math.abs(i - t) + 0.001, i + t - 0.001);
    let n = Math.acos(He((i * i + e * e - t * t) / (2 * i * e), -1, 1)),
      s = Math.acos(He((i * i + t * t - e * e) / (2 * i * t), -1, 1));
    return [n, s];
  }
  var vf = new Ee();
  function bf(i, t) {
    (i.parent.getWorldQuaternion(vf), i.quaternion.copy(vf.invert().multiply(t)));
  }
  function Wl(i, t, e, n = 1, { soft: s = 1.6 } = {}) {
    let r = new Vt(t, t * 0.04, i, 40, 16, !0);
    r.translate(0, i / 2, 0);
    let o = new ze({
        uniforms: {
          uColor: { value: new Rt(e).multiplyScalar(n) },
          uLen: { value: i },
          uSoft: { value: s },
          uK: { value: 1 },
        },
        vertexShader: `
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){
        vY = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: `
      uniform vec3 uColor; uniform float uLen, uSoft, uK;
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){
        float along = clamp(vY / uLen, 0.0, 1.0);
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), uSoft);
        float a = pow(1.0 - along, 1.6) * edge * smoothstep(0.0, 0.04, along) * uK;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
        transparent: !0,
        depthWrite: !1,
        blending: _i,
        side: xn,
        fog: !1,
      }),
      a = new oe(r, o);
    return ((a.renderOrder = 10), (a.frustumCulled = !1), a);
  }
  function Es(i, t, e = 0.06, n = 2) {
    let s = new ls();
    i.forEach(([a, l], c) => (c ? s.lineTo(a, l) : s.moveTo(a, l)));
    let r = Math.max(t - 2 * e, 0.001),
      o = new Ks(s, {
        depth: r,
        bevelEnabled: e > 0,
        bevelThickness: e,
        bevelSize: e,
        bevelSegments: n,
        steps: 1,
        curveSegments: 6,
      });
    return (o.translate(0, 0, -r / 2), o.rotateY(-Math.PI / 2), o);
  }
  function Ro(i, t, e = 0.05, n = 2) {
    let s = new ls();
    i.forEach(([a, l], c) => (c ? s.lineTo(a, l) : s.moveTo(a, l)));
    let r = Math.max(t - 2 * e, 0.001),
      o = new Ks(s, {
        depth: r,
        bevelEnabled: e > 0,
        bevelThickness: e,
        bevelSize: e,
        bevelSegments: n,
        steps: 1,
        curveSegments: 8,
      });
    return (o.translate(0, 0, -r / 2), o);
  }
  var wt = (i, t = 48) => {
    let n =
      !(i.length > 2 && i[0][0] === i[i.length - 1][0] && i[0][1] === i[i.length - 1][1]) &&
      i[0][1] > i[i.length - 1][1]
        ? [...i].reverse()
        : i;
    return new pi(
      n.map(([s, r]) => new pt(s, r)),
      t,
    );
  };
  function cn(i, t, e = i * 0.06, n = e * 0.9, s = 0, r = 6) {
    let o = [];
    for (let a = 0; a < t; a++) {
      let l = (a / t) * Math.PI * 2;
      o.push(new Vt(e, e, n, r).translate(Math.cos(l) * i, s, Math.sin(l) * i));
    }
    return wo(o);
  }
  function qi(i, t, e, n = 0.05, s = 0.45) {
    let r = [],
      o = t / e;
    for (let a = 0; a < e; a++) r.push(new Me(i, o * (1 - s), n).translate(0, -t / 2 + o * (a + 0.5), 0));
    return wo(r);
  }
  var wf = new Wt();
  var Af = new Ee();
  var Rf = new an();
  var Uy = new F();
  var dr = new F();
  var Xt = class {
    constructor(t) {
      ((this.parent = t), (this.groups = new Map()));
    }
    add(t, e, { x: n = 0, y: s = 0, z: r = 0, rx: o = 0, ry: a = 0, rz: l = 0, s: c = 1, order: h = 'XYZ' } = {}) {
      let u = t.index ? t.toNonIndexed() : t.clone();
      for (let f of Object.keys(u.attributes)) ['position', 'normal', 'uv'].includes(f) || u.deleteAttribute(f);
      return (
        u.attributes.uv || u.setAttribute('uv', new Ue(new Float32Array(u.attributes.position.count * 2), 2)),
        u.attributes.normal || u.computeVertexNormals(),
        Rf.set(o, a, l, h),
        Af.setFromEuler(Rf),
        typeof c == 'number' ? dr.set(c, c, c) : dr.set(...c),
        wf.compose(Uy.set(n, s, r), Af, dr),
        u.applyMatrix4(wf),
        dr.x * dr.y * dr.z < 0 && Fy(u),
        this.groups.has(e) || this.groups.set(e, []),
        this.groups.get(e).push(u),
        this
      );
    }
    pair(t, e, n = {}) {
      this.add(t, e, n);
      let s = typeof n.s == 'number' || n.s === void 0 ? [n.s ?? 1, n.s ?? 1, n.s ?? 1] : n.s;
      return (
        this.add(t, e, {
          ...n,
          x: -(n.x || 0),
          ry: -(n.ry || 0),
          rz: -(n.rz || 0),
          s: [-s[0], s[1], s[2]],
        }),
        this
      );
    }
    geos() {
      let t = new Map();
      for (let [e, n] of this.groups) t.set(e, wo(n));
      return (this.groups.clear(), t);
    }
    done() {
      let t = [];
      for (let [e, n] of this.groups) {
        let s = new oe(wo(n), e),
          r = !e.isMeshBasicMaterial;
        ((s.castShadow = r), (s.receiveShadow = r), this.parent.add(s), t.push(s));
      }
      return (this.groups.clear(), t);
    }
  };
  function Fy(i) {
    let t = i.attributes.position,
      e = i.attributes.normal,
      n = i.attributes.uv;
    for (let s = 0; s < t.count; s += 3)
      for (let r of [t, e, n]) {
        let o = r.itemSize;
        for (let a = 0; a < o; a++) {
          let l = r.array[(s + 1) * o + a];
          ((r.array[(s + 1) * o + a] = r.array[(s + 2) * o + a]), (r.array[(s + 2) * o + a] = l));
        }
      }
  }
  function If(i, t = {}) {
    let e = (s, r = {}) =>
        new Fi({
          color: s,
          roughness: 0.34,
          metalness: 0,
          clearcoat: 0.55,
          clearcoatRoughness: 0.28,
          ...r,
        }),
      n = (s, r = {}) => new ln({ color: s, roughness: 0.5, metalness: 0.5, ...r });
    return {
      shell: e(t.shell || '#efeee9'),
      shell2: e(t.shell2 || '#d8d6d0', { roughness: 0.45 }),
      accent: e(i, { roughness: 0.38, clearcoat: 0.35 }),
      dark: n('#1c1d20', { roughness: 0.55, metalness: 0.45 }),
      frame: n('#2c2e33', { roughness: 0.38, metalness: 0.85 }),
      chrome: n('#c8ccd2', { roughness: 0.16, metalness: 1 }),
      rubber: n('#151516', { roughness: 0.88, metalness: 0 }),
      decal: n('#17181a', { roughness: 0.6, metalness: 0.1 }),
      glass: e('#07080a', {
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
      }),
      glow: new We({ color: new Rt(i).multiplyScalar(t.glowK ?? 3) }),
    };
  }
  var Cf = new Wt();
  var Pf = new Wt();
  var Mn = class {
    constructor(t, e, n) {
      this.meshes = [];
      for (let [s, r] of e) {
        let o = new di(r, s, n);
        o.instanceMatrix.setUsage(Kn);
        let a = !s.isMeshBasicMaterial;
        ((o.castShadow = a), (o.receiveShadow = a), (o.frustumCulled = !1), t.add(o), this.meshes.push(o));
      }
      this.count = n;
    }
    set(t, e, n = 1) {
      (Pf.makeScale(n, n, n), Cf.multiplyMatrices(e.matrixWorld, Pf));
      for (let s of this.meshes) s.setMatrixAt(t, Cf);
    }
    commit() {
      for (let t of this.meshes) t.instanceMatrix.needsUpdate = !0;
    }
  };
  function Nf(i, t, e = !1) {
    let n = document.createElement('canvas');
    ((n.width = n.height = i), t(n.getContext('2d'), i));
    let s = new Pn(n);
    return (e && (s.colorSpace = Ze), (s.wrapS = s.wrapT = hi), (s.anisotropy = 8), s);
  }
  var Yl;
  function Df() {
    return (
      Yl ||
      ((Yl = Nf(512, (i, t) => {
        let e = Lh(17);
        ((i.fillStyle = '#808080'), i.fillRect(0, 0, t, t));
        for (let n = 0; n < 1400; n++) {
          let s = e() * t,
            r = e() * t,
            o = 6 + e() * 34,
            a = e() * Math.PI,
            l = Math.floor(90 + e() * 90);
          ((i.fillStyle = `rgba(${l},${l},${l},0.45)`), i.beginPath());
          for (let c = 0; c < 4; c++) {
            let h = a + c * 1.6 + e() * 0.6,
              u = o * (0.5 + e() * 0.6);
            i.lineTo(s + Math.cos(h) * u, r + Math.sin(h) * u);
          }
          i.fill();
        }
        ((i.strokeStyle = 'rgba(40,40,40,0.35)'), (i.lineWidth = 1));
        for (let n = 0; n < 260; n++) {
          i.beginPath();
          let s = e() * t,
            r = e() * t;
          (i.moveTo(s, r), i.lineTo(s + (e() - 0.5) * 60, r + (e() - 0.5) * 60), i.stroke());
        }
      })),
      Yl)
    );
  }
  var Uh = new Map();
  function By() {
    if (Uh.has('t')) return Uh.get('t');
    let i = Nf(
      256,
      (t, e) => {
        ((t.fillStyle = '#c9ccd2'), t.fillRect(0, 0, e, e));
        let n = 4,
          s = e / n;
        for (let r = 0; r < n; r++)
          for (let o = 0; o < n; o++) {
            let a = r * s + 3,
              l = o * s + 3,
              c = s - 6,
              h = t.createLinearGradient(a, l, a + c, l + c);
            (h.addColorStop(0, '#1b2a55'),
              h.addColorStop(1, '#0e1734'),
              (t.fillStyle = h),
              t.fillRect(a, l, c, c),
              (t.fillStyle = 'rgba(200,210,230,0.35)'));
            for (let u = 1; u < 6; u++) t.fillRect(a, l + (c * u) / 6, c, 1);
            t.fillRect(a + c / 2, l, 1.5, c);
          }
      },
      !0,
    );
    return (Uh.set('t', i), i);
  }
  function ti(i = '#ff5f1f') {
    let t = If(i);
    return (
      (t.foil = new ln({
        color: '#d9a441',
        metalness: 1,
        roughness: 0.3,
        bumpMap: Df(),
        bumpScale: 2.2,
      })),
      (t.foil2 = new ln({
        color: '#cfd2d8',
        metalness: 1,
        roughness: 0.28,
        bumpMap: Df(),
        bumpScale: 2.2,
      })),
      (t.solar = (e = 1, n = 1) => {
        let s = By().clone();
        return (
          s.repeat.set(e, n),
          (s.needsUpdate = !0),
          new ln({ map: s, metalness: 0.55, roughness: 0.22, color: '#ffffff' })
        );
      }),
      t
    );
  }
  var Zl = [nt(), nt(), nt(), nt(), nt()];
  function Kl(i, t, e) {
    let n = i.length;
    for (let s = 0; s < n; s++) Zl[s].copy(i[s]);
    for (let s = n - 1; s > 0; s--) for (let r = 0; r < s; r++) Zl[r].lerp(Zl[r + 1], t);
    return e.copy(Zl[0]);
  }
  var Fh = nt();
  var Oh = nt();
  function Jl(i, t = 36) {
    let e = 0;
    Kl(i, 0, Fh);
    for (let n = 1; n <= t; n++) (Kl(i, n / t, Oh), (e += Fh.distanceTo(Oh)), Fh.copy(Oh));
    return e;
  }
  var Mi = class {
    constructor(t, e, { lens: n, socket: s, prevJoint: r = null, tipDof: o = 1 }) {
      ((this.lens = n),
        (this.n = n.length),
        (this.L = n.reduce((c, h) => c + h, 0)),
        (this.socket = s),
        (this.joints = []));
      let a = r;
      for (let c = 0; c < this.n; c++) {
        let h = new we();
        ((h.matrixAutoUpdate = !1), e.add(h), t.joint(h, 2, a), (a = h), this.joints.push(h));
      }
      ((this.tip = new we()),
        (this.tip.matrixAutoUpdate = !1),
        e.add(this.tip),
        t.joint(this.tip, o, a),
        (this.pts = Array.from({ length: this.n + 1 }, () => nt())),
        (this.cum = []));
      let l = 0;
      for (let c of n) (this.cum.push(l), (l += c));
      (this.cum.push(l),
        (this.cum0 = this.cum.slice()),
        (this.L0 = this.L),
        (this.reach = 1),
        (this._ctrl = [nt(), nt(), nt(), nt(), nt()]),
        (this._poly = Array.from({ length: 97 }, () => nt())),
        (this._plen = new Float32Array(97)),
        (this.B = nt()),
        (this.dB = nt()),
        (this.nB = nt()));
    }
    setScale(t) {
      this.L = this.L0 * t;
      for (let e = 0; e < this.cum.length; e++) this.cum[e] = this.cum0[e] * t;
      return this;
    }
    solve(t, e, { curl: n = null, roll: s = 0, bias: r = 1 } = {}) {
      let { socket: o, L: a } = this;
      o.updateMatrixWorld(!0);
      let l = this.B.setFromMatrixPosition(o.matrixWorld),
        c = this.dB.set(0, 1, 0).transformDirection(o.matrixWorld),
        h = this.nB.set(0, 0, 1).transformDirection(o.matrixWorld),
        u = this._ctrl,
        f = nt().addVectors(l, t).multiplyScalar(0.5),
        d = (T, U) => (
          u[0].copy(l),
          u[1].copy(l).addScaledVector(c, T * r),
          u[2].copy(f),
          n && u[2].addScaledVector(n, U),
          u[3].copy(t).addScaledVector(e, -T),
          u[4].copy(t),
          u
        ),
        p = l.distanceTo(t),
        x;
      if (p >= a * 0.995) {
        let T = nt().subVectors(t, l).normalize();
        (u[0].copy(l), u[4].copy(l).addScaledVector(T, a));
        for (let U = 1; U < 4; U++) u[U].lerpVectors(u[0], u[4], U / 4);
        ((x = u), (this.reach = 0));
      } else {
        this.reach = 1;
        let T = Math.min(a * 0.12, Math.max(0, (a - p) * 0.5)),
          U = 1;
        if (n && Jl(d(T, 1)) > a) {
          let Y = 0,
            j = 1;
          for (let J = 0; J < 18; J++) {
            let R = (Y + j) / 2;
            Jl(d(T, R)) > a ? (j = R) : (Y = R);
          }
          U = Y;
        }
        let X = 0,
          L = a * 0.6;
        for (; Jl(d(L, U)) < a && L < a * 40;) L *= 2;
        for (let Y = 0; Y < 20; Y++) {
          let j = (X + L) / 2;
          Jl(d(j, U)) < a ? (X = j) : (L = j);
        }
        x = d((X + L) / 2, U);
      }
      let m = this._poly,
        g = this._plen;
      (Kl(x, 0, m[0]), (g[0] = 0));
      for (let T = 1; T < m.length; T++)
        (Kl(x, T / (m.length - 1), m[T]), (g[T] = g[T - 1] + m[T].distanceTo(m[T - 1])));
      let M = g[m.length - 1] / a,
        E = 1;
      for (let T = 0; T <= this.n; T++) {
        let U = this.cum[T] * M;
        for (; E < m.length - 1 && g[E] < U;) E++;
        let X = He((U - g[E - 1]) / Math.max(1e-6, g[E] - g[E - 1]), 0, 1);
        this.pts[T].lerpVectors(m[E - 1], m[E], X);
      }
      let y = nt(),
        C = nt().copy(h),
        w = nt(),
        _ = nt().copy(c),
        b = new Wt(),
        W = new Ee(),
        N = nt();
      for (let T = 0; T <= this.n; T++) {
        (T < this.n && y.subVectors(this.pts[T + 1], this.pts[T]).normalize(), N.crossVectors(_, y));
        let U = N.length();
        (U > 1e-7 && C.applyAxisAngle(N.divideScalar(U), Math.atan2(U, _.dot(y))),
          C.addScaledVector(y, -C.dot(y)).normalize(),
          w.crossVectors(y, C),
          b.makeBasis(w, y, C));
        let X = T < this.n ? this.joints[T] : this.tip;
        if (
          (W.setFromRotationMatrix(b),
          T === this.n && s && W.multiply(new Ee().setFromAxisAngle(nt(0, 1, 0), s)),
          X.position.copy(this.pts[T]),
          X.quaternion.copy(W),
          X.updateMatrix(),
          X.matrixWorld.copy(X.matrix),
          T === this.n)
        )
          for (let L of X.children) L.updateMatrixWorld(!0);
        _.copy(y);
      }
      return this;
    }
  };
  var qt = (i, t = 0, e = 0, n = 0) => {
    let s = new we();
    return (s.position.set(t, e, n), i.add(s), s);
  };
  var Co = (i, t, e, n, s, r, o = {}) => i.add(t, e, { x: Math.sin(s) * n, y: r, z: Math.cos(s) * n, ry: s, ...o });
  function Bh(i, t, e) {
    return {
      p: i.p.clone().lerp(t.p, e),
      d: i.d.clone().lerp(t.d, e).normalize(),
      g: ye(i.g ?? 0, t.g ?? 0, e),
    };
  }
  function $l(i, t, e) {
    let n = 0;
    for (; n < i.length - 1 && t >= i[n + 1][0];) n++;
    if (n >= i.length - 1 || t < i[0][0]) return { ...i[Math.min(n, i.length - 1)][1](), arc: 0 };
    let [s, r] = i[n],
      [o, a] = i[n + 1],
      l = e((t - s) / (o - s)),
      c = r(),
      h = a();
    return {
      ...Bh(c, h, l),
      arc: c.p.distanceTo(h.p) > 0.04 ? Math.sin(Math.PI * l) : 0,
    };
  }
  function Si(i, t, e, n, s = 64) {
    let r = new Xt();
    (r.add(
      wt(
        [
          [t * 0.86, e * 0.16],
          [t * 0.95, e * 0.13],
          [t, e * 0.19],
          [t, e * 0.81],
          [t * 0.95, e * 0.87],
          [t * 0.86, e * 0.84],
          [t * 0.86, e * 0.16],
        ],
        s,
      ),
      n ? i.shell2 : i.shell,
    ),
      r.add(
        wt(
          [
            [t * 0.7, e * 0.86],
            [t * 0.99, e * 0.86],
            [t * 0.99, e * 0.9],
            [t * 0.7, e * 0.9],
            [t * 0.7, e * 0.86],
          ],
          s,
        ),
        i.accent,
      ),
      r.add(
        wt(
          [
            [0, 0],
            [t * 0.62, 0],
            [t * 0.68, e * 0.08],
            [t * 0.68, e * 0.95],
            [t * 0.6, e],
            [0, e],
          ],
          32,
        ),
        i.dark,
      ),
      r.add(new Vt(t * 0.72, t * 0.72, e * 0.05, 36), i.frame, { y: e * 0.06 }),
      r.add(new Vt(t * 0.16, t * 0.16, t * 1.62, 16), i.chrome, {
        y: e * 0.02,
        rz: Math.PI / 2,
      }));
    for (let a of [-1, 1])
      (r.add(Ft(t * 0.16, e * 0.32, t * 0.36, t * 0.05, 3), i.frame, {
        x: a * t * 0.74,
        y: e * 0.06,
      }),
        r.add(new Vt(t * 0.12, t * 0.12, t * 0.06, 16), i.chrome, {
          x: a * t * 0.83,
          y: e * 0.02,
          rz: Math.PI / 2,
        }));
    (r.add(cn(t * 0.52, 12, t * 0.04, e * 0.05, e * 0.09, 8), i.chrome),
      r.add(Ft(t * 0.9, e * 0.62, t * 0.18, t * 0.06, 3), i.rubber, {
        y: e * 0.5,
        z: t * 0.97,
      }));
    for (let a = 0; a < 5; a++)
      r.add(Ft(t * 0.92, e * 0.025, t * 0.05, t * 0.01, 1), i.dark, {
        y: e * (0.25 + a * 0.125),
        z: t * 1.07,
      });
    r.add(new Vt(t * 0.1, t * 0.1, e * 0.9, 12), i.dark, {
      y: e * 0.5,
      z: -t * 1.02,
    });
    for (let a of [0.25, 0.75])
      r.add(Ft(t * 0.34, e * 0.08, t * 0.2, t * 0.04, 2), i.frame, {
        y: e * a,
        z: -t * 0.98,
      });
    let o = new ie(t * 0.04, 8, 6);
    for (let a = 0; a < 16; a++) {
      let l = ((a + 0.5) / 16) * Kt;
      Math.cos(l) > 0.55 || (Co(r, o, i.decal, t, l, e * 0.24), Co(r, o, i.decal, t, l, e * 0.76));
    }
    if (n)
      for (let [a, l] of [
        [1.5, 0.06],
        [1.62, 0.06],
        [1.78, 0.16],
      ])
        Co(r, new Me(t * l, e * 0.26, t * 0.05), i.decal, t * 1.02, a, e * 0.5);
    else {
      for (let a = 0; a < 4; a++) Co(r, new Me(t * 0.5, e * 0.03, t * 0.05), i.decal, t, 1.75, e * (0.36 + a * 0.07));
      Co(r, Ft(t * 0.45, e * 0.16, t * 0.06, t * 0.03, 2), i.accent, t * 1.01, -1.7, e * 0.5);
    }
    return r.geos();
  }
  function Yi(i, t, e, n = 1) {
    let s = qt(t),
      r = new Xt(s);
    (r.add(
      wt(
        [
          [0, -0.012 * n],
          [0.026 * n, -0.012 * n],
          [0.034 * n, 0.004 * n],
          [0.035 * n, 0.03 * n],
          [0.03 * n, 0.04 * n],
          [0, 0.04 * n],
        ],
        48,
      ),
      e.frame,
    ),
      r.add(new jt(0.0352 * n, 0.0035 * n, 8, 48), e.accent, {
        y: 0.018 * n,
        rx: Math.PI / 2,
      }),
      r.add(cn(0.024 * n, 8, 0.0025 * n, 0.004 * n, 0.041 * n), e.chrome),
      r.add(new Vt(0.009 * n, 0.009 * n, 0.006 * n, 24), e.glow, {
        y: 0.043 * n,
      }),
      r.done());
    let o = [];
    for (let l = 0; l < 3; l++) {
      let c = qt(s, 0, 0.038 * n, 0);
      c.rotation.y = (l * Kt) / 3;
      let h = qt(c, 0, 0, 0.024 * n);
      i.joint(h, 1);
      let u = new Xt(h);
      (u.add(new Vt(0.0065 * n, 0.0065 * n, 0.017 * n, 16), e.chrome, {
        rz: Math.PI / 2,
      }),
        u.add(Ft(0.014 * n, 0.04 * n, 0.011 * n, 0.004 * n, 3), e.shell, {
          y: 0.02 * n,
        }),
        u.add(Ft(0.015 * n, 0.006 * n, 0.012 * n, 0.002 * n, 1), e.accent, {
          y: 0.03 * n,
        }),
        u.done());
      let f = qt(h, 0, 0.04 * n, 0);
      i.joint(f, 1);
      let d = new Xt(f);
      (d.add(new Vt(0.0055 * n, 0.0055 * n, 0.015 * n, 16), e.frame, {
        rz: Math.PI / 2,
      }),
        d.add(Ft(0.012 * n, 0.032 * n, 0.01 * n, 0.004 * n, 3), e.dark, {
          y: 0.016 * n,
        }),
        d.add(Ft(0.012 * n, 0.022 * n, 0.004 * n, 0.002 * n, 2), e.rubber, {
          y: 0.018 * n,
          z: -0.006 * n,
        }),
        d.done(),
        o.push([h, f]));
    }
    let a = qt(s, 0, 0.062 * n, 0);
    return {
      palm: s,
      fingers: o,
      grip: a,
      set(l) {
        for (let [c, h] of o) ((c.rotation.x = ye(-0.55, 0.75, l)), (h.rotation.x = ye(-0.85, 0.2, l)));
        s.updateMatrixWorld(!0);
      },
    };
  }
  function Uf(i) {
    let t = new Ne(),
      e = new Xt(t);
    (e.add(Ft(0.15, 0.02, 0.011, 0.005, 3), i.frame, { x: -0.015 }),
      e.add(Ft(0.085, 0.025, 0.016, 0.008, 4), i.rubber, { x: -0.045 }));
    for (let n = 0; n < 6; n++) e.add(Ft(0.004, 0.026, 0.017, 0.0015, 1), i.dark, { x: -0.08 + n * 0.014 });
    return (
      e.add(Ft(0.012, 0.026, 0.017, 0.004, 2), i.accent, { x: -0.093 }),
      e.add(new jt(0.006, 0.0022, 8, 24), i.chrome, { x: -0.1 }),
      e.add(Ft(0.035, 0.022, 0.012, 0.005, 3), i.chrome, { x: 0.07 }),
      e.add(
        wt(
          [
            [0, -0.0075],
            [0.019, -0.0075],
            [0.021, -0.005],
            [0.021, 0.005],
            [0.019, 0.0075],
            [0, 0.0075],
          ],
          48,
        ),
        i.chrome,
        { x: 0.1, rx: Math.PI / 2 },
      ),
      e.add(new Vt(0.0075, 0.0075, 0.004, 24), i.accent, {
        x: 0.1,
        z: -0.0095,
        rx: Math.PI / 2,
      }),
      e.add(Ft(0.012, 0.004, 0.004, 0.0015, 1), i.dark, { x: 0.1, z: -0.012 }),
      e.add(
        wt(
          [
            [0.0085, 0],
            [0.011, 0],
            [0.011, 0.028],
            [0.0085, 0.03],
          ],
          40,
        ),
        i.chrome,
        { x: 0.1, z: 0.0075, rx: Math.PI / 2 },
      ),
      e.add(new Vt(0.0062, 0.0062, 0.026, 6), i.dark, {
        x: 0.1,
        z: 0.022,
        rx: Math.PI / 2,
      }),
      e.done(),
      t
    );
  }
  function jl(i, t, e, n, s, r = {}) {
    let o = new Xt();
    (o.add(
      wt(
        [
          [n * 1, -s / 2],
          [n * 1.18, -s / 2 + s * 0.1],
          [n * 1.22, 0],
          [n * 1.18, s / 2 - s * 0.1],
          [n * 1.05, s / 2],
          [n * 1, s / 2],
          [n * 1, -s / 2],
        ],
        72,
      ),
      e.shell,
    ),
      o.add(
        wt(
          [
            [n * 1.002, -s / 2],
            [n * 1.002, s / 2],
          ],
          72,
        ),
        e.dark,
      ),
      o.add(new jt(n * 1.2, n * 0.03, 8, 72), e.accent, { rx: Math.PI / 2 }));
    for (let h = 0; h < 4; h++)
      o.add(Ft(n * 2, n * 0.06, n * 0.04, n * 0.015, 1), e.frame, {
        ry: (h * Math.PI) / 4,
        y: s * 0.35,
      });
    for (let h of [0.45, 0.8])
      o.add(new jt(n * h, n * 0.018, 6, 64), e.frame, {
        y: s * 0.48,
        rx: Math.PI / 2,
      });
    o.add(
      wt(
        [
          [0, -s * 0.3],
          [n * 0.24, -s * 0.3],
          [n * 0.26, 0],
          [n * 0.2, s * 0.3],
          [0, s * 0.36],
        ],
        40,
      ),
      e.dark,
    );
    for (let [h, u] of o.geos()) i.add(u, h, r);
    let a = new we();
    (t.add(a),
      a.position.set(r.x || 0, r.y || 0, r.z || 0),
      a.rotation.set(r.rx || 0, r.ry || 0, r.rz || 0, r.order || 'XYZ'));
    let l = new we();
    a.add(l);
    let c = new Xt(l);
    for (let h = 0; h < 9; h++) {
      let u = (h / 9) * Kt;
      c.add(
        Ro(
          [
            [0, -n * 0.06],
            [n * 0.95, -n * 0.12],
            [n * 0.95, n * 0.12],
            [0, n * 0.06],
          ],
          n * 0.02,
          n * 0.006,
          1,
        ),
        e.shell2,
        { ry: u, rx: 1.05, order: 'YXZ' },
      );
    }
    return (
      c.add(
        wt(
          [
            [0, -s * 0.12],
            [n * 0.24, -s * 0.12],
            [n * 0.24, s * 0.08],
            [n * 0.12, s * 0.18],
            [0, s * 0.2],
          ],
          40,
        ),
        e.accent,
      ),
      c.done(),
      l
    );
  }
  var zy = new Wt();
  var fr = class {
    constructor(t, e, n) {
      ((this.obj = t),
        (t.matrixAutoUpdate = !1),
        (this.offset = new Wt()),
        (this.target = new Wt()),
        (this.holder = null),
        e && this.attach(e, n, !0));
    }
    attach(t, e = null, n = !1) {
      return (
        t.updateMatrixWorld(!0),
        this.target.copy(e || new Wt()),
        n || !this.holder
          ? this.offset.copy(this.target)
          : this.offset.multiplyMatrices(zy.copy(t.matrixWorld).invert(), this.obj.matrixWorld),
        (this.holder = t),
        this
      );
    }
    settle(t, e) {
      let n = nt(),
        s = new Ee(),
        r = nt(),
        o = nt(),
        a = new Ee(),
        l = nt();
      (this.offset.decompose(n, s, r), this.target.decompose(o, a, l));
      let c = 1 - Math.exp(-t * e);
      (n.lerp(o, c), s.slerp(a, c), this.offset.compose(n, s, r));
    }
    update() {
      (this.holder.updateMatrixWorld(!0),
        this.obj.matrix.multiplyMatrices(this.holder.matrixWorld, this.offset),
        this.obj.matrixWorld.copy(this.obj.matrix));
      for (let t of this.obj.children) t.updateMatrixWorld(!0);
    }
  };
  var Ql = 26;
  var zh = 0.04;
  var Ff = 0.03;
  var Hh = (i) => ye(1, 0.5, i / (Ql - 1));
  var xe = 0.2;
  var ni = 0.05;
  var Hy = 1.05;
  var ky = 18;
  var Gy = ['claw', 'light', 'driver', 'suction', 'claw', 'claw', 'camera', 'claw'];
  var Zi = (i, t, e = xe, n = nt()) =>
    n.set(Math.sin(t) * Math.sin(i) * e, ni + Math.cos(i) * e, Math.cos(t) * Math.sin(i) * e);
  function bi(i, t, e, n, s, r = {}, o = 0.002) {
    let a = Zi(n, s, xe + o);
    i.add(t, e, {
      x: a.x,
      y: a.y,
      z: a.z,
      ry: s,
      rx: n - Math.PI / 2 + (r.tilt || 0),
      order: 'YXZ',
      ...r,
    });
  }
  function Vy(i, t) {
    let e = [];
    for (let c = 0; c <= 36; c++) {
      let h = c / 36,
        u = h * Math.PI * 0.6;
      e.push([Math.max(8e-4, Math.sin(u) * xe * (1 - 0.04 * h)), ni + Math.cos(u) * xe]);
    }
    let n = 8,
      s = 0.012;
    for (let c = 0; c < n; c++)
      i.add(
        new pi(e.map(([h, u]) => new pt(h, u)).reverse(), 24, (c / n) * Kt + s / 2, Kt / n - s),
        c % 4 === 3 ? t.shell2 : t.shell,
      );
    i.add(new ie(xe * 0.95, 64, 32), t.dark, { y: ni });
    let r = new ie(0.0026, 8, 6);
    for (let c = 0; c < n; c++) {
      let h = (c / n) * Kt;
      for (let u = 4; u < 33; u += 2) {
        let [f, d] = e[u];
        for (let p of [-1, 1]) {
          let x = h + p * 0.045;
          i.add(r, t.decal, {
            x: Math.sin(x) * (f + 0.001),
            y: d,
            z: Math.cos(x) * (f + 0.001),
          });
        }
      }
    }
    let o = e[36][1];
    (i.add(
      wt(
        [
          [xe * 0.97, o + 0.004],
          [xe * 1.02, o - 0.002],
          [xe * 1.035, o - 0.012],
          [xe * 1.035, o - 0.036],
          [xe * 1, o - 0.046],
          [xe * 0.95, o - 0.046],
        ],
        128,
      ),
      t.shell2,
    ),
      i.add(
        wt(
          [
            [xe * 1.036, o - 0.02],
            [xe * 1.04, o - 0.022],
            [xe * 1.04, o - 0.028],
            [xe * 1.036, o - 0.03],
          ],
          128,
        ),
        t.accent,
      ));
    for (let c = 0; c < 72; c++) {
      let h = (c / 72) * Kt;
      i.add(r, t.decal, {
        x: Math.sin(h) * xe * 1.037,
        y: o - 0.008,
        z: Math.cos(h) * xe * 1.037,
      });
    }
    let a = o - 0.046;
    i.add(
      wt(
        [
          [xe * 0.95, a],
          [xe * 0.93, a - 0.03],
          [xe * 0.82, a - 0.05],
          [xe * 0.55, a - 0.06],
          [0, a - 0.062],
        ],
        96,
      ),
      t.dark,
    );
    for (let c = 0; c < 24; c++) {
      let h = (c / 24) * Kt + 0.13;
      (i.add(new Vt(0.0045, 0.0045, 0.03, 12), t.frame, {
        x: Math.sin(h) * xe * 0.88,
        y: a - 0.02,
        z: Math.cos(h) * xe * 0.88,
      }),
        i.add(new Vt(0.0026, 0.0026, 0.026, 10), t.chrome, {
          x: Math.sin(h) * xe * 0.88,
          y: a + 0.002,
          z: Math.cos(h) * xe * 0.88,
        }));
    }
    (i.add(
      wt(
        [
          [0.05, a - 0.06],
          [0.048, a - 0.075],
          [0.035, a - 0.085],
          [0, a - 0.087],
        ],
        64,
      ),
      t.frame,
    ),
      i.add(new ie(0.03, 48, 16, 0, Kt, Math.PI / 2, Math.PI / 2), t.glass, {
        y: a - 0.082,
      }));
    for (let c = 0; c < 12; c++) {
      let h = (c / 12) * Kt;
      i.add(new ie(0.0032, 10, 8), t.glow, {
        x: Math.sin(h) * 0.042,
        y: a - 0.078,
        z: Math.cos(h) * 0.042,
      });
    }
    (i.add(
      wt(
        [
          [0, 0],
          [0.058, 0],
          [0.062, -0.004],
          [0.062, -0.01],
          [0, -0.01],
        ],
        72,
      ),
      t.shell2,
      { y: ni + xe + 0.006 },
    ),
      i.add(cn(0.051, 12, 0.0028, 0.004, ni + xe + 0.008, 8), t.decal),
      i.add(new jt(0.06, 0.0028, 8, 72), t.accent, {
        y: ni + xe + 0.002,
        rx: Math.PI / 2,
      }),
      i.add(new jt(0.022, 0.0045, 12, 32, Math.PI), t.frame, {
        y: ni + xe + 0.006,
      }));
    for (let c of [-1, 1])
      i.add(new Vt(0.006, 0.006, 0.004, 16), t.dark, {
        x: c * 0.022,
        y: ni + xe + 0.008,
      });
    for (let c = 0; c < 9; c++) bi(i, Ft(0.012, 0.006, 0.004, 0.002, 2), t.glow, 1.53, -0.24 + c * 0.06, {}, 0.003);
    (bi(i, Ft(0.05, 0.03, 0.004, 0.003, 2), t.accent, 0.62, 0.62),
      bi(i, Ft(0.035, 0.022, 0.004, 0.003, 2), t.accent, 0.95, -2.3));
    for (let c = 0; c < 5; c++) bi(i, new Me(0.034, 0.0035, 0.003), t.decal, 0.8 + c * 0.03, -0.75);
    for (let c = 0; c < 4; c++) bi(i, new Me(0.0035, 0.03, 0.003), t.decal, 1.05, 2.2 + c * 0.03);
    (bi(i, new Me(0.09, 0.003, 0.003), t.decal, 1.2, 2.95),
      bi(i, new Me(0.055, 0.003, 0.003), t.decal, 1.24, 2.95),
      bi(i, Ft(0.07, 0.05, 0.008, 0.01, 3), t.shell2, 1.3, 1.5, {}, 0.004),
      bi(i, qi(0.058, 0.04, 7, 0.006, 0.45), t.decal, 1.3, 1.5, {}, 0.009));
    let l = Zi(0.55, Math.PI + 0.45);
    (i.add(new Vt(0.0022, 0.0022, 0.22, 8), t.chrome, {
      x: l.x,
      y: l.y + 0.11,
      z: l.z,
      rz: 0.12,
    }),
      i.add(new ie(0.006, 16, 10), t.accent, {
        x: l.x - 0.013,
        y: l.y + 0.22,
        z: l.z,
      }),
      i.add(
        wt(
          [
            [0, 0],
            [0.011, 0],
            [0.012, 0.008],
            [0, 0.01],
          ],
          24,
        ),
        t.frame,
        { x: l.x, y: l.y - 0.003, z: l.z },
      ));
  }
  function Wy(i, t) {
    (i.add(
      wt(
        [
          [0, -0.03],
          [0.046, -0.03],
          [0.052, -0.022],
          [0.054, 0.008],
          [0.05, 0.02],
          [0.042, 0.024],
          [0.042, 0.018],
          [0, 0.018],
        ],
        72,
      ),
      t.shell,
      { rx: Math.PI / 2 },
    ),
      i.add(
        wt(
          [
            [0.038, 0.024],
            [0.045, 0.024],
            [0.046, 0.032],
            [0.043, 0.036],
            [0.038, 0.036],
            [0.038, 0.024],
          ],
          72,
        ),
        t.accent,
        { rx: Math.PI / 2 },
      ),
      i.add(
        wt(
          [
            [0.026, 0.02],
            [0.038, 0.02],
            [0.038, 0.032],
            [0.026, 0.032],
          ],
          64,
        ),
        t.dark,
        { rx: Math.PI / 2 },
      ),
      i.add(new ie(0.032, 64, 32, 0, Kt, 0, 0.78), t.glass, {
        z: 0.012,
        rx: Math.PI / 2,
      }),
      i.add(new jt(0.019, 0.0018, 8, 64), t.accent, { z: 0.035 }),
      i.add(new jt(0.012, 0.003, 10, 48), t.dark, { z: 0.036 }),
      i.add(new Vt(0.007, 0.007, 0.003, 32), t.glow, {
        z: 0.038,
        rx: Math.PI / 2,
      }),
      i.add(cn(0.049, 16, 0.0016, 0.003, 0, 8), t.decal, {
        rx: Math.PI / 2,
        z: 0,
      }));
  }
  function Xy(i, t, e, n) {
    if (t === 'claw') return { kind: t, ...Yi(i, e, n) };
    let s = qt(e),
      r = new Xt(s),
      o = { kind: t, head: s };
    if (
      (r.add(
        wt(
          [
            [0, -0.01],
            [0.022, -0.01],
            [0.027, 0.004],
            [0.027, 0.012],
            [0.024, 0.016],
            [0, 0.016],
          ],
          48,
        ),
        n.frame,
      ),
      r.add(new jt(0.0272, 0.003, 8, 48), n.accent, {
        y: 0.006,
        rx: Math.PI / 2,
      }),
      t === 'light')
    ) {
      r.add(
        wt(
          [
            [0.02, 0.016],
            [0.03, 0.03],
            [0.034, 0.07],
            [0.036, 0.076],
            [0.03, 0.08],
            [0.028, 0.076],
            [0.02, 0.03],
          ],
          64,
        ),
        n.shell,
      );
      for (let u = 0; u < 4; u++)
        r.add(new jt(0.0315 + u * 6e-4, 0.0018, 8, 64), n.frame, {
          y: 0.036 + u * 0.008,
          rx: Math.PI / 2,
        });
      r.add(new Vt(0.028, 0.028, 0.003, 64), n.glass, { y: 0.077 });
      let a = new oe(new os(0.024, 48), new We({ color: new Rt('#fff3df').multiplyScalar(0.4) }));
      ((a.rotation.x = -Math.PI / 2), (a.position.y = 0.0785), s.add(a));
      let l = new us('#fff1dc', 0, 3, 0.42, 0.55, 1.6);
      ((l.position.y = 0.08), s.add(l));
      let c = qt(s, 0, 1, 0);
      l.target = c;
      let h = Wl(0.85, 0.32, '#fff2dd', 0.12);
      ((h.position.y = 0.08), s.add(h), Object.assign(o, { lens: a, spot: l, beam: h }));
    } else if (t === 'camera') {
      (r.add(Ft(0.05, 0.05, 0.045, 0.01, 4), n.shell, { y: 0.04 }),
        r.add(
          wt(
            [
              [0.012, 0],
              [0.017, 0],
              [0.018, 0.02],
              [0.016, 0.026],
              [0.012, 0.026],
            ],
            48,
          ),
          n.dark,
          { y: 0.065 },
        ),
        r.add(new jt(0.0175, 0.0025, 8, 48), n.accent, {
          y: 0.072,
          rx: Math.PI / 2,
        }),
        r.add(new ie(0.012, 48, 16, 0, Kt, 0, Math.PI / 2), n.glass, {
          y: 0.088,
        }),
        r.add(Ft(0.012, 0.006, 0.008, 0.002, 1), n.dark, {
          x: 0.017,
          y: 0.065,
          z: 0.016,
        }));
      let a = new oe(new Me(0.012, 0.004, 0.008), new We({ color: new Rt(2, 2, 2) }));
      (a.position.set(-0.016, 0.0655, 0.017), s.add(a), Object.assign(o, { flash: a }));
    } else if (t === 'driver') {
      r.add(
        wt(
          [
            [0.02, 0.016],
            [0.022, 0.02],
            [0.022, 0.05],
            [0.016, 0.06],
            [0.01, 0.064],
          ],
          48,
        ),
        n.shell2,
      );
      for (let c = 0; c < 18; c++) {
        let h = (c / 18) * Kt;
        r.add(Ft(0.003, 0.016, 0.003, 0.001, 1), n.dark, {
          x: Math.sin(h) * 0.0222,
          y: 0.034,
          z: Math.cos(h) * 0.0222,
        });
      }
      let a = qt(s, 0, 0.062, 0);
      i.joint(a, 1);
      let l = new Xt(a);
      (l.add(
        wt(
          [
            [0, 0],
            [0.009, 0],
            [0.009, 0.012],
            [0.006, 0.016],
            [0, 0.016],
          ],
          32,
        ),
        n.chrome,
      ),
        l.add(new Vt(0.0035, 0.0035, 0.03, 6), n.chrome, { y: 0.03 }),
        l.add(new as(0.0035, 0.008, 6), n.chrome, { y: 0.049 }),
        l.add(Ft(0.004, 0.012, 0.0022, 0.001, 1), n.accent, {
          y: 0.006,
          z: 0.0085,
        }),
        l.done(),
        Object.assign(o, { bit: a }));
    } else if (t === 'suction') {
      let a = qt(s, 0, 0.016, 0);
      i.joint(a, 1);
      let l = new Xt(a),
        c = [];
      for (let h = 0; h <= 10; h++) c.push([h % 2 ? 0.018 : 0.023, h * 0.0045]);
      (l.add(wt(c, 48), n.rubber),
        l.add(
          wt(
            [
              [0.006, 0.045],
              [0.02, 0.046],
              [0.034, 0.056],
              [0.036, 0.06],
              [0.032, 0.061],
              [0.018, 0.052],
              [0.006, 0.05],
            ],
            64,
          ),
          n.rubber,
        ),
        l.add(new jt(0.0345, 0.002, 8, 64), n.accent, {
          y: 0.059,
          rx: Math.PI / 2,
        }),
        l.done(),
        Object.assign(o, { bel: a }));
    }
    return (r.done(), o);
  }
  var Of = {
    id: 'octo',
    name: '舱内章鱼',
    accent: '#ff5f1f',
    size: '展开 1.9 米',
    desc: '舱内维修助手。8 条腕各 26 节，腕尖分别装着三指爪、照明灯、相机、电动螺丝刀和吸盘；干活时几条腕同时伸向一个工作点，打光、拍照、拧螺丝；需要时从身侧的工具夹取出扳手，递给宇航员。',
    build(i) {
      let t = ei(i, { shadow: 1.6 }),
        { scene: e } = t,
        n = ti('#ff5f1f'),
        s = new Ne();
      (e.add(s), i.joint(s, 6));
      {
        let I = new Xt(s);
        (Vy(I, n), I.done());
      }
      let r = [-0.5, 0.5].map((I) => {
          let z = qt(s);
          (Zi(1.18, I, xe - 0.006, z.position), z.lookAt(s.localToWorld(Zi(1.18, I, xe * 2))));
          let G = qt(z);
          i.joint(G, 2);
          let D = new Xt(G);
          return (Wy(D, n), D.done(), { mount: z, pan: G });
        }),
        o = [];
      {
        let I = new Xt(s);
        for (let z of [Math.PI - 0.62, Math.PI + 0.62]) {
          let G = Zi(1.22, z, xe + 0.012),
            D = Zi(1.22, z, 1)
              .sub(nt(0, ni, 0))
              .normalize(),
            K = new Ee().setFromUnitVectors(nt(0, 1, 0), D),
            lt = new an().setFromQuaternion(K),
            it = jl(I, s, n, 0.04, 0.034, {
              x: G.x,
              y: G.y,
              z: G.z,
              rx: lt.x,
              ry: lt.y,
              rz: lt.z,
            });
          (i.joint(it.parent, 1), o.push(it));
        }
        I.done();
      }
      let a = qt(s);
      {
        let z = Zi(1.62, -1.62, xe + 0.03);
        (a.position.copy(z), a.rotation.set(0, -1.62, 0), a.rotateZ(Math.PI / 2), a.rotateX(Math.PI));
        let G = new Xt(s);
        for (let D of [-0.035, 0.05]) {
          let K = Zi(1.62, -1.62, xe + 0.012).add(nt(0, D, 0));
          (G.add(Ft(0.03, 0.012, 0.03, 0.004, 3), n.frame, {
            x: K.x,
            y: K.y,
            z: K.z,
            ry: -1.62,
          }),
            G.add(new jt(0.014, 0.003, 8, 24, Math.PI * 1.3), n.dark, {
              x: K.x * 1.08,
              y: K.y,
              z: K.z * 1.08,
              ry: -1.62 + Math.PI / 2,
              rx: Math.PI / 2,
            }));
        }
        G.done();
      }
      let l = Uf(n);
      e.add(l);
      let c = new fr(l, a),
        h = Array.from({ length: Ql }, (I, z) => zh * Hh(z)),
        u = [new Mn(e, Si(n, Ff, zh, 0), (8 * Ql) / 2), new Mn(e, Si(n, Ff, zh, 1), (8 * Ql) / 2)],
        f = [],
        d = new Xt(s),
        p = ni + Math.cos(Math.PI * 0.6) * xe - 0.07;
      for (let I = 0; I < 8; I++) {
        let z = ((I + 0.5) / 8) * Kt,
          G = nt(Math.sin(z), 0, Math.cos(z)),
          D = qt(s, G.x * 0.14, p, G.z * 0.14),
          K = nt(G.x * 0.78, -0.62, G.z * 0.78).normalize(),
          lt = G.clone().negate().addScaledVector(K, K.dot(G)).normalize();
        (D.quaternion.setFromRotationMatrix(new Wt().makeBasis(nt().crossVectors(K, lt), K, lt)), i.joint(D, 2));
        let it = new an().setFromQuaternion(D.quaternion),
          ot = (Mt) => nt(0, Mt, 0).applyQuaternion(D.quaternion).add(D.position),
          $ = ot(-0.01),
          H = ot(0.012);
        (d.add(
          wt(
            [
              [0, -0.02],
              [0.038, -0.02],
              [0.042, -0.01],
              [0.042, 0.016],
              [0.036, 0.022],
              [0, 0.022],
            ],
            56,
          ),
          n.shell,
          { x: $.x, y: $.y, z: $.z, rx: it.x, ry: it.y, rz: it.z },
        ),
          d.add(new jt(0.0425, 0.003, 8, 56), n.accent, {
            x: H.x,
            y: H.y,
            z: H.z,
            rx: it.x,
            ry: it.y,
            rz: it.z,
          }),
          d.add(cn(0.032, 10, 0.0025, 0.004, 0, 8), n.chrome, {
            x: H.x,
            y: H.y,
            z: H.z,
            rx: it.x,
            ry: it.y,
            rz: it.z,
          }));
        let Z = new Mi(i, e, { lens: h, socket: D, prevJoint: D }),
          mt = Xy(i, Gy[I], Z.tip, n);
        f.push({ i: I, a: z, out: G, sock: D, arm: Z, t: mt, g: 0.35 });
      }
      d.done();
      let x = nt(),
        m = nt(),
        g = nt(0, 1, 0),
        M = (I, z, G) => s.localToWorld(nt(I, z, G)),
        E = (I, z, G) => nt(I, z, G).normalize().transformDirection(s.matrixWorld),
        y = [0, -0.14, 0.56],
        C = (I, z) => {
          let G = z * 0.85 + I.i * 0.8,
            D = 0.5 + 0.07 * Math.sin(G),
            K = nt(I.out.z, 0, -I.out.x),
            lt = I.out
              .clone()
              .multiplyScalar(D)
              .add(nt(0, -0.46 + 0.08 * Math.sin(G * 0.7 + 1), 0))
              .addScaledVector(K, 0.08 * Math.sin(G * 0.6)),
            it = 0.5 + 0.5 * Math.sin(G * 0.6 + 2),
            ot = I.out
              .clone()
              .multiplyScalar(ye(0.75, -0.35, it))
              .add(nt(0, ye(-0.65, 0.8, it), 0))
              .addScaledVector(K, 0.3 * Math.sin(G));
          return {
            p: s.localToWorld(lt),
            d: ot.normalize().transformDirection(s.matrixWorld),
            g: 0.35,
          };
        },
        w = (I, z) => {
          let G = M(...y),
            D = 0.01 * Math.sin(z * 2 + I.i);
          switch (I.i) {
            case 0:
              return { p: M(0.17, y[1] + D, y[2] - 0.04), d: E(0, 0, 1), g: 0 };
            case 7:
              return { p: M(-0.17, y[1] - D, y[2] - 0.04), d: E(0, 0, 1), g: 0 };
            case 1: {
              let K = M(0.46, 0, 0.4);
              return { p: K, d: G.clone().sub(K).normalize(), g: 0 };
            }
            case 6: {
              let K = M(-0.44, 0.02, 0.44 + 0.03 * Math.sin(z * 0.8));
              return { p: K, d: G.clone().sub(K).normalize(), g: 0 };
            }
            case 2:
              return {
                p: M(0.03, y[1] + 0.02, y[2] - 0.045 + 0.012 * Math.max(0, Math.sin(z * 1.3))),
                d: E(0, 0, 1),
                g: 0,
              };
            case 3:
              return { p: M(0.34, -0.36, 0.44), d: E(0.15, -0.2, 1), g: 0 };
            case 4:
              return { p: M(0.3, -0.42 + D, 0.22), d: E(0.3, -0.6, 0.7), g: 0.6 };
            default:
              return C(I, z);
          }
        },
        _ = f[5],
        b = () => a.localToWorld(nt(-0.07, 0, 0)),
        W = () => E(..._.out.toArray()),
        N =
          (I, z = 0) =>
          () => ({
            p: b().addScaledVector(W(), z),
            d: W()
              .negate()
              .add(E(0, 0.6, 0))
              .normalize(),
            g: I,
          }),
        T = () => ({
          p: M(-0.16, -0.2, 0.62 + 0.01 * Math.sin(U * 1.2)),
          d: E(-0.25, 0.1, 1),
          g: 0,
        }),
        U = 0,
        X = [
          [10.5, () => C(_, U)],
          [11.4, N(0.95, 0.09)],
          [11.8, N(0.95)],
          [12, N(0)],
          [12.5, N(0, 0.1)],
          [13.4, T],
          [15.1, T],
          [15.9, N(0, 0.08)],
          [16.3, N(0)],
          [16.5, N(0.95)],
          [16.9, N(0.95, 0.08)],
          [17.6, () => C(_, U)],
        ],
        L = new Wt().makeTranslation(0.07, 0, 0),
        Y = 0,
        j = 0,
        J = 0,
        R = nt();
      function A(I, z) {
        U = z;
        let G = z % ky;
        G < Y && c.attach(a, null, !0);
        let D = (H) => Y < H && G >= H;
        (D(12) && c.attach(_.t.grip, L), D(16.3) && c.attach(a, null), (Y = G));
        let K = le((G - 4) / 1.1) - le((G - 9.4) / 1.1);
        (s.position.set(0.04 * Math.sin(z * 0.23), Hy + 0.025 * Math.sin(z * 0.7), 0.03 * Math.sin(z * 0.31)),
          s.rotation.set(0.04 * Math.sin(z * 0.5) - 0.08 * K, 0.35 * Math.sin(z * 0.12), 0.03 * Math.sin(z * 0.43)),
          s.updateMatrixWorld(!0));
        for (let H of f) {
          let Z = C(H, z);
          (K > 0.001 && (Z = Bh(Z, w(H, z), K)), H === _ && G >= 10.5 && (Z = $l(X, G, le)));
          let mt = E(...H.out.toArray())
            .multiplyScalar(0.06 + 0.16 * K)
            .addScaledVector(E(0, -1, 0), 0.08 * K);
          (H.arm.solve(Z.p.clone().addScaledVector(Z.d, H.t.kind === 'claw' ? -0.062 : -0.005), Z.d, { curl: mt }),
            (H.last = { p: Z.p.clone(), d: Z.d.clone(), bow: mt.clone() }),
            (H.g = Z.g));
        }
        for (let H of f)
          (H.t.set && H.t.set(H === _ || K > 0.5 ? H.g : 0.35 + 0.25 * Math.sin(z * 1.4 + H.i)),
            H.t.bit && ((J += I * 40 * le((G - 5.3) / 0.4) * (1 - le((G - 8.8) / 0.4))), (H.t.bit.rotation.y = J)),
            H.t.spot &&
              ((H.t.spot.intensity = 3.2 * K),
              (H.t.beam.material.uniforms.uK.value = K),
              H.t.lens.material.color.set('#fff3df').multiplyScalar(0.4 + 2.2 * K)),
            H.t.bel && (H.t.bel.scale.y = 1 - 0.3 * K * (0.5 + 0.5 * Math.sin(z * 2))),
            H.t.head?.updateMatrixWorld(!0));
        let lt = f[6].t;
        ((j = [6.2, 7.6].some((H) => G > H && G < H + 0.12) ? 1 : 0),
          lt.flash.material.color.setScalar(j ? 30 : 1.5),
          c.settle(G > 12 && G < 16.3 ? 6 : 8, I),
          c.update());
        let it = G >= 11.8 && G < 16.3 ? l.getWorldPosition(m) : K > 0.5 ? M(...y) : i.camera.position;
        R.lerp(it, 1 - Math.exp(-6 * I));
        for (let H of r) {
          let Z = H.mount.worldToLocal(R.clone());
          ((H.pan.rotation.y = Xe(H.pan.rotation.y, He(Math.atan2(Z.x, Z.z), -0.7, 0.7), 6, I)),
            (H.pan.rotation.x = Xe(H.pan.rotation.x, He(-Math.atan2(Z.y, Math.hypot(Z.x, Z.z)), -0.6, 0.6), 6, I)));
        }
        for (let H of o) H.rotation.y += I * (8 + 10 * K);
        n.glow.color.set(K > 0.5 ? '#ffb15f' : '#ff5f1f').multiplyScalar(2.4 + 0.5 * Math.sin(z * 2.2));
        let ot = 0,
          $ = 0;
        for (let H of f)
          H.arm.joints.forEach((Z, mt) => {
            mt % 2 ? u[1].set($++, Z, Hh(mt)) : u[0].set(ot++, Z, Hh(mt));
          });
        (u[0].commit(),
          u[1].commit(),
          x.copy(s.position).add(nt(0, -0.25, 0)),
          t.follow(nt(s.position.x, 0, s.position.z)));
      }
      A(1 / 60, 0);
      let O = () =>
        f.map((I) => {
          let z = I.arm.tip.getWorldPosition(nt()),
            G = nt(0, 1, 0).transformDirection(I.arm.tip.matrixWorld),
            D = I.last,
            K = I.arm.n,
            lt = I.arm.pts[K].clone()
              .sub(I.arm.pts[K - 1])
              .normalize();
          return {
            i: I.i,
            tool: I.t.kind,
            reach: I.arm.reach,
            L: +I.arm.L.toFixed(3),
            tip: s
              .worldToLocal(z.clone())
              .toArray()
              .map((it) => +it.toFixed(3)),
            want: s
              .worldToLocal(D.p.clone())
              .toArray()
              .map((it) => +it.toFixed(3)),
            dirDot: +G.dot(D.d).toFixed(3),
            segDot: +lt.dot(D.d).toFixed(3),
            bow: +D.bow.length().toFixed(3),
            handle: +I.arm._ctrl[4].distanceTo(I.arm._ctrl[3]).toFixed(3),
            chord: +I.arm.B.distanceTo(I.arm._ctrl[4]).toFixed(3),
            sock: I.sock.position.toArray().map((it) => +it.toFixed(3)),
          };
        });
      return {
        scene: e,
        sky: t.sky,
        update: A,
        focus: x,
        debug: O,
        cam: {
          pos: nt(1.25, 0.25, 1.75),
          from: nt(2.4, 1.2, 3.4),
          fov: 40,
          near: 0.02,
          far: 200,
          min: 0.9,
          max: 6,
          maxPolar: Math.PI * 0.62,
        },
        clampCamera(I) {
          I.position.y < 0.1 && (I.position.y = 0.1);
        },
        exposure: 1,
        jointSize: 0.009,
      };
    },
  };
  var se = 0.17;
  var tc = 1.1;
  var qy = 16;
  function Yy() {
    let t = document.createElement('canvas');
    t.width = t.height = 512;
    let e = t.getContext('2d'),
      n = new Pn(t);
    n.colorSpace = Ze;
    let s = ['关闭 3 号阀门', '拆下面板 4 颗螺丝', '更换滤芯', '拍照存档'];
    function r(o, a, l, c, h) {
      ((e.fillStyle = '#05080c'), e.fillRect(0, 0, 512, 512), (e.fillStyle = 'rgba(95,180,255,0.04)'));
      for (let d = 0; d < 512; d += 4) e.fillRect(0, d, 512, 1);
      let u = 512 / 2 + h.x * 30,
        f = 512 / 2 - h.y * 30;
      if (a === 'eyes') {
        let d = o % 4.3 < 0.13 ? 0.12 : 1;
        for (let p of [-1, 1])
          ((e.fillStyle = '#ff7a35'),
            (e.shadowColor = '#ff7a35'),
            (e.shadowBlur = 28),
            e.beginPath(),
            e.ellipse(u + p * 92, f - 10, 42, 58 * d, 0, 0, Kt),
            e.fill(),
            (e.shadowBlur = 0),
            (e.fillStyle = '#05080c'),
            e.beginPath(),
            e.ellipse(u + p * 92 + 10, f - 26, 12, 16 * d, 0, 0, Kt),
            e.fill());
        ((e.strokeStyle = 'rgba(255,122,53,0.7)'),
          (e.lineWidth = 8),
          (e.lineCap = 'round'),
          e.beginPath(),
          e.arc(u, f + 66, 30, 0.25 * Math.PI, 0.75 * Math.PI),
          e.stroke());
      } else if (a === 'step') {
        ((e.fillStyle = 'rgba(255,122,53,0.95)'),
          e.fillRect(126, 134, 260, 7),
          (e.fillStyle = '#ffffff'),
          (e.font = 'bold 44px "PingFang SC","Microsoft YaHei",sans-serif'),
          (e.textAlign = 'center'),
          e.fillText(`第 ${c + 1} 步`, 512 / 2, 200),
          (e.font = '40px "PingFang SC","Microsoft YaHei",sans-serif'),
          (e.fillStyle = 'rgba(255,255,255,0.9)'),
          e.fillText(s[c], 512 / 2, 262));
        for (let d = 0; d < 4; d++)
          ((e.fillStyle = d <= c ? '#ff7a35' : 'rgba(255,255,255,0.2)'),
            e.beginPath(),
            e.arc(512 / 2 - 66 + d * 44, 330, 10, 0, Kt),
            e.fill());
        ((e.strokeStyle = 'rgba(255,255,255,0.5)'),
          (e.lineWidth = 4),
          e.strokeRect(136, 360, 240, 40),
          (e.fillStyle = '#ff7a35'),
          e.fillRect(140, 364, 232 * l, 32));
      } else {
        ((e.strokeStyle = '#ffffff'), (e.lineWidth = 6));
        for (let [d, p, x, m] of [
          [96, 96, 1, 1],
          [416, 96, -1, 1],
          [96, 416, 1, -1],
          [416, 416, -1, -1],
        ])
          (e.beginPath(), e.moveTo(d, p + m * 52), e.lineTo(d, p), e.lineTo(d + x * 52, p), e.stroke());
        ((e.lineWidth = 3),
          e.beginPath(),
          e.arc(512 / 2, 512 / 2, 46 + 6 * Math.sin(o * 6), 0, Kt),
          e.stroke(),
          (e.fillStyle = '#ff3b30'),
          e.beginPath(),
          e.arc(120, 140, 12, 0, Kt),
          e.fill(),
          (e.fillStyle = '#ffffff'),
          (e.font = '30px monospace'),
          (e.textAlign = 'left'),
          e.fillText('REC', 142, 151),
          (e.fillStyle = `rgba(255,255,255,${l})`),
          e.fillRect(0, 0, 512, 512));
      }
      n.needsUpdate = !0;
    }
    return { tex: n, draw: r };
  }
  var Bf = {
    id: 'flyer',
    name: '随行飞球',
    accent: '#ff5f1f',
    size: '直径 34 厘米',
    desc: '在舱里跟着人飞的小助手。两侧导管风扇推进，八个百叶喷口调姿；正面屏幕平时是表情，干活时显示操作步骤；顶部相机转台负责拍照存档，腹部折叠臂可以展开，抓住舱内扶手停靠，关掉风扇省电待命。',
    build(i) {
      let t = ei(i, { shadow: 1.2 }),
        { scene: e } = t,
        n = ti('#ff5f1f'),
        s = Yy(),
        r = new We({ map: s.tex, color: new Rt(1.6, 1.6, 1.6) }),
        o = new Ne();
      e.add(o);
      let a = qt(o);
      i.joint(a, 6);
      {
        let T = new Xt(a),
          U = [];
        for (let R = 0; R <= 40; R++) {
          let A = (R / 40) * Math.PI;
          U.push([Math.max(5e-4, Math.sin(A) * se), -Math.cos(A) * se]);
        }
        (T.add(
          wt(
            U.filter(([, R]) => R <= -0.006),
            128,
          ),
          n.shell,
        ),
          T.add(
            wt(
              U.filter(([, R]) => R >= 0.006),
              128,
            ),
            n.shell2,
          ),
          T.add(
            wt(
              [
                [se * 0.97, -0.008],
                [se * 0.985, -0.006],
                [se * 0.985, 0.006],
                [se * 0.97, 0.008],
              ],
              128,
            ),
            n.dark,
          ),
          T.add(
            wt(
              [
                [se * 1, -0.004],
                [se * 1.012, -0.003],
                [se * 1.012, 0.003],
                [se * 1, 0.004],
              ],
              128,
            ),
            n.accent,
          ));
        for (let R of [-0.12, 0.12]) {
          let A = Math.sqrt(se * se - R * R);
          T.add(new jt(A + 5e-4, 0.0018, 8, 128), n.decal, {
            y: R,
            rx: Math.PI / 2,
          });
        }
        let X = new ie(0.0022, 8, 6);
        for (let R = 0; R < 64; R++) {
          let A = (R / 64) * Kt;
          for (let O of [-0.016, 0.016]) {
            let I = Math.sqrt(se * se - O * O) + 5e-4;
            T.add(X, n.decal, { x: Math.sin(A) * I, y: O, z: Math.cos(A) * I });
          }
        }
        (T.add(new ie(se + 0.004, 96, 24, 0, Kt, 0, 0.72), n.dark, {
          rx: Math.PI / 2,
        }),
          T.add(new jt(se * 0.66, 0.0045, 10, 96), n.frame, { z: se * 0.77 }),
          T.add(new jt(se * 0.7, 0.0028, 10, 96), n.accent, { z: se * 0.725 }),
          T.add(
            wt(
              [
                [0, se],
                [0.05, se - 0.002],
                [0.058, se + 0.004],
                [0.058, se + 0.016],
                [0.052, se + 0.02],
                [0, se + 0.02],
              ],
              96,
            ),
            n.frame,
          ),
          T.add(cn(0.048, 12, 0.0022, 0.003, se + 0.021, 8), n.chrome),
          T.add(
            wt(
              [
                [0, -se - 0.004],
                [0.062, -se + 0.008],
                [0.066, -se + 0.016],
                [0.06, -se + 0.014],
              ],
              96,
            ),
            n.shell2,
          ),
          T.add(new jt(0.064, 0.0025, 8, 96), n.accent, {
            y: -se + 0.012,
            rx: Math.PI / 2,
          }),
          T.add(Ft(0.06, 0.04, 0.012, 0.008, 4), n.frame, { z: -se - 0.002 }));
        for (let R = 0; R < 3; R++)
          T.add(new Vt(0.0045, 0.0045, 0.006, 16), n.chrome, {
            x: -0.016 + R * 0.016,
            z: -se - 0.009,
            rx: Math.PI / 2,
          });
        for (let R = 0; R < 5; R++)
          T.add(new ie(0.0028, 10, 8), R < 4 ? n.glow : n.decal, {
            x: -0.028 + R * 0.014,
            y: 0.05,
            z: -Math.sqrt(se * se - 0.05 * 0.05) - 0.001,
          });
        (T.add(qi(0.07, 0.03, 5, 0.004, 0.45), n.decal, {
          y: -0.07,
          z: -Math.sqrt(se * se - 0.07 * 0.07) - 0.002,
          rx: -0.42,
        }),
          T.add(Ft(0.05, 0.022, 0.003, 0.002, 1), n.accent, {
            x: 0.07,
            y: 0.08,
            z: -0.12,
            ry: Math.PI - 0.6,
            rx: -0.5,
            order: 'YXZ',
          }));
        for (let R of [-1, 1])
          (T.add(
            wt(
              [
                [0, 0],
                [0.04, 0],
                [0.044, 0.012],
                [0.034, 0.036],
                [0.026, 0.044],
                [0, 0.044],
              ],
              64,
            ),
            n.shell2,
            { x: R * (se - 0.006), rz: (-R * Math.PI) / 2 },
          ),
            T.add(new jt(0.042, 0.0026, 8, 64), n.accent, {
              x: R * (se + 0.006),
              ry: Math.PI / 2,
            }));
        T.done();
        let L = new ie(se + 0.0045, 96, 32, 0, Kt, 0, 0.64);
        L.rotateX(Math.PI / 2);
        let Y = L.attributes.position,
          j = L.attributes.uv,
          J = Math.sin(0.64) * (se + 0.0045);
        for (let R = 0; R < Y.count; R++) j.setXY(R, Y.getX(R) / (2 * J) + 0.5, Y.getY(R) / (2 * J) + 0.5);
        a.add(new oe(L, r));
      }
      let l = [],
        c = [];
      for (let T = 0; T < 8; T++) {
        let U = ((T + 0.5) / 8) * Kt,
          X = T % 2 ? 0.55 : -0.55,
          L = nt(Math.sin(U) * Math.cos(X), Math.sin(X), Math.cos(U) * Math.cos(X));
        if (L.z > 0.55) continue;
        let Y = qt(a);
        (Y.position.copy(L).multiplyScalar(se), Y.quaternion.setFromUnitVectors(nt(0, 0, 1), L));
        let j = new Xt(Y);
        (j.add(Ft(0.05, 0.04, 0.01, 0.008, 4), n.frame, { z: 0.002 }),
          j.add(Ft(0.042, 0.032, 0.012, 0.005, 3), n.dark, { z: 0.004 }),
          j.done());
        let J = [];
        for (let R = 0; R < 4; R++) {
          let A = qt(Y, 0, -0.012 + R * 0.008, 0.011);
          i.joint(A, 1);
          let O = new Xt(A);
          (O.add(Ft(0.038, 0.0075, 0.0018, 8e-4, 1), n.shell, { y: 0.0036 }), O.done(), J.push(A));
        }
        (l.push({ mount: Y, n: L, blades: J, open: 0 }), c.push(L));
      }
      let h = [];
      for (let T of [-1, 1]) {
        let U = qt(a, T * (se + 0.05), 0, 0);
        i.joint(U, 1);
        let X = new Xt(U);
        for (let Y of [-0.06, 0.06]) X.add(Ft(0.016, 0.02, 0.012, 0.005, 3), n.frame, { z: Y * 0.95 });
        X.add(new Vt(0.008, 0.008, 0.13, 20), n.chrome, { rx: Math.PI / 2 });
        let L = jl(X, U, n, 0.05, 0.05, { rz: Math.PI / 2 });
        (X.done(), h.push({ s: T, gim: U, sp: L }));
      }
      let u = qt(a, 0, se + 0.022, 0);
      i.joint(u, 1);
      let f, d;
      {
        let T = new Xt(u);
        T.add(
          wt(
            [
              [0, 0],
              [0.046, 0],
              [0.048, 0.006],
              [0.04, 0.012],
              [0, 0.012],
            ],
            72,
          ),
          n.shell2,
        );
        for (let X of [-1, 1])
          T.add(Ft(0.012, 0.05, 0.03, 0.005, 3), n.shell, {
            x: X * 0.034,
            y: 0.032,
          });
        (T.done(), (f = qt(u, 0, 0.04, 0)), i.joint(f, 1));
        let U = new Xt(f);
        (U.add(Ft(0.052, 0.04, 0.05, 0.012, 4), n.shell, {}),
          U.add(new Vt(0.006, 0.006, 0.072, 20), n.chrome, { rz: Math.PI / 2 }),
          U.add(
            wt(
              [
                [0.014, 0],
                [0.02, 0],
                [0.021, 0.018],
                [0.019, 0.024],
                [0.014, 0.024],
              ],
              64,
            ),
            n.dark,
            { z: 0.024, rx: Math.PI / 2 },
          ),
          U.add(new jt(0.0205, 0.0022, 8, 64), n.accent, { z: 0.034 }),
          U.add(new ie(0.0145, 48, 16, 0, Kt, 0, Math.PI / 2), n.glass, {
            z: 0.046,
            rx: Math.PI / 2,
          }),
          U.add(Ft(0.016, 0.006, 0.004, 0.002, 1), n.accent, {
            x: 0.016,
            y: 0.021,
            z: 0.012,
          }),
          U.add(new ie(0.003, 10, 8), n.glow, { x: -0.018, y: 0.012, z: 0.026 }),
          U.done(),
          (d = new oe(new Me(0.014, 0.008, 0.003), new We({ color: new Rt(1.5, 1.5, 1.5) }))),
          d.position.set(0, 0.026, 0.02),
          f.add(d));
      }
      let p = new ds('#ffffff', 0, 2.5, 2);
      (f.add(p), p.position.set(0, 0.03, 0.06));
      let x = {};
      {
        ((x.base = qt(a, 0, -se + 0.01, 0)), i.joint(x.base, 1));
        let T = new Xt(x.base);
        (T.add(new Vt(0.03, 0.034, 0.016, 48), n.frame, { y: -0.004 }),
          T.add(new Vt(0.012, 0.012, 0.05, 20), n.chrome, {
            y: -0.018,
            rz: Math.PI / 2,
          }),
          T.done(),
          (x.sh = qt(x.base, 0, -0.018, 0)),
          i.joint(x.sh, 1));
        let U = new Xt(x.sh);
        (U.add(Ft(0.024, 0.11, 0.02, 0.008, 4), n.shell, { y: -0.055 }),
          U.add(Ft(0.026, 0.03, 0.004, 0.002, 1), n.accent, {
            y: -0.03,
            z: 0.011,
          }),
          U.add(new Vt(0.0035, 0.0035, 0.09, 10), n.dark, {
            x: 0.014,
            y: -0.055,
          }),
          U.done(),
          (x.el = qt(x.sh, 0, -0.11, 0)),
          i.joint(x.el, 1));
        let X = new Xt(x.el);
        (X.add(new Vt(0.011, 0.011, 0.03, 24), n.frame, { rz: Math.PI / 2 }),
          X.add(Ft(0.02, 0.1, 0.017, 0.007, 4), n.shell2, { y: -0.05 }),
          X.add(cn(0.008, 6, 0.0015, 0.003, 0, 6), n.chrome, {
            rz: Math.PI / 2,
            x: 0.016,
          }),
          X.done(),
          (x.wr = qt(x.el, 0, -0.1, 0)),
          i.joint(x.wr, 1));
        let L = new Xt(x.wr);
        (L.add(new Vt(0.009, 0.009, 0.024, 20), n.frame, { rz: Math.PI / 2 }), L.done());
        let Y = qt(x.wr, 0, 0, 0);
        ((Y.rotation.x = Math.PI), (x.claw = Yi(i, Y, n, 0.75)));
      }
      let m = new hr(240, { map: Vl(), additive: !1, drag: 0.6 });
      e.add(m.points);
      let g = nt(),
        M = nt(),
        E = nt(),
        y = nt(0.5, tc, 0.6),
        C = nt(),
        w = 0,
        _ = nt(),
        b = 'eyes',
        W = (T) => {
          let U = T * 0.5;
          return nt(0.45 * Math.sin(U), tc + 0.08 * Math.sin(U * 2), 0.3 * Math.sin(U * 2) + 0.15);
        };
      function N(T, U) {
        let X = U % qy,
          L,
          Y = nt(0, tc - 0.08, 0.1);
        X < 6 ? (L = W(X)) : X < 10.5 ? (L = nt(0.05 * Math.sin(U), tc - 0.05, 0.25)) : X < 15 ? (L = Y) : (L = W(0));
        let j = y.clone(),
          J = X > 10.5 && X < 15 ? 2.2 : 1.6;
        (y.lerp(L, 1 - Math.exp(-J * T)), C.copy(y).sub(j).divideScalar(Math.max(T, 1e-4)));
        let R = i.camera.position.clone().sub(y).setY(0),
          A = X < 6 ? Math.atan2(C.x, C.z) * 0.6 + Math.atan2(R.x, R.z) * 0.4 : Math.atan2(R.x, R.z);
        ((w += Math.atan2(Math.sin(A - w), Math.cos(A - w)) * (1 - Math.exp(-2.5 * T))),
          _.lerp(nt(C.z * 0.25, 0, -C.x * 0.25), 1 - Math.exp(-4 * T)));
        let O = le((X - 11.6) / 0.8) * (1 - le((X - 14.6) / 0.4));
        (o.position.copy(y).add(nt(0, 0.008 * Math.sin(U * 2.3) * (1 - O), 0)),
          a.rotation.set(_.x * (1 - O), w, _.z * (1 - O), 'YXZ'));
        let I = He(C.length() * 3, 0.15, 1) * (1 - O * 0.85);
        for (let Z of h)
          ((Z.gim.rotation.x = Xe(Z.gim.rotation.x, He(-C.z * 2.5, -0.6, 0.6) + 0.15 * Math.sin(U * 0.7 + Z.s), 4, T)),
            (Z.sp.rotation.y += T * (12 + 46 * I)));
        a.updateMatrixWorld(!0);
        let z = C.clone().applyQuaternion(a.getWorldQuaternion(new Ee()).invert());
        for (let Z of l) {
          let mt = He(-Z.n.dot(z) * 6, 0, 1) * (1 - O);
          if (
            ((Z.open = Xe(Z.open, Math.max(mt, 0.1), 6, T)),
            Z.blades.forEach((Mt) => {
              Mt.rotation.x = -Z.open * 1.1;
            }),
            Z.open > 0.5 && Math.random() < T * 25)
          ) {
            let Mt = Z.mount.localToWorld(nt(0, 0, 0.02)),
              k = Z.n.clone().transformDirection(a.matrixWorld);
            m.emit(
              Mt,
              k.multiplyScalar(0.25 + Math.random() * 0.2),
              0.6,
              0.02 + Math.random() * 0.015,
              new Rt('#dfe6f2'),
              0.4,
              3,
            );
          }
        }
        m.update(T);
        let G = le((X - 10.8) / 0.9) * (1 - le((X - 15) / 0.7));
        ((x.base.rotation.y = 0),
          (x.sh.rotation.x = ye(-1.45, -0.05, G)),
          (x.el.rotation.x = ye(2.9, 0.15, G)),
          (x.wr.rotation.x = ye(-1.2, -0.1, G)));
        let D = le((X - 11.9) / 0.35) * (1 - le((X - 14.5) / 0.3));
        x.claw.set(ye(0.75, 0.15, G) * (1 - D) + 0.95 * D);
        let K = X > 9 && X < 10.5;
        E.lerp(K ? nt(0.6, 0.6, 0.9) : i.camera.position, 1 - Math.exp(-4 * T));
        let lt = u.parent.worldToLocal(E.clone()).sub(u.position);
        ((u.rotation.y = Xe(u.rotation.y, Math.atan2(lt.x, lt.z), 5, T)),
          (f.rotation.x = Xe(f.rotation.x, He(-Math.atan2(lt.y - 0.04, Math.hypot(lt.x, lt.z)), -0.8, 0.7), 5, T)));
        let it = [9.55, 10].some((Z) => X > Z && X < Z + 0.09) ? 1 : 0;
        (d.material.color.setScalar(it ? 40 : 1.5),
          (p.intensity = it ? 3 : 0),
          (b = X >= 6 && X < 9 ? 'step' : K ? 'view' : 'eyes'));
        let ot = (X - 6) / 3,
          $ = Math.min(3, Math.floor(ot * 4)),
          H = a.worldToLocal(i.camera.position.clone()).normalize();
        (s.draw(U, b, b === 'step' ? (ot * 4) % 1 : b === 'view' ? it * 0.7 : 0, $, {
          x: He(H.x, -1, 1),
          y: He(H.y, -1, 1),
        }),
          n.glow.color.set(O > 0.5 ? '#5fe3a0' : '#ff5f1f').multiplyScalar(2.4),
          g.copy(o.position).lerp(nt(0, 0.95, 0.15), 0.5),
          t.follow(nt(0, 0, 0)));
      }
      return (
        N(1 / 60, 0),
        {
          scene: e,
          sky: t.sky,
          update: N,
          focus: g,
          cam: {
            pos: nt(0.75, 0.15, 1.35),
            from: nt(1.6, 0.7, 2.6),
            fov: 38,
            near: 0.02,
            far: 200,
            min: 0.5,
            max: 5,
            maxPolar: Math.PI * 0.62,
          },
          clampCamera(T) {
            T.position.y < 0.1 && (T.position.y = 0.1);
          },
          exposure: 1,
          jointSize: 0.007,
        }
      );
    },
  };
  var Vn = 0.24;
  var Ji = 12;
  var kh = 4;
  var Zy = 1.15;
  var Jy = 15;
  var ec = 18;
  var Gh = 0.032;
  var zf = 0.022;
  var Wh = 22;
  var Hf = 0.026;
  var Ky = 0.008;
  var Vh = (i) => ye(1, 0.55, i / (ec - 1));
  var kf = (i) => ye(1, 0.4, i / (Wh - 1));
  function $y() {
    let e = document.createElement('canvas');
    ((e.width = 1024), (e.height = 64));
    let n = e.getContext('2d'),
      s = new Pn(e);
    ((s.colorSpace = Ze), (s.wrapS = hi));
    let r = new Float32Array(240).fill(0);
    function o(a, l) {
      ((n.fillStyle = '#04080c'), n.fillRect(0, 0, 1024, 64));
      let c = (u) => {
        let f = u % 1;
        return f < 0.04
          ? Math.sin((f / 0.04) * Math.PI) * 0.15
          : f < 0.08
            ? -0.15
            : f < 0.1
              ? 1
              : f < 0.13
                ? -0.35
                : f < 0.3
                  ? Math.sin(((f - 0.13) / 0.17) * Math.PI) * 0.22
                  : 0;
      };
      ((n.strokeStyle = '#5fe3a0'), (n.lineWidth = 3), n.beginPath());
      for (let u = 0; u < 300; u++) {
        let f = 35.2 - c(a * 1.15 - u / 120) * 64 * 0.4 * l;
        u ? n.lineTo(20 + u, f) : n.moveTo(20, f);
      }
      (n.stroke(),
        (n.font = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif'),
        (n.textBaseline = 'middle'),
        [
          ['心率', Math.round(ye(0, 68 + 2 * Math.sin(a * 0.3), l)), '#5fe3a0'],
          ['血压', l > 0.5 ? '118/76' : '--/--', '#5fb4ff'],
          ['血氧', l > 0.5 ? '98%' : '--', '#ffcf5f'],
          ['体温', l > 0.5 ? '36.6' : '--', '#ff9b5f'],
        ].forEach(([u, f, d], p) => {
          let x = 360 + p * 165;
          ((n.fillStyle = 'rgba(255,255,255,0.55)'),
            (n.font = '20px "PingFang SC","Microsoft YaHei",sans-serif'),
            n.fillText(u, x, 64 * 0.3),
            (n.fillStyle = d),
            (n.font = 'bold 28px "PingFang SC","Microsoft YaHei",sans-serif'),
            n.fillText(String(f), x, 64 * 0.7));
        }),
        (s.needsUpdate = !0));
    }
    return { tex: s, draw: o };
  }
  function Gf(i, t, e, n = 64) {
    let s = new Me(i, t, e, n, 2, 1);
    return (s.translate(i / 2, 0, 0), (s.userData.base = s.attributes.position.array.slice()), s);
  }
  function Vf(i, t, e) {
    let n = i.userData.base,
      s = i.attributes.position,
      r = e / Kt / Math.max(t, 0.001);
    for (let o = 0; o < s.count; o++) {
      let a = n[o * 3],
        l = n[o * 3 + 1],
        c = n[o * 3 + 2];
      if (t < 0.001) {
        s.setXYZ(o, a, l, c);
        continue;
      }
      let h = a / r,
        u = r - c;
      s.setXYZ(o, Math.sin(h) * u, l, r - Math.cos(h) * u);
    }
    ((s.needsUpdate = !0), i.computeVertexNormals());
  }
  var Wf = {
    id: 'jelly',
    name: '医护水母',
    accent: '#ff5f1f',
    size: '伞径 48 厘米',
    desc: '舱内体检机器人。透明伞盖里能看到泵和传感器，伞缘 12 根肋条一张一合推动它慢慢漂浮；四条器械腕分别是血压袖带、超声探头、指夹血氧仪和体温计，到位后袖带会卷成一圈；伞缘一圈屏幕显示心电图和各项读数。',
    build(i) {
      let t = ei(i, { shadow: 1.4 }),
        { scene: e } = t,
        n = ti('#ff5f1f'),
        s = $y(),
        r = new We({ map: s.tex, color: new Rt(1.6, 1.6, 1.6) }),
        o = new Fi({
          color: '#dfe9f2',
          roughness: 0.06,
          metalness: 0,
          transmission: 0,
          transparent: !0,
          opacity: 0.28,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          side: xn,
          depthWrite: !1,
        }),
        a = new Ne();
      e.add(a);
      let l = qt(a);
      i.joint(l, 6);
      let c = [];
      for (let R = 0; R <= 40; R++) {
        let A = R / 40,
          O = A * Math.PI * 0.5;
        c.push([Math.max(5e-4, Math.sin(O) * Vn * (1 + 0.04 * A)), Math.cos(O) * Vn * 0.7]);
      }
      {
        let R = new Xt(l);
        R.add(wt(c.slice().reverse(), 128), o);
        for (let G = 0; G < Ji; G++) {
          let D = (G / Ji) * Kt,
            K = c
              .filter((it, ot) => ot % 4 === 0)
              .map(([it, ot]) => nt(Math.sin(D) * it * 0.965, ot * 0.965, Math.cos(D) * it * 0.965)),
            lt = new Zs(K);
          R.add(new to(lt, 32, 0.004, 10, !1), n.shell2);
        }
        (R.add(
          wt(
            [
              [0, Vn * 0.7 + 0.016],
              [0.06, Vn * 0.7 + 0.012],
              [0.07, Vn * 0.7 + 0.002],
              [0.068, Vn * 0.7 - 0.01],
              [0.05, Vn * 0.7 - 0.014],
              [0, Vn * 0.7 - 0.014],
            ],
            96,
          ),
          n.shell,
        ),
          R.add(new jt(0.069, 0.0028, 8, 96), n.accent, {
            y: Vn * 0.7 - 0.002,
            rx: Math.PI / 2,
          }),
          R.add(cn(0.055, 12, 0.0022, 0.003, Vn * 0.7 + 0.014, 8), n.chrome),
          R.add(new Vt(0.016, 0.016, 0.006, 32), n.glow, { y: Vn * 0.7 + 0.017 }),
          R.add(
            wt(
              [
                [0, 0.02],
                [0.07, 0.02],
                [0.078, 0.03],
                [0.078, 0.1],
                [0.07, 0.11],
                [0, 0.11],
              ],
              72,
            ),
            n.frame,
          ),
          R.add(new jt(0.079, 0.003, 8, 72), n.accent, {
            y: 0.065,
            rx: Math.PI / 2,
          }));
        for (let G = 0; G < 6; G++) {
          let D = (G / 6) * Kt;
          (R.add(new Vt(0.008, 0.008, 0.07, 16), n.dark, {
            x: Math.sin(D) * 0.1,
            y: 0.07,
            z: Math.cos(D) * 0.1,
            rz: Math.cos(D) * 0.3,
            rx: -Math.sin(D) * 0.3,
          }),
            R.add(new ie(0.006, 12, 8), n.glow, {
              x: Math.sin(D) * 0.105,
              y: 0.11,
              z: Math.cos(D) * 0.105,
            }));
        }
        for (let G = 0; G < 3; G++)
          R.add(
            wt(
              [
                [0.03 - G * 0.006, 0.11 + G * 0.016],
                [0.034 - G * 0.006, 0.112 + G * 0.016],
                [0.034 - G * 0.006, 0.124 + G * 0.016],
                [0.03 - G * 0.006, 0.126 + G * 0.016],
              ],
              48,
            ),
            G === 1 ? n.shell : n.chrome,
          );
        for (let G = 0; G < 4; G++) {
          let D = (G / 4) * Kt + 0.4;
          R.add(new jt(0.05, 0.0025, 8, 32, Math.PI), n.dark, {
            x: Math.sin(D) * 0.12,
            y: 0.06,
            z: Math.cos(D) * 0.12,
            ry: D,
            rz: Math.PI / 2,
          });
        }
        let A = c[40][1],
          O = c[40][0];
        (R.add(
          wt(
            [
              [O * 0.98, A + 0.006],
              [O * 1.02, A + 0.004],
              [O * 1.04, A - 0.006],
              [O * 1.04, A - 0.032],
              [O * 1, A - 0.04],
              [O * 0.86, A - 0.04],
              [O * 0.84, A - 0.02],
              [O * 0.9, A + 0.004],
            ],
            160,
          ),
          n.shell,
        ),
          R.add(
            wt(
              [
                [O * 0.86, A - 0.04],
                [O * 1, A - 0.04],
                [O * 1, A - 0.046],
                [O * 0.86, A - 0.046],
              ],
              160,
            ),
            n.accent,
          ));
        let I = new ie(0.0022, 8, 6);
        for (let G = 0; G < 96; G++) {
          let D = (G / 96) * Kt;
          R.add(I, n.decal, {
            x: Math.sin(D) * O * 1.041,
            y: A - 0.003,
            z: Math.cos(D) * O * 1.041,
          });
        }
        (R.add(
          wt(
            [
              [O * 0.86, A - 0.04],
              [O * 0.7, A - 0.05],
              [O * 0.35, A - 0.06],
              [0, A - 0.062],
            ],
            128,
          ),
          n.dark,
        ),
          R.add(
            wt(
              [
                [0.05, A - 0.06],
                [0.048, A - 0.08],
                [0.03, A - 0.09],
                [0, A - 0.092],
              ],
              72,
            ),
            n.frame,
          ),
          R.add(new ie(0.024, 48, 16, 0, Kt, Math.PI / 2, Math.PI / 2), n.glass, {
            y: A - 0.086,
          }),
          R.done());
        let z = new oe(new Vt(O * 1.042, O * 1.042, 0.02, 160, 1, !0), r);
        ((z.position.y = A - 0.019), l.add(z), (l.userData.yr = A), (l.userData.rr = O));
      }
      let h = l.userData.yr,
        u = l.userData.rr,
        f = [];
      for (let R = 0; R < Ji; R++) {
        let A = ((R + 0.5) / Ji) * Kt,
          O = qt(l, Math.sin(A) * u * 0.98, h - 0.04, Math.cos(A) * u * 0.98);
        O.rotation.y = A;
        let I = O,
          z = [];
        for (let G = 0; G < kh; G++) {
          let D = qt(I, 0, G ? -0.05 : 0, 0);
          i.joint(D, 1);
          let K = new Xt(D);
          (K.add(new Vt(0.0055, 0.0055, 0.016, 16), n.chrome, {
            rz: Math.PI / 2,
          }),
            K.add(Ft(0.012, 0.05, 0.008, 0.003, 3), G % 2 ? n.shell2 : n.shell, {
              y: -0.025,
            }),
            G === kh - 1 && K.add(new ie(0.006, 16, 10), n.accent, { y: -0.05 }),
            K.done(),
            z.push(D),
            (I = D));
        }
        f.push({ a: A, base: O, segs: z });
      }
      let d = new Re(),
        p = kh * 3,
        x = 6,
        m = (p + 1) * (x + 1),
        g = new Float32Array(m * Ji * 3),
        M = [];
      for (let R = 0; R < Ji; R++)
        for (let A = 0; A < p; A++)
          for (let O = 0; O < x; O++) {
            let I = R * m + A * (x + 1) + O,
              z = I + x + 1;
            M.push(I, z, I + 1, z, z + 1, I + 1);
          }
      (d.setAttribute('position', new Ue(g, 3).setUsage(Kn)), d.setIndex(M));
      let E = new Fi({
          color: '#f6efe6',
          roughness: 0.35,
          transparent: !0,
          opacity: 0.32,
          side: xn,
          depthWrite: !1,
          clearcoat: 0.6,
        }),
        y = new oe(d, E);
      ((y.frustumCulled = !1), e.add(y));
      let C = Array.from({ length: ec }, (R, A) => Gh * Vh(A)),
        w = [new Mn(e, Si(n, zf, Gh, 0, 48), (4 * ec) / 2), new Mn(e, Si(n, zf, Gh, 1, 48), (4 * ec) / 2)],
        b = ['cuff', 'probe', 'clip', 'thermo'].map((R, A) => {
          let O = ((A + 0.5) / 4) * Kt + Math.PI / 4,
            I = nt(Math.sin(O), 0, Math.cos(O)),
            z = qt(l, I.x * 0.1, h - 0.058, I.z * 0.1),
            G = nt(I.x * 0.35, -1, I.z * 0.35).normalize(),
            D = I.clone().negate().addScaledVector(G, G.dot(I)).normalize();
          (z.quaternion.setFromRotationMatrix(new Wt().makeBasis(nt().crossVectors(G, D), G, D)), i.joint(z, 2));
          let K = new Mi(i, e, { lens: C, socket: z, prevJoint: z }),
            lt = qt(K.tip),
            it = new Xt(lt);
          (it.add(
            wt(
              [
                [0, -0.008],
                [0.019, -0.008],
                [0.022, 0.004],
                [0.022, 0.012],
                [0.018, 0.016],
                [0, 0.016],
              ],
              48,
            ),
            n.frame,
          ),
            it.add(new jt(0.0222, 0.0024, 8, 48), n.accent, {
              y: 0.006,
              rx: Math.PI / 2,
            }));
          let ot = { kind: R, a: O, out: I, sock: z, arm: K, head: lt, curl: 1 };
          if (R === 'cuff') {
            (it.add(Ft(0.04, 0.03, 0.016, 0.006, 4), n.shell, { y: 0.03 }),
              it.add(Ft(0.028, 0.006, 0.002, 0.002, 1), n.glow, {
                y: 0.03,
                z: 0.0085,
              }));
            let $ = Gf(0.24, 0.06, 0.008),
              H = new oe($, n.cuff || (n.cuff = new ln({ color: '#3b4a63', roughness: 0.85 })));
            H.castShadow = !0;
            let Z = qt(lt, 0, 0.046, 0);
            (Z.rotation.set(0, 0, Math.PI / 2), Z.add(H));
            let mt = new oe(Gf(0.24, 0.02, 0.0085), n.foil2);
            ((mt.position.y = 0),
              Z.add(mt),
              Object.assign(ot, {
                cuff: H,
                strip: mt,
                g: $,
                gs: mt.geometry,
                curl: 1,
              }));
          } else if (R === 'probe')
            (it.add(
              wt(
                [
                  [0.012, 0.016],
                  [0.016, 0.03],
                  [0.016, 0.07],
                  [0.022, 0.085],
                  [0.024, 0.095],
                  [0.02, 0.1],
                  [0, 0.101],
                ],
                64,
              ),
              n.shell,
            ),
              it.add(Ft(0.04, 0.008, 0.016, 0.004, 3), n.rubber, { y: 0.101 }),
              it.add(new jt(0.0162, 0.002, 8, 48), n.accent, {
                y: 0.05,
                rx: Math.PI / 2,
              }),
              it.add(new Vt(0.003, 0.003, 0.03, 10), n.dark, {
                x: 0.014,
                y: 0.04,
              }));
          else if (R === 'clip') {
            let $ = qt(lt, 0, 0.02, 0);
            (i.joint($, 1),
              it.add(Ft(0.026, 0.028, 0.02, 0.006, 4), n.shell, { y: 0.03 }),
              it.add(Ft(0.016, 0.008, 0.0025, 0.002, 1), n.glow, {
                y: 0.034,
                z: 0.0105,
              }));
            let H = new Xt($);
            (H.add(Ft(0.026, 0.008, 0.026, 0.004, 3), n.shell2, {
              y: 0.034,
              z: -0.002,
            }),
              H.add(Ft(0.02, 0.004, 0.02, 0.002, 2), n.rubber, {
                y: 0.03,
                z: -0.002,
              }),
              H.done(),
              (ot.jaw = $));
          } else
            (it.add(
              wt(
                [
                  [0.012, 0.016],
                  [0.01, 0.03],
                  [0.006, 0.07],
                  [0.004, 0.09],
                  [0.0035, 0.1],
                  [0, 0.104],
                ],
                48,
              ),
              n.shell2,
            ),
              it.add(new ie(0.004, 16, 10), n.chrome, { y: 0.103 }),
              it.add(Ft(0.012, 0.016, 0.004, 0.002, 1), n.glow, {
                y: 0.03,
                z: 0.011,
              }));
          return (it.done(), ot);
        }),
        W = Array.from({ length: Wh }, (R, A) => Hf * kf(A)),
        N = (() => {
          let R = new Xt(),
            A = Ky,
            O = Hf;
          return (
            R.add(
              wt(
                [
                  [A * 0.8, 0],
                  [A, O * 0.15],
                  [A, O * 0.85],
                  [A * 0.8, O],
                ],
                24,
              ),
              n.shell,
            ),
            R.add(new jt(A * 1.02, A * 0.18, 6, 24), n.accent, {
              y: O * 0.5,
              rx: Math.PI / 2,
            }),
            R.add(new Vt(A * 0.5, A * 0.5, O, 12), n.dark, { y: O / 2 }),
            R.geos()
          );
        })(),
        T = [];
      for (let R = 0; R < 8; R++) {
        let A = ((R + 0.25) / 8) * Kt,
          O = qt(l, Math.sin(A) * u * 0.82, h - 0.046, Math.cos(A) * u * 0.82);
        ((O.rotation.x = Math.PI), i.joint(O, 2));
        let I = new Mi(i, e, { lens: W, socket: O, prevJoint: O }),
          z = new oe(new ie(0.006, 16, 10), n.glow);
        (I.tip.add(z), T.push({ a: A, sock: O, arm: I, ph: R * 1.3 }));
      }
      let U = new Mn(e, N, 8 * Wh),
        X = nt(),
        L = (R, A, O) => l.localToWorld(nt(R, A, O)),
        Y = (R, A, O) => nt(R, A, O).normalize().transformDirection(l.matrixWorld),
        j = {
          cuff: { p: [0, -0.42, 0.2], d: [0, 0, 1] },
          probe: { p: [-0.14, -0.36, 0.26], d: [0.2, -0.3, 1] },
          clip: { p: [0.16, -0.46, 0.22], d: [0, -0.2, 1] },
          thermo: { p: [-0.04, -0.3, 0.3], d: [0, 0.2, 1] },
        };
      function J(R, A) {
        let O = A % Jy,
          I = le((O - 3.5) / 1.4) * (1 - le((O - 12.2) / 1.2)),
          z = le((O - 6.2) / 1.5) * (1 - le((O - 12) / 0.6)),
          G = ye(0.9, 0.35, I),
          D = (A * G) % 1,
          K = D < 0.3 ? le(D / 0.3) : 1 - le((D - 0.3) / 0.7),
          lt = ye(1, 0.35, I);
        (a.position.set(
          0.04 * Math.sin(A * 0.21),
          Zy + 0.04 * Math.sin(A * G * Kt - 1.2) * lt,
          0.04 * Math.sin(A * 0.17),
        ),
          l.rotation.set(
            0.06 * Math.sin(A * 0.33) * (1 - I) + 0.12 * I,
            0.25 * Math.sin(A * 0.09),
            0.05 * Math.sin(A * 0.27),
          ),
          l.scale.set(1 - 0.05 * K * lt, 1 + 0.035 * K * lt, 1 - 0.05 * K * lt),
          a.updateMatrixWorld(!0));
        for (let st of f)
          st.segs.forEach((_t, gt) => {
            _t.rotation.x =
              ye(gt ? -0.12 : -0.42, gt ? 0.2 : 0.3, K * lt) + (gt ? 0.06 : 0) * Math.sin(A * 2 - st.a * 2 + gt);
          });
        a.updateMatrixWorld(!0);
        let it = (st) => {
            let _t = [st.base.getWorldPosition(nt())];
            for (let gt of st.segs) _t.push(gt.localToWorld(nt(0, -0.05, 0)));
            return _t;
          },
          ot = f.map(it),
          $ = (st, _t, gt) => {
            let Ot = _t * (st.length - 1),
              Dt = Math.min(st.length - 2, Math.floor(Ot));
            return gt.lerpVectors(st[Dt], st[Dt + 1], Ot - Dt);
          },
          H = nt(),
          Z = nt(),
          mt = nt();
        for (let st = 0; st < Ji; st++) {
          let _t = ot[st],
            gt = ot[(st + 1) % Ji];
          for (let Ot = 0; Ot <= p; Ot++) {
            let Dt = Ot / p;
            ($(_t, Dt, H), $(gt, Dt, Z));
            for (let $t = 0; $t <= x; $t++) {
              let te = $t / x;
              mt.lerpVectors(H, Z, te);
              let me = Math.sin(Math.PI * te) * Dt * 0.012,
                q = a.position.clone().sub(mt).setY(0).normalize();
              mt.addScaledVector(q, me);
              let Ce = (st * m + Ot * (x + 1) + $t) * 3;
              ((g[Ce] = mt.x), (g[Ce + 1] = mt.y), (g[Ce + 2] = mt.z));
            }
          }
        }
        ((d.attributes.position.needsUpdate = !0), d.computeVertexNormals());
        for (let st of b) {
          let _t = Y(st.out.x, 0, st.out.z),
            gt = Math.sin(A * 0.9 + st.a * 2),
            Ot = L(st.out.x * 0.16, -0.36 + 0.03 * gt, st.out.z * 0.16),
            Dt = Y(st.out.x * 0.4, -1, st.out.z * 0.4)
              .add(_t.clone().multiplyScalar(0.3 * gt))
              .normalize(),
            $t = j[st.kind],
            te = L(...$t.p),
            me = Y(...$t.d),
            q = Ot.lerp(te, I),
            Ce = Dt.lerp(me, I).normalize();
          if (
            (st.arm.solve(q.clone().addScaledVector(Ce, -0.03), Ce, {
              curl: _t.clone().multiplyScalar(0.05 + 0.06 * I),
            }),
            st.kind === 'cuff')
          ) {
            let he = le((O - 3.6) / 0.8) * (1 - le((O - 5) / 0.9)) + le((O - 11.4) / 0.5) * (1 - le((O - 12.6) / 0.8));
            ((st.curl = Xe(st.curl, 1 - 0.75 * he, 6, R)),
              Vf(st.g, st.curl * 0.86, 0.24),
              Vf(st.gs, st.curl * 0.86, 0.24),
              st.cuff.scale.set(1, 1, 1 + 0.25 * z * (0.5 + 0.5 * Math.sin(A * 1.4))));
          }
          (st.jaw && (st.jaw.rotation.x = ye(-0.7, -0.05, le((O - 5.2) / 0.5) * (1 - le((O - 11.6) / 0.5)))),
            st.head.updateMatrixWorld(!0));
        }
        for (let st of T) {
          let _t = st.sock.getWorldPosition(nt()),
            gt = _t.clone().sub(a.position).setY(0).normalize(),
            Ot = Math.sin(A * 1.1 + st.ph),
            Dt = Math.cos(A * 0.8 + st.ph * 1.7),
            $t = _t
              .clone()
              .add(nt(0, -0.45 - 0.05 * Dt, 0))
              .addScaledVector(gt, 0.06 + 0.04 * Ot + 0.06 * K * lt),
            te = nt(gt.x * 0.2 + 0.25 * Ot, -1, gt.z * 0.2 + 0.25 * Dt).normalize();
          st.arm.solve($t, te, { curl: gt.clone().multiplyScalar(0.04) });
        }
        (s.draw(A, z), n.glow.color.set(z > 0.5 ? '#5fe3a0' : '#ff5f1f').multiplyScalar(2.4 + 0.6 * K));
        let Mt = 0,
          k = 0;
        for (let st of b)
          st.arm.joints.forEach((_t, gt) => {
            gt % 2 ? w[1].set(k++, _t, Vh(gt)) : w[0].set(Mt++, _t, Vh(gt));
          });
        (w[0].commit(), w[1].commit());
        let ht = 0;
        for (let st of T) st.arm.joints.forEach((_t, gt) => U.set(ht++, _t, kf(gt)));
        (U.commit(), X.copy(a.position).add(nt(0, -0.18, 0)), t.follow(nt(0, 0, 0)));
      }
      return (
        J(1 / 60, 0),
        {
          scene: e,
          sky: t.sky,
          update: J,
          focus: X,
          cam: {
            pos: nt(0.9, 0.05, 1.55),
            from: nt(1.8, 0.8, 3),
            fov: 38,
            near: 0.02,
            far: 200,
            min: 0.6,
            max: 5,
            maxPolar: Math.PI * 0.62,
          },
          clampCamera(R) {
            R.position.y < 0.1 && (R.position.y = 0.1);
          },
          exposure: 1,
          jointSize: 0.007,
        }
      );
    },
  };
  var nc = 16;
  var Xh = 0.045;
  var Xf = 0.034;
  var Yf = 0.85;
  var qh = (i) => ye(1, 0.55, i / (nc - 1));
  var ke = 0.2;
  var qf = 0.2;
  var jy = 0.56;
  var Qy = 17;
  var Yh = 0.062 * Yf;
  function tv(i) {
    let t = new Ne(),
      e = new Xt(t);
    e.add(
      wt(
        [
          [0, 0],
          [0.042, 0],
          [0.046, 0.006],
          [0.046, 0.094],
          [0.042, 0.1],
          [0, 0.1],
        ],
        64,
      ),
      i.shell,
    );
    for (let n of [0.012, 0.088])
      e.add(
        wt(
          [
            [0.046, n - 0.006],
            [0.049, n - 0.004],
            [0.049, n + 0.004],
            [0.046, n + 0.006],
          ],
          64,
        ),
        i.frame,
      );
    (e.add(new Vt(0.0465, 0.0465, 0.03, 64, 1, !0), i.accent, { y: 0.05 }),
      e.add(Ft(0.03, 0.022, 0.004, 0.002, 1), i.decal, { y: 0.065, z: 0.046 }));
    for (let n = 0; n < 4; n++)
      e.add(new Me(0.0025, 0.016, 0.003), i.decal, {
        x: -0.012 + n * 0.006,
        y: 0.032,
        z: 0.0465,
      });
    return (
      e.add(
        wt(
          [
            [0, 0.1],
            [0.028, 0.1],
            [0.03, 0.106],
            [0.022, 0.112],
            [0, 0.112],
          ],
          48,
        ),
        i.dark,
      ),
      e.add(new jt(0.014, 0.0035, 10, 32), i.chrome, { y: 0.122 }),
      e.add(new ie(0.0045, 12, 8), i.glow, { y: 0.106, z: 0.024 }),
      e.done(),
      (t.userData.handle = nt(0, 0.122, 0)),
      t
    );
  }
  var Zf = {
    id: 'star',
    name: '理货海星',
    accent: '#ff5f1f',
    size: '展开 1.3 米',
    desc: '舱内理货机器人。五条腕各 16 节，腕尖是三指爪，张开时当脚用，五条腕轮流迈步，在舱壁或地板上爬行；背上的舱盖打开后，升降台把样品罐托上来，一条腕抓起罐子递出，用完再放回去锁好。',
    build(i) {
      let t = ei(i, { shadow: 1.3 }),
        { scene: e } = t,
        n = ti('#ff5f1f'),
        s = new Ne();
      (e.add(s), i.joint(s, 6));
      {
        let z = new Xt(s),
          G = [];
        for (let it = 0; it <= 30; it++) {
          let ot = it / 30,
            $ = 0.35 + ot * (Math.PI * 0.5 - 0.35);
          G.push([Math.max(5e-4, Math.sin($) * ke), Math.cos($) * ke * 0.42]);
        }
        let D = 0.014;
        for (let it = 0; it < 5; it++) {
          let ot = (it / 5) * Kt - Kt / 10 + D / 2;
          z.add(new pi(G.map(([$, H]) => new pt($, H)).reverse(), 30, ot, Kt / 5 - D), it % 2 ? n.shell2 : n.shell);
        }
        z.add(
          wt(
            G.map(([it, ot]) => [it * 0.975, ot * 0.93 - 0.003]),
            96,
          ),
          n.dark,
        );
        let K = new ie(0.0024, 8, 6);
        for (let it = 0; it < 5; it++) {
          let ot = (it / 5) * Kt - Kt / 10;
          for (let $ = 3; $ < 29; $ += 2) {
            let [H, Z] = G[$];
            for (let mt of [-1, 1]) {
              let Mt = ot + mt * 0.035;
              z.add(K, n.decal, {
                x: Math.sin(Mt) * (H + 0.001),
                y: Z,
                z: Math.cos(Mt) * (H + 0.001),
              });
            }
          }
        }
        let lt = G[0][1];
        (z.add(
          wt(
            [
              [0.062, lt + 0.004],
              [0.075, lt + 0.006],
              [0.078, lt - 0.004],
              [0.07, lt - 0.012],
            ],
            96,
          ),
          n.frame,
        ),
          z.add(new jt(0.076, 0.0028, 8, 96), n.accent, {
            y: lt + 0.004,
            rx: Math.PI / 2,
          }),
          z.add(cn(0.069, 16, 0.002, 0.003, lt + 0.007, 8), n.chrome),
          z.add(
            wt(
              [
                [ke * 0.99, 0.004],
                [ke * 1.03, 0],
                [ke * 1.04, -0.012],
                [ke * 1.04, -0.034],
                [ke * 1, -0.044],
                [ke * 0.9, -0.046],
              ],
              160,
            ),
            n.shell2,
          ),
          z.add(
            wt(
              [
                [ke * 1.041, -0.018],
                [ke * 1.045, -0.02],
                [ke * 1.045, -0.026],
                [ke * 1.041, -0.028],
              ],
              160,
            ),
            n.accent,
          ));
        for (let it = 0; it < 80; it++) {
          let ot = (it / 80) * Kt;
          z.add(K, n.decal, {
            x: Math.sin(ot) * ke * 1.042,
            y: -0.006,
            z: Math.cos(ot) * ke * 1.042,
          });
        }
        for (let it = 0; it < 5; it++) {
          let ot = ((it + 0.5) / 5) * Kt;
          (z.add(qi(0.05, 0.016, 4, 0.004, 0.45), n.decal, {
            x: Math.sin(ot) * ke * 1.045,
            y: -0.03,
            z: Math.cos(ot) * ke * 1.045,
            ry: ot,
          }),
            z.add(new ie(0.003, 10, 8), n.glow, {
              x: Math.sin(ot + 0.25) * ke * 1.046,
              y: -0.03,
              z: Math.cos(ot + 0.25) * ke * 1.046,
            }));
        }
        (z.add(
          wt(
            [
              [ke * 0.9, -0.046],
              [ke * 0.7, -0.06],
              [ke * 0.3, -0.07],
              [0, -0.072],
            ],
            128,
          ),
          n.dark,
        ),
          z.add(
            wt(
              [
                [0.04, -0.07],
                [0.038, -0.085],
                [0.024, -0.092],
                [0, -0.093],
              ],
              64,
            ),
            n.frame,
          ),
          z.add(new ie(0.02, 48, 16, 0, Kt, Math.PI / 2, Math.PI / 2), n.glass, {
            y: -0.088,
          }),
          z.add(Ft(0.05, 0.004, 0.026, 0.003, 2), n.accent, {
            x: 0.1,
            y: 0.058,
            z: 0.05,
            rz: -0.4,
            ry: 0.5,
            order: 'YXZ',
          }));
        for (let it = 0; it < 4; it++)
          z.add(new Me(0.035, 0.003, 0.003), n.decal, {
            x: -0.11 + it * 0,
            y: 0.055 - it * 0.006,
            z: -0.05 - it * 0.008,
            ry: -0.6,
          });
        (z.done(), (s.userData.yh = lt));
      }
      let r = s.userData.yh,
        o = qt(s, 0, r + 0.008, -0.066);
      i.joint(o, 1);
      {
        let z = new Xt(o);
        (z.add(
          wt(
            [
              [0, 0.012],
              [0.04, 0.01],
              [0.062, 0.004],
              [0.066, -0.002],
              [0, -0.002],
            ],
            96,
          ),
          n.shell,
          { z: 0.066 },
        ),
          z.add(new jt(0.03, 0.004, 10, 48, Math.PI), n.frame, {
            z: 0.066,
            y: 0.012,
          }),
          z.add(new Vt(0.006, 0.006, 0.05, 20), n.chrome, { rz: Math.PI / 2 }));
        for (let G = 0; G < 5; G++)
          z.add(new Me(0.003, 0.002, 0.03), n.decal, {
            x: -0.016 + G * 0.008,
            y: 0.012,
            z: 0.1,
          });
        z.done();
      }
      let a = qt(s, 0, -0.055, 0);
      i.joint(a, 1);
      {
        let z = new Xt(a);
        (z.add(
          wt(
            [
              [0, 0],
              [0.056, 0],
              [0.058, -0.004],
              [0.058, -0.012],
              [0, -0.012],
            ],
            72,
          ),
          n.frame,
        ),
          z.add(new jt(0.05, 0.002, 8, 72), n.accent, {
            y: 0.001,
            rx: Math.PI / 2,
          }));
        for (let G = 0; G < 3; G++) {
          let D = (G / 3) * Kt;
          z.add(new Vt(0.004, 0.004, 0.04, 12), n.chrome, {
            x: Math.sin(D) * 0.04,
            y: -0.032,
            z: Math.cos(D) * 0.04,
          });
        }
        z.done();
      }
      let l = qt(s, 0, -0.062, 0);
      {
        let z = new Xt(l),
          G = [];
        for (let K = 0; K <= 24; K++) G.push([K % 2 ? 0.024 : 0.03, K / 24]);
        (z.add(wt(G, 48), n.rubber), z.done());
        let D = new Xt(s);
        for (let K = 0; K < 3; K++) {
          let lt = (K / 3) * Kt + 0.5;
          D.add(
            wt(
              [
                [0.006, 0],
                [0.008, 0.004],
                [0.008, 0.11],
                [0.006, 0.114],
              ],
              16,
            ),
            n.chrome,
            { x: Math.sin(lt) * 0.048, y: -0.062, z: Math.cos(lt) * 0.048 },
          );
        }
        D.done();
      }
      let c = tv(n);
      e.add(c);
      let h = new Wt(),
        u = new fr(c, a, h),
        f = Array.from({ length: nc }, (z, G) => Xh * qh(G)),
        d = [new Mn(e, Si(n, Xf, Xh, 0), (5 * nc) / 2), new Mn(e, Si(n, Xf, Xh, 1), (5 * nc) / 2)],
        p = [],
        x = new Xt(s);
      for (let z = 0; z < 5; z++) {
        let G = (z / 5) * Kt,
          D = nt(Math.sin(G), 0, Math.cos(G)),
          K = qt(s, D.x * ke * 0.86, -0.03, D.z * ke * 0.86),
          lt = nt(D.x * 0.85, 0.35, D.z * 0.85).normalize(),
          it = nt(0, -1, 0).addScaledVector(lt, lt.y).normalize();
        (K.quaternion.setFromRotationMatrix(new Wt().makeBasis(nt().crossVectors(lt, it), lt, it)), i.joint(K, 2));
        let ot = new an().setFromQuaternion(K.quaternion),
          $ = (k) => nt(0, k, 0).applyQuaternion(K.quaternion).add(K.position),
          H = $(-0.012),
          Z = $(0.014);
        (x.add(
          wt(
            [
              [0, -0.026],
              [0.044, -0.026],
              [0.049, -0.014],
              [0.049, 0.018],
              [0.042, 0.026],
              [0, 0.026],
            ],
            64,
          ),
          n.shell,
          { x: H.x, y: H.y, z: H.z, rx: ot.x, ry: ot.y, rz: ot.z },
        ),
          x.add(new jt(0.0495, 0.0032, 8, 64), n.accent, {
            x: Z.x,
            y: Z.y,
            z: Z.z,
            rx: ot.x,
            ry: ot.y,
            rz: ot.z,
          }),
          x.add(cn(0.038, 10, 0.0025, 0.004, 0, 8), n.chrome, {
            x: Z.x,
            y: Z.y,
            z: Z.z,
            rx: ot.x,
            ry: ot.y,
            rz: ot.z,
          }));
        let mt = new Mi(i, e, { lens: f, socket: K, prevJoint: K }),
          Mt = Yi(i, mt.tip, n, Yf);
        p.push({
          i: z,
          a: G,
          out: D,
          sock: K,
          arm: mt,
          cl: Mt,
          planted: nt(),
          from: nt(),
          to: nt(),
          t: 0,
          stepping: !1,
          g: 0,
        });
      }
      x.done();
      let m = new hr(200, { map: Vl(), additive: !1, drag: 2, gravity: 0 });
      e.add(m.points);
      let g = nt(),
        M = nt(),
        E = nt(0, 1, 0),
        y = nt(0, -1, 0),
        C = 0.55,
        w = 0,
        _ = 0,
        b = 0,
        W = nt(),
        N = nt(),
        T = !0,
        U = (z, G, D) => s.localToWorld(nt(z, G, D)),
        X = (z, G = 1) => {
          let D = s.localToWorld(
            z.out
              .clone()
              .multiplyScalar(jy * G)
              .setY(-qf),
          );
          return ((D.y = Yh), D);
        },
        L = (z) => ({ p: z.planted.clone().setY(0), d: y.clone(), g: 0 }),
        Y = () => c.localToWorld(c.userData.handle.clone()),
        j = () => p[0],
        J = nt(),
        R = [
          [10.6, () => L(j())],
          [
            11.3,
            () => ({
              p: U(0, 0.34, 0.12),
              d: nt(0, -1, 0.3).normalize(),
              g: 0.2,
            }),
          ],
          [11.9, () => ({ p: Y().add(nt(0, 0.06, 0)), d: y.clone(), g: 0.1 })],
          [12.2, () => ({ p: Y(), d: y.clone(), g: 0.1 })],
          [12.45, () => ({ p: Y(), d: y.clone(), g: 0.9 })],
          [12.9, () => ({ p: U(0, 0.36, 0.05), d: y.clone(), g: 0.9 })],
          [13.7, () => ({ p: U(0, 0.38, 0.4), d: nt(0, -0.4, 1).normalize(), g: 0.9 })],
          [
            14.6,
            () => ({
              p: U(0, 0.38, 0.42),
              d: nt(0, -0.4, 1).normalize(),
              g: 0.9,
            }),
          ],
          [15.3, () => ({ p: U(0, 0.38, 0), d: y.clone(), g: 0.9 })],
          [15.6, () => ({ p: U(0, r + 0.14 + 0.122, 0), d: y.clone(), g: 0.9 })],
          [15.8, () => ({ p: U(0, r + 0.14 + 0.122, 0), d: y.clone(), g: 0.1 })],
          [
            16.1,
            () => ({
              p: U(0, 0.34, 0.08),
              d: nt(0, -1, 0.3).normalize(),
              g: 0.1,
            }),
          ],
          [16.7, () => ({ p: X(j()).setY(0), d: y.clone(), g: 0 })],
        ],
        A = 0;
      function O(z, G) {
        let D = G % Qy,
          K = (k) => A < k && D >= k;
        if ((D < A && u.attach(a, h, !0), K(12.45))) {
          let k = new Wt().multiplyMatrices(new Wt().copy(j().cl.grip.matrixWorld).invert(), c.matrixWorld);
          u.attach(j().cl.grip, k);
        }
        (K(15.8) && u.attach(a, h), (A = D), (_ = Xe(_, D < 9.2 ? 0.16 : 0, 3, z)), (w += (_ * z) / C));
        let lt = nt(Math.sin(w) * C, 0, Math.cos(w) * C - C * 0.3),
          it = nt(Math.cos(w), 0, -Math.sin(w)),
          ot = Math.atan2(it.x, it.z) + 0.3;
        T ? (b = ot) : (b += Math.atan2(Math.sin(ot - b), Math.cos(ot - b)) * (1 - Math.exp(-1.2 * z)));
        let $ = p.filter((k) => k.stepping).length,
          H = le((D - 9.8) / 0.6) * (1 - le((D - 16.4) / 0.5));
        (s.position.set(lt.x, qf + 0.012 * Math.sin(G * 2.4) - 0.01 * $ + 0.03 * H, lt.z),
          s.rotation.set(0.02 * Math.sin(G * 1.3), b, 0.02 * Math.sin(G * 1.1), 'YXZ'),
          s.updateMatrixWorld(!0),
          N.copy(s.position).sub(W).divideScalar(Math.max(z, 1e-4)).setY(0),
          W.copy(s.position),
          T && N.set(0, 0, 0),
          (o.rotation.x = -1.9 * le((D - 10) / 0.6) * (1 - le((D - 16.3) / 0.6))),
          (a.position.y = ye(-0.055, r + 0.14, le((D - 10.4) / 0.8) * (1 - le((D - 15.95) / 0.5)))),
          (l.scale.y = Math.max(0.004, a.position.y - 0.012 + 0.062)));
        let Z = D >= 10.6 && D < 16.7;
        for (let k of p) {
          if ((k.cur || ((k.cur = X(k)), k.planted.copy(k.cur)), k.i === 0 && Z)) continue;
          let ht = X(k, Z ? 1.08 : 1).addScaledVector(N, 0.4);
          if (((ht.y = Yh), k.stepping)) {
            ((k.t += z / 0.42), k.to.lerp(ht, 0.2));
            let st = le(Math.min(k.t, 1));
            if (
              (k.cur.lerpVectors(k.from, k.to, st),
              (k.cur.y += Math.sin(Math.PI * Math.min(k.t, 1)) * 0.12),
              (k.g = Math.sin(Math.PI * Math.min(k.t, 1)) * 0.35),
              k.t >= 1)
            ) {
              ((k.stepping = !1), k.planted.copy(k.to), k.cur.copy(k.to), (k.g = 0));
              for (let _t = 0; _t < 4; _t++)
                m.emit(
                  nt(k.to.x, 0.01, k.to.z),
                  nt((Math.random() - 0.5) * 0.2, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.2),
                  0.8,
                  0.03 + Math.random() * 0.02,
                  new Rt('#aab3c2'),
                  0.25,
                  2,
                );
            }
          } else {
            k.cur.copy(k.planted);
            let st = Math.hypot(k.planted.x - ht.x, k.planted.z - ht.z),
              gt =
                ![p[(k.i + 1) % 5], p[(k.i + 4) % 5]].some((Ot) => Ot.stepping) &&
                p.filter((Ot) => Ot.stepping).length < 2;
            ((st > 0.09 && gt) || st > 0.2) && ((k.stepping = !0), (k.t = 0), k.from.copy(k.planted), k.to.copy(ht));
          }
          (k.arm.solve(k.cur, y, {
            curl: E.clone().multiplyScalar(0.12).addScaledVector(k.out.clone().transformDirection(s.matrixWorld), 0.04),
          }),
            k.cl.set(k.g));
        }
        if (Z) {
          let k = j(),
            ht = $l(R, D, le);
          (k.arm.solve(ht.p.clone().addScaledVector(ht.d, -Yh), ht.d, {
            curl: E.clone().multiplyScalar(0.1),
          }),
            k.cl.set(ht.g),
            D > 16.6 && (k.planted.copy(X(k)), (k.cur = k.planted.clone())));
        }
        (u.settle(6, z),
          u.update(),
          (T = !1),
          m.update(z),
          n.glow.color.set(H > 0.5 ? '#5fe3a0' : '#ff5f1f').multiplyScalar(2.4 + 0.5 * Math.sin(G * 2.5)));
        let mt = 0,
          Mt = 0;
        for (let k of p)
          k.arm.joints.forEach((ht, st) => {
            st % 2 ? d[1].set(Mt++, ht, qh(st)) : d[0].set(mt++, ht, qh(st));
          });
        (d[0].commit(), d[1].commit(), g.copy(s.position).add(nt(0, 0.02 + 0.08 * H, 0)), t.follow(nt(0, 0, 0)));
      }
      O(1 / 60, 1 / 60);
      let I = () => {
        let z = (G) => G.toArray().map((D) => +D.toFixed(3));
        return [
          {
            can: z(c.getWorldPosition(nt())),
            canM: z(nt().setFromMatrixPosition(c.matrixWorld)),
            lift: z(a.getWorldPosition(nt())),
            body: z(s.position),
            holder: u.holder === a ? 'lift' : 'other',
            canParent: c.parent?.type,
            tips: p.map((G) => z(G.arm.tip.getWorldPosition(nt()))),
          },
        ];
      };
      return {
        scene: e,
        sky: t.sky,
        update: O,
        focus: g,
        debug: I,
        cam: {
          pos: nt(0.95, 0.65, 1.35),
          from: nt(1.8, 1.4, 2.6),
          fov: 38,
          near: 0.02,
          far: 200,
          min: 0.6,
          max: 5,
          maxPolar: Math.PI * 0.47,
        },
        clampCamera(z) {
          z.position.y < 0.08 && (z.position.y = 0.08);
        },
        exposure: 1,
        jointSize: 0.008,
      };
    },
  };
  var ic = 0.035;
  var Wn = 0.11;
  var Ei = 0.12;
  var pr = 0.014;
  var Jf = 0.078;
  var mr = 16;
  var ev = 16;
  var Zh = (i) => ye(1, 0.36, i / (mr - 1));
  var Jh = 0.036;
  function Kf(i, t, e, n, s, r, o = {}) {
    let a = [
      [0, -s / 2],
      [0.62, -s / 2],
      [0.92, -s / 2 + s * 0.14],
      [1, -s / 2 + s * 0.32],
      [1, s / 2 - s * 0.32],
      [0.92, s / 2 - s * 0.14],
      [0.62, s / 2],
      [0, s / 2],
    ];
    i.add(wt(a, 72), t, { rx: Math.PI / 2, z: r, s: [e, 1, n], ...o });
  }
  function nv(i, t, e, n, s, r, o) {
    (Kf(i, t.dark, e * 0.94, n * 0.9, s * 1.04, r),
      i.add(
        Es(
          [
            [r - s * 0.46, n * 0.45],
            [r + s * 0.46, n * 0.45],
            [r + s * 0.4, n * 0.98],
            [r - s * 0.3, n * 1.04],
          ],
          e * 1.55,
          0.006,
          3,
        ),
        o % 2 ? t.shell2 : t.shell,
      ),
      i.add(
        Es(
          [
            [r - s * 0.4, n * 1],
            [r + s * 0.36, n * 0.96],
            [r + s * 0.32, n * 1.02],
            [r - s * 0.32, n * 1.06],
          ],
          e * 0.28,
          0.002,
          1,
        ),
        t.accent,
      ));
    let a = new ie(0.0022, 8, 6);
    for (let l of [-1, 1])
      for (let c = 0; c < 4; c++)
        i.add(a, t.decal, {
          x: l * e * 0.66,
          y: n * 0.86,
          z: r - s * 0.3 + c * s * 0.2,
        });
    for (let l of [-1, 1])
      (i.add(Ft(0.006, n * 0.9, s * 0.72, 0.003, 3), t.shell2, {
        x: l * e * 0.97,
        y: n * 0.05,
        z: r,
      }),
        i.add(qi(s * 0.5, n * 0.4, 4, 0.003, 0.45), t.decal, {
          x: l * e * 1,
          y: n * 0.08,
          z: r,
          ry: (l * Math.PI) / 2,
        }));
    (i.add(Ft(e * 1.3, 0.008, s * 0.8, 0.004, 3), t.rubber, {
      y: -n * 0.82,
      z: r,
    }),
      i.add(new jt(Math.min(e, n) * 0.86, 0.0035, 10, 64), t.frame, {
        z: r - s / 2,
        s: [e / Math.min(e, n), n / Math.min(e, n), 1],
      }));
  }
  function iv(i) {
    let t = new Xt(),
      e = 0.032,
      n = 0.026,
      s = Jh;
    (Kf(t, i.dark, e * 0.9, n * 0.9, s, -s / 2),
      t.add(
        Es(
          [
            [-s * 0.95, n * 0.5],
            [-s * 0.05, n * 0.5],
            [-s * 0.15, n * 1.02],
            [-s * 0.8, n * 1.08],
          ],
          e * 1.6,
          0.004,
          3,
        ),
        i.shell,
      ),
      t.add(
        Es(
          [
            [-s * 0.85, n * 1.04],
            [-s * 0.2, n * 1],
            [-s * 0.3, n * 1.3],
            [-s * 0.75, n * 1.34],
          ],
          0.005,
          0.0015,
          1,
        ),
        i.accent,
      ));
    for (let r of [-1, 1])
      t.add(Ft(0.004, n * 0.8, s * 0.6, 0.002, 2), i.shell2, {
        x: r * e * 0.95,
        z: -s / 2,
      });
    (t.add(new jt(e * 0.8, 0.0028, 10, 48), i.frame, { z: 0, s: [1, n / e, 1] }),
      t.add(new Vt(0.004, 0.004, e * 1.7, 16), i.chrome, { rz: Math.PI / 2 }));
    for (let r of [-1, 1])
      t.add(new ie(0.0022, 8, 6), i.decal, {
        x: r * e * 0.55,
        y: n * 0.82,
        z: -s * 0.5,
      });
    return t.geos();
  }
  var $f = {
    id: 'gecko',
    name: '检修壁虎',
    accent: '#ff5f1f',
    size: '全长 92 厘米',
    desc: '贴着舱壁和管线检修的小型机器人。四条腿交替迈步，脚趾上有仿壁虎的刷毛垫，抬脚时脚趾先卷起再离开表面；身体随步伐左右扭动。停下检修时，尾巴高高弯过背部，把夹爪举到身体上方，鼻端的工具转盘换上相机、灯、螺丝刀或探针。',
    build(i) {
      let t = ei(i, { shadow: 1.1 }),
        { scene: e } = t,
        n = ti('#ff5f1f'),
        s = new Ne();
      (e.add(s), i.joint(s, 6));
      let r = qt(s, 0, 0, 0.09);
      i.joint(r, 1);
      let o = qt(r, 0, 0, 0.09);
      i.joint(o, 1);
      let a = qt(o, 0, 0.006, 0.075);
      i.joint(a, 2);
      let l = qt(a, 0, 0, 0.03);
      i.joint(l, 1);
      for (let [R, A, O, I, z] of [
        [s, 0.05, 0.038, 0.1, 0],
        [r, 0.046, 0.036, 0.095, 1],
        [o, 0.052, 0.04, 0.1, 2],
      ]) {
        let G = new Xt(R);
        if ((nv(G, n, A, O, I, I * 0.42, z), R === r)) {
          for (let D = 0; D < 6; D++)
            G.add(Ft(0.006, 0.003, 0.008, 0.0015, 1), n.glow, {
              y: O * 1.07,
              z: 0.01 + D * 0.012,
            });
          G.add(Ft(0.03, 0.004, 0.026, 0.004, 2), n.shell2, {
            x: 0.026,
            y: O * 0.98,
            z: 0.05,
            rz: -0.25,
          });
        }
        if (R === o) {
          G.add(Ft(0.026, 0.006, 0.014, 0.003, 2), n.accent, {
            x: -0.03,
            y: O * 0.95,
            z: 0.03,
            rz: 0.3,
          });
          for (let D = 0; D < 4; D++)
            G.add(new Me(0.003, 0.002, 0.018), n.decal, {
              x: 0.02 + D * 0.005,
              y: O * 1.02,
              z: 0.04,
            });
        }
        G.done();
      }
      {
        let R = new Xt(a);
        R.add(
          wt(
            [
              [0, -0.012],
              [0.03, -0.012],
              [0.033, 0],
              [0.03, 0.03],
              [0, 0.03],
            ],
            64,
          ),
          n.dark,
          { rx: Math.PI / 2, s: [1, 1, 0.8] },
        );
        for (let I = 0; I < 3; I++)
          R.add(new jt(0.031, 0.003, 8, 48), n.frame, {
            z: I * 0.01,
            s: [1, 0.8, 1],
          });
        R.done();
        let A = new Xt(l),
          O = [
            [0, -0.01],
            [0.034, -0.008],
            [0.044, 0.02],
            [0.046, 0.05],
            [0.04, 0.08],
            [0.028, 0.1],
            [0, 0.104],
          ];
        (A.add(wt(O, 96), n.shell, { rx: Math.PI / 2, s: [1.15, 1, 0.72] }),
          A.add(
            Es(
              [
                [0, 0.026],
                [0.07, 0.022],
                [0.09, 0.012],
                [0.05, 0.034],
                [0.01, 0.036],
              ],
              0.05,
              0.004,
              2,
            ),
            n.shell2,
          ),
          A.add(
            Es(
              [
                [0.06, 0.026],
                [0.088, 0.013],
                [0.09, 0.016],
                [0.064, 0.03],
              ],
              0.052,
              0.001,
              1,
            ),
            n.accent,
          ),
          A.add(
            wt(
              [
                [0.04, 0.06],
                [0.044, 0.064],
                [0.04, 0.068],
              ],
              96,
            ),
            n.decal,
            { rx: Math.PI / 2, s: [1.15, 1, 0.72], z: 0 },
          ));
        for (let I of [-1, 1]) {
          (A.add(
            wt(
              [
                [0, -0.008],
                [0.016, -0.008],
                [0.019, -0.002],
                [0.018, 0.006],
                [0, 0.006],
              ],
              48,
            ),
            n.frame,
            { x: I * 0.044, y: 0.012, z: 0.035, rz: (-I * Math.PI) / 2 },
          ),
            A.add(new ie(0.0145, 48, 16, 0, Kt, 0, Math.PI / 2), n.glass, {
              x: I * 0.048,
              y: 0.012,
              z: 0.035,
              rz: (-I * Math.PI) / 2,
            }),
            A.add(new jt(0.009, 0.0012, 8, 40), n.accent, {
              x: I * 0.0605,
              y: 0.012,
              z: 0.035,
              ry: Math.PI / 2,
            }),
            A.add(new Vt(0.0035, 0.0035, 0.002, 20), n.glow, {
              x: I * 0.062,
              y: 0.012,
              z: 0.035,
              rz: Math.PI / 2,
            }));
          for (let z = 0; z < 3; z++)
            A.add(new Me(0.002, 0.008, 0.012), n.decal, {
              x: I * 0.045,
              y: -0.006,
              z: 0.06 + z * 0.006,
            });
        }
        (A.add(Ft(0.06, 0.006, 0.05, 0.003, 2), n.rubber, { y: -0.026, z: 0.05 }),
          A.add(new Vt(0.0018, 0.0018, 0.07, 8), n.chrome, {
            x: 0.018,
            y: 0.055,
            z: 0.02,
            rx: -0.5,
          }),
          A.add(new ie(0.004, 12, 8), n.accent, { x: 0.018, y: 0.086, z: 0.003 }),
          A.done());
      }
      let c = qt(l, 0, -0.004, 0.1);
      i.joint(c, 1);
      let h = {};
      {
        let R = new Xt(c);
        (R.add(
          wt(
            [
              [0, -0.008],
              [0.026, -0.008],
              [0.028, 0],
              [0.028, 0.02],
              [0.024, 0.024],
              [0, 0.024],
            ],
            72,
          ),
          n.frame,
          { rx: Math.PI / 2 },
        ),
          R.add(new jt(0.0282, 0.0022, 8, 72), n.accent, { z: 0.008 }),
          R.add(cn(0.02, 8, 0.0016, 0.003, 0.025, 8), n.chrome, {
            rx: Math.PI / 2,
          }));
        let A = 0.016,
          O = (I) => ({
            x: Math.sin((I * Math.PI) / 2) * A,
            y: -Math.cos((I * Math.PI) / 2) * A,
          });
        {
          let I = O(0);
          (R.add(
            wt(
              [
                [0.006, 0],
                [0.0085, 0],
                [0.009, 0.014],
                [0.008, 0.018],
                [0.006, 0.018],
              ],
              40,
            ),
            n.dark,
            { x: I.x, y: I.y, z: 0.022, rx: Math.PI / 2 },
          ),
            R.add(new ie(0.006, 32, 12, 0, Kt, 0, Math.PI / 2), n.glass, {
              x: I.x,
              y: I.y,
              z: 0.04,
              rx: Math.PI / 2,
            }),
            R.add(new jt(0.0088, 0.001, 6, 32), n.accent, {
              x: I.x,
              y: I.y,
              z: 0.036,
            }));
        }
        {
          let I = O(1);
          (R.add(
            wt(
              [
                [0.005, 0],
                [0.009, 0.006],
                [0.0095, 0.016],
                [0.008, 0.018],
              ],
              40,
            ),
            n.shell,
            { x: I.x, y: I.y, z: 0.022, rx: Math.PI / 2 },
          ),
            (h.lens = new oe(new os(0.0078, 32), new We({ color: new Rt('#fff3df').multiplyScalar(0.5) }))),
            h.lens.position.set(I.x, I.y, 0.0405),
            c.add(h.lens),
            (h.pos = I));
        }
        {
          let I = O(2);
          (R.add(
            wt(
              [
                [0.004, 0],
                [0.007, 0],
                [0.007, 0.01],
                [0.004, 0.014],
              ],
              32,
            ),
            n.shell2,
            { x: I.x, y: I.y, z: 0.022, rx: Math.PI / 2 },
          ),
            R.add(new Vt(0.0022, 0.0022, 0.022, 6), n.chrome, {
              x: I.x,
              y: I.y,
              z: 0.047,
              rx: Math.PI / 2,
            }),
            R.add(new as(0.0022, 0.006, 6), n.chrome, {
              x: I.x,
              y: I.y,
              z: 0.061,
              rx: Math.PI / 2,
            }));
        }
        {
          let I = O(3);
          (R.add(
            wt(
              [
                [0.004, 0],
                [0.006, 0],
                [0.006, 0.008],
                [0.0025, 0.012],
              ],
              32,
            ),
            n.dark,
            { x: I.x, y: I.y, z: 0.022, rx: Math.PI / 2 },
          ),
            R.add(new Vt(0.0012, 0.0012, 0.03, 8), n.chrome, {
              x: I.x,
              y: I.y,
              z: 0.05,
              rx: Math.PI / 2,
            }),
            R.add(new ie(0.0022, 12, 8), n.accent, { x: I.x, y: I.y, z: 0.066 }));
        }
        R.done();
      }
      let u = new us('#fff1dc', 0, 1.6, 0.45, 0.5, 1.6);
      (c.add(u), u.position.set(h.pos.x, h.pos.y, 0.045));
      let f = qt(c, h.pos.x, h.pos.y, 1);
      u.target = f;
      let d = Wl(0.5, 0.2, '#fff2dd', 0.1);
      ((d.rotation.x = Math.PI / 2), d.position.set(h.pos.x, h.pos.y, 0.045), c.add(d));
      let p = [],
        x = [
          ['LF', o, 1, 0.045, 0.2, 0.07],
          ['RF', o, -1, 0.045, 0.2, 0.07],
          ['LH', s, 1, 0.025, 0.21, -0.05],
          ['RH', s, -1, 0.025, 0.21, -0.05],
        ];
      for (let [R, A, O, I, z, G] of x) {
        let D = qt(A, O * 0.052, -0.01, I);
        i.joint(D, 1);
        {
          let $ = new Xt(D);
          ($.add(
            wt(
              [
                [0, -0.018],
                [0.02, -0.018],
                [0.023, -0.012],
                [0.023, 0.012],
                [0.02, 0.018],
                [0, 0.018],
              ],
              48,
            ),
            n.frame,
          ),
            $.add(new jt(0.0232, 0.0022, 8, 48), n.accent, { rx: Math.PI / 2 }),
            $.add(Ft(ic + 0.01, 0.022, 0.026, 0.006, 3), n.shell, {
              x: ic / 2 + 0.004,
            }),
            $.done());
        }
        let K = qt(D, ic, 0, 0);
        i.joint(K, 1);
        {
          let $ = new Xt(K);
          ($.add(
            wt(
              [
                [0, -0.016],
                [0.015, -0.016],
                [0.017, -0.01],
                [0.017, 0.01],
                [0.015, 0.016],
                [0, 0.016],
              ],
              40,
            ),
            n.frame,
            { rx: Math.PI / 2 },
          ),
            $.add(new Vt(0.006, 0.006, 0.036, 20), n.chrome, { rx: Math.PI / 2 }),
            $.add(Ft(Wn - 0.012, 0.016, 0.014, 0.005, 3), n.dark, { x: Wn / 2 }),
            $.add(
              Ro(
                [
                  [0.01, -0.01],
                  [Wn - 0.02, -0.012],
                  [Wn - 0.008, 0.002],
                  [Wn * 0.55, 0.022],
                  [0.016, 0.018],
                ],
                0.024,
                0.004,
                3,
              ),
              n.shell,
            ),
            $.add(
              Ro(
                [
                  [Wn * 0.3, 0.016],
                  [Wn * 0.62, 0.018],
                  [Wn * 0.6, 0.022],
                  [Wn * 0.32, 0.021],
                ],
                0.025,
                0.001,
                1,
              ),
              n.accent,
            ));
          for (let H of [-0.013, 0.013])
            for (let Z = 0; Z < 3; Z++)
              $.add(new ie(0.0016, 8, 6), n.decal, {
                x: 0.03 + Z * 0.025,
                y: 0.002,
                z: H,
              });
          $.done();
        }
        let lt = qt(K, Wn, 0, 0);
        i.joint(lt, 1);
        {
          let $ = new Xt(lt);
          ($.add(
            wt(
              [
                [0, -0.014],
                [0.013, -0.014],
                [0.015, -0.008],
                [0.015, 0.008],
                [0.013, 0.014],
                [0, 0.014],
              ],
              40,
            ),
            n.frame,
            { rx: Math.PI / 2 },
          ),
            $.add(new Vt(0.005, 0.005, 0.032, 20), n.chrome, { rx: Math.PI / 2 }),
            $.add(
              wt(
                [
                  [0, 0.006],
                  [0.011, 0.012],
                  [0.012, Ei * 0.5],
                  [0.009, Ei - 0.012],
                  [0.006, Ei - 0.004],
                  [0, Ei],
                ],
                40,
              ),
              n.shell2,
              { rz: -Math.PI / 2 },
            ),
            $.add(new jt(0.0118, 0.0016, 8, 40), n.accent, {
              x: Ei * 0.32,
              ry: Math.PI / 2,
            }),
            $.add(new Vt(0.003, 0.003, Ei * 0.7, 10), n.dark, {
              x: Ei * 0.5,
              y: 0.012,
              rz: Math.PI / 2,
            }),
            $.done());
        }
        let it = qt(lt, Ei, 0, 0);
        i.joint(it, 2);
        let ot = [];
        {
          let $ = new Xt(it);
          ($.add(new ie(0.008, 24, 16), n.chrome),
            $.add(
              wt(
                [
                  [0, -pr],
                  [0.017, -pr + 0.001],
                  [0.019, -pr + 0.005],
                  [0.014, -0.004],
                  [0, -0.002],
                ],
                48,
              ),
              n.shell,
            ),
            $.add(new jt(0.0186, 0.0016, 8, 48), n.accent, {
              y: -pr + 0.004,
              rx: Math.PI / 2,
            }),
            $.done());
          for (let H = 0; H < 5; H++) {
            let Z = ye(-1.1, 1.1, H / 4) * O,
              mt = qt(it, Math.sin(Z) * 0.012 * O * 0 + O * 0, -pr + 0.004, 0);
            ((mt.rotation.y = (O > 0 ? Math.PI / 2 : -Math.PI / 2) - Z * 0.85 * O + (O > 0 ? -0.35 : 0.35)),
              i.joint(mt, 1));
            let Mt = new Xt(mt);
            (Mt.add(Ft(0.006, 0.005, 0.03, 0.0022, 3), n.shell2, {
              z: 0.026,
              y: 0.001,
            }),
              Mt.add(new Vt(0.0028, 0.0028, 0.008, 16), n.frame, {
                z: 0.012,
                rz: Math.PI / 2,
              }),
              Mt.add(Ft(0.012, 0.003, 0.014, 0.0015, 3), n.rubber, {
                z: 0.038,
                y: -0.0015,
              }));
            for (let k = 0; k < 5; k++)
              Mt.add(Ft(0.012, 0.0012, 0.0012, 5e-4, 1), n.dark, {
                z: 0.032 + k * 0.003,
                y: -0.0032,
              });
            (Mt.done(), ot.push(mt));
          }
        }
        p.push({
          name: R,
          girdle: A,
          s: O,
          coxa: D,
          femur: K,
          tibia: lt,
          foot: it,
          toes: ot,
          rest: nt(O * z, -Jf, G),
          group: R === 'LF' || R === 'RH' ? 0 : 1,
          planted: nt(),
          from: nt(),
          to: nt(),
          t: 0,
          stepping: !1,
          curl: 0,
        });
      }
      let m = [];
      {
        let R = qt(s, 0, 0.004, -0.008),
          A = 0;
        for (let I = 0; I < mr; I++) {
          let z = qt(R, 0, 0, A);
          ((z.rotation.order = 'YXZ'), i.joint(z, 2), m.push(z), (R = z), (A = -Jh * Zh(I)));
        }
        let O = qt(m[mr - 1], 0, 0, -Jh * Zh(mr - 1));
        ((O.rotation.x = -Math.PI / 2), (m.claw = Yi(i, O, n, 0.55)));
      }
      let g = new Mn(e, iv(n), mr),
        M = nt(),
        E = nt(),
        y = nt(0, 1, 0),
        C = new Ee(),
        w = 0.42,
        _ = 0,
        b = 0,
        W = 0,
        N = 0,
        T = 1,
        U = !0,
        X = nt(),
        L = nt();
      function Y(R, A) {
        return (A.copy(R.rest), R.girdle.localToWorld(A), (A.y = 0), A);
      }
      function j(R) {
        let A = nt(R.cur.x, R.cur.y + pr, R.cur.z);
        (R.girdle.updateMatrixWorld(!0),
          E.copy(A),
          R.girdle.worldToLocal(E).sub(R.coxa.position),
          (R.coxa.rotation.y = Math.atan2(-E.z, E.x)),
          R.coxa.updateMatrixWorld(!0),
          E.copy(A),
          R.coxa.worldToLocal(E));
        let O = E.x - ic,
          I = E.y,
          z = Math.hypot(O, I),
          [G, D] = Sf(Wn, Ei, z);
        ((R.femur.rotation.z = Math.atan2(I, O) + G),
          (R.tibia.rotation.z = -(Math.PI - D)),
          R.coxa.updateMatrixWorld(!0),
          bf(R.foot, C),
          R.toes.forEach((K) => {
            K.rotation.x = -R.curl * 1.1;
          }));
      }
      function J(R, A) {
        let O = A % ev,
          I = O > 9.2 && O < 14.6,
          z = le((O - 9.4) / 1) * (1 - le((O - 13.8) / 0.9));
        ((b = Xe(b, I ? 0 : 0.17, 3, R)), (_ += (b * R) / w), (N += b * R));
        let G = nt(Math.sin(_) * w, 0, Math.cos(_) * w),
          D = nt(Math.cos(_), 0, -Math.sin(_)),
          K = Math.atan2(D.x, D.z);
        U ? (W = K) : (W += Math.atan2(Math.sin(K - W), Math.cos(K - W)) * (1 - Math.exp(-3 * R)));
        let lt = 0.16 * He(b / 0.17, 0, 1),
          it = (N / 0.11) * Math.PI;
        (s.position.set(G.x, Jf - 0.004 * p.filter((H) => H.stepping).length + 0.03 * z, G.z),
          C.setFromAxisAngle(y, W),
          s.quaternion.copy(C).multiply(new Ee().setFromAxisAngle(y, lt * Math.sin(it))),
          s.rotateX(-0.12 * z),
          (r.rotation.y = -lt * Math.sin(it - 0.9)),
          (o.rotation.y = -lt * Math.sin(it - 1.8)),
          a.rotation.set(
            -0.15 * z + 0.05 * Math.sin(A * 0.9),
            lt * Math.sin(it - 2.4) * 0.6 + 0.45 * z * Math.sin(A * 0.7),
            0,
            'YXZ',
          ),
          (l.rotation.x = 0.1 * z),
          s.updateMatrixWorld(!0),
          L.copy(s.position).sub(X).divideScalar(Math.max(R, 1e-4)).setY(0),
          X.copy(s.position),
          U && L.set(0, 0, 0));
        for (let H of p) {
          H.cur || ((H.cur = Y(H, nt())), H.planted.copy(H.cur));
          let Z = Y(H, nt()).addScaledVector(L, 0.18);
          if (((Z.y = 0), H.stepping)) {
            ((H.t += R / 0.3), H.to.lerp(Z, 0.25));
            let mt = le(Math.min(H.t, 1));
            (H.cur.lerpVectors(H.from, H.to, mt),
              (H.cur.y = Math.sin(Math.PI * Math.min(H.t, 1)) * 0.035),
              (H.curl = H.t < 0.5 ? 1 : 1 - le((H.t - 0.5) / 0.5)),
              H.t >= 1 && ((H.stepping = !1), H.planted.copy(H.to), H.cur.copy(H.to), (H.curl = 0)));
          } else {
            H.cur.copy(H.planted);
            let mt = Math.hypot(H.planted.x - Z.x, H.planted.z - Z.z),
              Mt = p.some((ht) => ht.stepping && ht.group !== H.group),
              k = T !== H.group || p.some((ht) => ht.stepping && ht.group === H.group);
            ((H.curl = Xe(H.curl, mt > 0.04 && !Mt ? He((mt - 0.04) / 0.03, 0, 1) * 0.6 : 0, 10, R)),
              ((mt > 0.055 && !Mt && k) || mt > 0.11) &&
                ((H.stepping = !0), (H.t = 0), H.from.copy(H.planted), H.to.copy(Z), (T = H.group)));
          }
          j(H);
        }
        (m.forEach((H, Z) => {
          let mt = Z / (mr - 1),
            Mt = lt * 1.4 * Math.sin(it - 3 - Z * 0.55) * (0.4 + mt);
          ((H.rotation.y = ye(Mt, 0.08 * Math.sin(A * 1.3 + Z * 0.4) * mt, z)),
            (H.rotation.x = ye(-0.02 + 0.03 * mt, Z < 5 ? 0.42 : 0.1, z)));
        }),
          m.claw.set(z > 0.6 ? 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(A * 2.2)) : 0.35));
        let ot = I ? Math.floor((O - 9.6) / 1.1) % 4 : 0;
        c.rotation.z = Xe(c.rotation.z, (-ot * Math.PI) / 2, 6, R);
        let $ = I && ot === 1 ? 1 : 0;
        ((u.intensity = Xe(u.intensity, $ * 2.4, 6, R)),
          (d.material.uniforms.uK.value = u.intensity / 2.4),
          h.lens.material.color.set('#fff3df').multiplyScalar(0.5 + (2.4 * u.intensity) / 2.4),
          n.glow.color.set(I ? '#ffb15f' : '#ff5f1f').multiplyScalar(2.4 + 0.5 * Math.sin(A * 3)),
          s.updateMatrixWorld(!0),
          m.forEach((H, Z) => g.set(Z, H, Zh(Z))),
          g.commit(),
          (U = !1),
          M.copy(s.position).add(nt(0, 0.02, 0)),
          t.follow(nt(0, 0, 0)));
      }
      return (
        J(1 / 60, 1 / 60),
        {
          scene: e,
          sky: t.sky,
          update: J,
          focus: M,
          cam: {
            pos: nt(0.6, 0.35, 0.8),
            from: nt(1.2, 0.8, 1.6),
            fov: 38,
            near: 0.01,
            far: 200,
            min: 0.35,
            max: 4,
            maxPolar: Math.PI * 0.47,
          },
          clampCamera(R) {
            R.position.y < 0.05 && (R.position.y = 0.05);
          },
          exposure: 1,
          jointSize: 0.005,
        }
      );
    },
  };

  const referenceModels = {
    station_octo: Of,
    station_flyer: Bf,
    station_jelly: Wf,
    station_star: Zf,
    station_gecko: $f,
  };
  const dimensions = (C.stationRobotDimensions = {
    station_octo: { radius: 0.4, height: 0.64, center: 0.8, modelScale: 0.416, mode: 'free-fly' },
    station_flyer: { radius: 0.31, height: 0.74, center: 0.47, modelScale: 1, mode: 'free-fly' },
    station_jelly: { radius: 0.4, height: 0.59, center: 0.53, modelScale: 0.714, mode: 'free-fly' },
    station_star: { radius: 0.4, height: 0.42, center: 0.29, modelScale: 0.5, mode: 'surface' },
    station_gecko: { radius: 0.4, height: 0.41, center: 0.13, modelScale: 0.727, mode: 'surface' },
  });
  const tasks = {
    station_octo: 'inspect',
    station_flyer: 'inspect',
    station_jelly: 'assist',
    station_star: 'supply',
    station_gecko: 'inspect',
  };
  C.stationPresets = Object.entries(referenceModels).map(([type, ref]) => ({
    type,
    name: ref.name,
    label: ref.name,
    subtitle:
      '舱内适配 / ' +
      {
        station_octo: '多腕维修',
        station_flyer: '随行巡检',
        station_jelly: '生命体征监护',
        station_star: '样品与补给',
        station_gecko: '贴壁检修',
      }[type],
    description: ref.desc,
    color: ref.accent,
    scale: 1,
    accessories: [],
    task: tasks[type],
    appearanceVersion: 3,
    environment: 'station',
  }));
  function registerSchema(type, nodes) {
    const descriptors = nodes.map((node, index) => ({
      name: 'station_joint_' + index,
      label:
        (index === 0 ? '机体姿态' : '活动关节 ' + index) + ' · ' + node.userData.stationDegreesOfFreedom + ' 自由度',
      // The source records degrees of freedom, not mechanical axes or limits.
      // Its coupled and IK-driven joints must not claim an invented yaw hinge.
      type: node.userData.stationDegreesOfFreedom === 6 ? 'floating' : 'articulated',
      axis: null,
      lower: null,
      upper: null,
      degreesOfFreedom: node.userData.stationDegreesOfFreedom,
    }));
    window.RobotContract.setStationJoints(type, descriptors);
    return descriptors;
  }
  C.makeStationRobot = (input = {}) => {
    const ref = referenceModels[input.type];
    if (!ref) throw new Error('未知空间站机器人型号。');
    const spec = { ...C.stationPresets.find((p) => p.type === input.type), ...input },
      dim = dimensions[spec.type],
      nodes = [];
    const built = ref.build({
      camera: { position: new T.Vector3(0.6, 0.6, 1.8) },
      joint(node, dof) {
        node.userData.stationDegreesOfFreedom = dof;
        nodes.push(node);
      },
    });
    const root = new T.Group(),
      fit = new T.Group(),
      offset = new T.Group(),
      source = built.scene;
    root.name = spec.name;
    root.scale.setScalar(spec.scale || 1);
    root.add(fit);
    fit.scale.setScalar(dim.modelScale);
    fit.add(offset);
    offset.add(source);
    const joints = {};
    nodes.forEach((node, index) => {
      node.name = 'station_joint_' + index;
      joints[node.name] = node;
    });
    const descriptors = registerSchema(spec.type, nodes);
    root.userData = {
      spec,
      stationRobot: true,
      orbitalRobot: true,
      microgravity: true,
      referenceModel: ref.id,
      height: dim.height * (spec.scale || 1),
      radius: dim.radius * (spec.scale || 1),
      navigationMode: dim.mode,
      joints,
      jointDescriptors: descriptors,
      reference: { built, source, offset, body: nodes[0], clock: 0, lastTime: null, lastAction: null },
      thrusters: [],
      attitudeJets: [],
    };
    const preparedMaterials = new Set();
    source.traverse((node) => {
      if (node.isLight) node.visible = false;
      if (node.isMesh) {
        node.userData.robotRoot = root;
        node.frustumCulled = false;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material.isShaderMaterial && material.uniforms?.uLen) node.visible = false;
          for (const key of ['map']) if (material[key]?.isCanvasTexture) material[key].encoding = T.sRGBEncoding;
          if (preparedMaterials.has(material)) continue;
          preparedMaterials.add(material);
          if (spec.color && material.color?.getHexString() === 'ff5f1f') material.color.set(spec.color);
          if (material.isMeshStandardMaterial) material.color.convertSRGBToLinear();
        }
      }
    });
    C.animateStationRobot(root, 0, { action: 'scan' });
    return C.applyRobotRig(root, spec.rig);
  };
  const phaseWindows = {
    station_octo: { move: [0, 3.7], work: [5.4, 8.6], idle: [0, 3.7] },
    station_flyer: { move: [0, 5.8], work: [10.9, 14.3], idle: [6.1, 8.8] },
    station_jelly: { move: [0, 3.3], work: [6.8, 10.8], idle: [0, 3.3] },
    station_star: { move: [0, 9], work: [10, 16.2], idle: [0, 9] },
    station_gecko: { move: [0, 9], work: [9.8, 13.6], idle: [9.8, 13.6] },
  };
  C.animateStationRobot = (root, time, state = {}) => {
    const data = root?.userData;
    if (!data?.stationRobot || !Number.isFinite(time)) return;
    const ref = data.reference,
      action = state.action || 'guard';
    if (ref.lastTime === time && ref.lastAction === action) return;
    const dt = ref.lastTime === null ? 1 / 60 : Math.max(0, Math.min(0.15, time - ref.lastTime));
    const moving = action === 'move' || (state.speed || 0) > 0.03,
      working = action === 'work',
      kind = working ? 'work' : moving ? 'move' : 'idle',
      range = phaseWindows[data.spec.type][kind];
    if (ref.lastKind !== kind) ref.clock = 0;
    else ref.clock += dt;
    const phase = range[0] + (ref.clock % (range[1] - range[0]));
    // Source solvers use matrixWorld internally. Evaluate in an isolated model space,
    // then remove the exhibit's demonstration trajectory before joining the station.
    const parent = ref.source.parent;
    ref.source.parent = null;
    ref.source.updateMatrixWorld(true);
    ref.built.update(dt, phase);
    ref.source.updateMatrixWorld(true);
    const p = ref.body.getWorldPosition(new T.Vector3()),
      q = ref.body.getWorldQuaternion(new T.Quaternion()),
      heading = new T.Euler().setFromQuaternion(q, 'YXZ').y;
    ref.offset.rotation.set(0, -heading, 0);
    p.applyQuaternion(ref.offset.quaternion);
    ref.offset.position.set(-p.x, dimensions[data.spec.type].center - p.y, -p.z);
    ref.source.parent = parent;
    ref.source.updateMatrixWorld(true);
    ref.lastTime = time;
    ref.lastAction = action;
    ref.lastKind = kind;
  };
  const previousPrepare = C.prepareRobot,
    previousMake = C.makeRobot,
    previousAnimate = C.animateRobot;
  C.prepareRobot = async (spec) => {
    if (referenceModels[spec?.type]) {
      try {
        window.RobotContract.jointSchema(spec.type);
      } catch {
        const model = C.makeStationRobot(spec);
        C.disposeModel(model);
      }
      return;
    }
    return previousPrepare?.(spec);
  };
  C.makeRobot = (input) => (referenceModels[input?.type] ? C.makeStationRobot(input) : previousMake(input));
  C.animateRobot = (root, phase, moving = false, interacting = false, time = 0) =>
    root?.userData.stationRobot
      ? C.animateStationRobot(
          root,
          time,
          root.userData.flightAnimation || {
            action: interacting ? 'work' : moving ? 'move' : 'scan',
            speed: moving ? 0.5 : 0,
          },
        )
      : previousAnimate(root, phase, moving, interacting, time);
})();
