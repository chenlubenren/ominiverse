/* Continuous, bounded droplet and ventilation tracers. Visual particles never
 * determine exposure: the respiratory / ventilation models own that state. */
(() => {
  'use strict';
  const L = window.IndoorLab, T = THREE;
  const TAU = Math.PI * 2, fract = n => n - Math.floor(n);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  class AirParticleRenderer {
    constructor({ color = '#ef7041', maxParticles = 12000, name = '空气传播示踪粒子' } = {}) {
      this.capacity = clamp(Math.floor(maxParticles) || 12000, 256, 18000);
      this.positions = new Float32Array(this.capacity * 3);
      this.colors = new Float32Array(this.capacity * 3);
      this.sizes = new Float32Array(this.capacity);
      this.alphas = new Float32Array(this.capacity);
      this.color = new T.Color(color);
      this.geometry = new T.BufferGeometry();
      for (const [key, values, stride] of [['position', this.positions, 3], ['color', this.colors, 3], ['aSize', this.sizes, 1], ['aAlpha', this.alphas, 1]]) {
        this.geometry.setAttribute(key, new T.BufferAttribute(values, stride).setUsage(T.DynamicDrawUsage));
      }
      this.geometry.setDrawRange(0, 0);
      this.material = new T.ShaderMaterial({
        uniforms: { uViewportHeight: { value: 900 }, uPixelRatio: { value: 1 } },
        vertexShader: `
          attribute vec3 color;
          attribute float aSize;
          attribute float aAlpha;
          uniform float uViewportHeight;
          uniform float uPixelRatio;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            float projected = aSize * uViewportHeight * abs(projectionMatrix[1][1]) * .5;
            if (projectionMatrix[2][3] < -.5) projected /= max(.15, -mv.z);
            gl_PointSize = clamp(projected, 1.65 * uPixelRatio, 5.0 * uPixelRatio);
            vColor = color;
            vAlpha = aAlpha;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            float r = length(gl_PointCoord - .5);
            if (r > .5) discard;
            float core = 1.0 - smoothstep(.02, .22, r);
            float alpha = (1.0 - smoothstep(.19, .5, r)) * vAlpha;
            if (alpha < .012) discard;
            gl_FragColor = vec4(mix(vColor, vec3(1.0, .93, .78), core * .09), alpha);
          }
        `,
        transparent: true, depthWrite: false, depthTest: true,
        blending: T.NormalBlending, toneMapped: false
      });
      this.points = new T.Points(this.geometry, this.material);
      this.points.name = name;
      this.points.frustumCulled = false;
      this.points.userData.noAO = true;
      this.points.renderOrder = 12;
      this.points.visible = false;
      this._viewport = new T.Vector2();
      this.disposed = false;
    }

    static currentFloor(view) {
      return L.continuousTower?.active ? L.continuousTower.origin : (view.origin || view.model?.towerFloor || view.view?.model?.towerFloor);
    }

    hide() { this.points.visible = false; }

    draw(view, clouds, time) {
      if (this.disposed) return;
      const sceneView = view.scene ? view : view.view;
      if (!sceneView?.scene) return;
      if (this.points.parent !== sceneView.scene) sceneView.scene.add(this.points);
      const origin=sceneView.floorOrigin;this.points.position.set(origin?.x||0,origin?.y||0,origin?.z||0);
      const tower = L.continuousTower, floor = AirParticleRenderer.currentFloor(view);
      const visible = (!L.building || L.building.phase === 'interior') && !(tower?.active && tower.worldWalk?.outside);
      if (!visible || !floor) { this.hide(); return; }

      const renderer = sceneView.renderer;
      if (renderer?.getDrawingBufferSize) {
        renderer.getDrawingBufferSize(this._viewport);
        this.material.uniforms.uViewportHeight.value = this._viewport.y;
        this.material.uniforms.uPixelRatio.value = renderer.getPixelRatio?.() || 1;
      } else {
        this.material.uniforms.uViewportHeight.value = sceneView.container?.clientHeight || 900;
      }

      let requested = 0;
      const active = [];
      for (const c of clouds || []) {
        if (Math.round(c.floor) !== floor || !Number.isFinite(c.x) || !Number.isFinite(c.z)) continue;
        const age = Math.max(0, time - (c.born ?? 0)), life = c.life ?? 34;
        if (!(life > 0) || age >= life || !(c.strength > 0)) continue;
        const finiteLife = Number.isFinite(life), remaining = finiteLife ? clamp(1 - age / life, 0, 1) : 1;
        const kind = c.kind || 'sneeze', strength = clamp(c.strength, .015, 3);
        // Allocate proportionally before writing so fresh emission remains
        // visible even when a whole floor has reached the particle budget.
        const n = kind === 'field' ? Math.ceil(5 + Math.sqrt(strength) * 14) :
          Math.ceil(280 * Math.sqrt(strength) * Math.sqrt(remaining));
        active.push({ c, age, life, remaining, kind, strength, n });
        requested += n;
      }
      const scale = Math.min(1, this.capacity / Math.max(1, requested));
      let count = 0;
      for (const cloud of active) {
        const { c, age, remaining, kind, strength } = cloud;
        const seed = Number.isFinite(c.seed) ? c.seed : (c.x * .713 + c.z * .317);
        const n = Math.max(1, Math.floor(cloud.n * scale));
        const direction = c.angle || 0, dx = Math.sin(direction), dz = Math.cos(direction);
        const radius = c.radius ?? (kind === 'field' ? .3 : kind === 'vent' ? 1 : .65 + Math.min(2.1, age * .16));
        for (let i = 0; i < n && count < this.capacity; i++) {
          const u = fract(i * .61803398875 + seed * .173), v = fract(i * .754877666 + seed * .371), w = fract(i * .569840296 + seed * .713);
          const theta = TAU * v + seed;
          let x, y, z;
          if (kind === 'field') {
            const r = radius * Math.sqrt(u), swirl = theta + time * (.2 + w * .2);
            x = c.x + Math.cos(swirl) * r;
            z = c.z + Math.sin(swirl) * r;
            y = (c.y ?? 1.58) + (fract(w + time * (.035 + u * .025)) - .5) * (c.height ?? 2.55);
          } else if (kind === 'vent') {
            const fall = fract(w + time * (.24 + u * .12));
            const r = radius * (.08 + fall * .92) * Math.sqrt(u), swirl = theta + fall * 4 + time * .65;
            x = c.x + Math.cos(swirl) * r;
            z = c.z + Math.sin(swirl) * r;
            y = (c.y ?? 3.15) - .08 - fall * 2.7;
          } else {
            const impulse = Math.min(radius * .65, 1 - Math.exp(-age * 2.8));
            const spread = radius * (.16 + .72 * (1 - Math.exp(-age * .8)));
            const swirl = theta + age * (.16 + .13 * w), r = spread * Math.sqrt(u);
            let localX = dx * impulse * (.45 + .55 * w) + Math.cos(swirl) * r;
            let localZ = dz * impulse * (.45 + .55 * w) + Math.sin(swirl) * r;
            const reach = Math.hypot(localX, localZ);
            if (reach > radius) { localX *= radius / reach; localZ *= radius / reach; }
            x = c.x + localX;
            z = c.z + localZ;
            y = (c.y ?? 1.4) + (w - .5) * Math.min(1.5, .14 + age * .2) - Math.min(.32, age * .008) + Math.sin(theta + age * 1.2) * .07;
          }
          // A cloud may carry a room or cell envelope. Reflecting tracers
          // inside it avoids a bright pile-up along walls and shut doors.
          const bounds = c.bounds;
          if (bounds) {
            x = this._reflect(x, bounds.minX + .015, bounds.maxX - .015);
            z = this._reflect(z, bounds.minZ + .015, bounds.maxZ - .015);
          }
          const offset = count * 3;
          this.positions[offset] = x;
          this.positions[offset + 1] = clamp(y, .15, 3.22);
          this.positions[offset + 2] = z;
          const bright = i % 17 === 0 ? .5 : .015 + .075 * u;
          this.colors[offset] = this.color.r * (1 - bright) + bright;
          this.colors[offset + 1] = this.color.g * (1 - bright) + bright * .88;
          this.colors[offset + 2] = this.color.b * (1 - bright) + bright * .57;
          this.sizes[count] = kind === 'field' ? .045 + u * .025 : .045 + u * .045;
          this.alphas[count] = (kind === 'field' ? .64 + Math.min(.24, strength * .2) : .96) * Math.pow(remaining, .65);
          count++;
        }
      }
      this.geometry.setDrawRange(0, count);
      for (const key of ['position', 'color', 'aSize', 'aAlpha']) this.geometry.attributes[key].needsUpdate = true;
      this.points.visible = count > 0;
      return count;
    }

    _reflect(value, min, max) {
      const span = max - min;
      if (!(span > 0)) return (min + max) / 2;
      const phase = fract((value - min) / (span * 2)) * 2;
      return min + span * (phase <= 1 ? phase : 2 - phase);
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.points.parent?.remove(this.points);
      this.geometry.dispose();
      this.material.dispose();
    }
  }
  L.AirParticleRenderer = AirParticleRenderer;
})();
