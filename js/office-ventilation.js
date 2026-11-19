/* Accelerated passive-air tracer. Pollution spreads through openings; people
 * neither generate it nor become infected, alarmed, or controlled by it. */
(() => {
  'use strict';
  const L = window.IndoorLab;
  const inside = (r, p) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;
  const version = model => (model.physicsVersion || 0) + ':' + (model.wallVersion || 0);

  // Exact wall intersections keep thin partitions closed even on a coarse
  // concentration grid. Desks are deliberately absent from this air topology.
  function intersects(a, b, wall) {
    const co = Math.cos(wall.rotation || 0), si = Math.sin(wall.rotation || 0);
    const local = p => ({ x: (p.x - wall.x) * co - (p.z - wall.z) * si,
      z: (p.x - wall.x) * si + (p.z - wall.z) * co });
    const p = local(a), q = local(b);
    let lo = 0, hi = 1;
    for (const [axis, half] of [['x', wall.w / 2], ['z', wall.d / 2]]) {
      const delta = q[axis] - p[axis];
      if (Math.abs(delta) < 1e-9) {
        if (Math.abs(p[axis]) > half) return false;
      } else {
        const u = (-half - p[axis]) / delta, v = (half - p[axis]) / delta;
        lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v));
        if (lo > hi) return false;
      }
    }
    return hi >= 0 && lo <= 1;
  }

  class OfficeVentilation {
    constructor(society, intensity = 1, seed = 9517) {
      this.s = society; this.intensity = Math.max(.1, Number(intensity) || 1);
      this.seed = seed >>> 0; this.time = 0; this.accumulator = 0;
      this.interval = .24; this.diffusion = .65; this.airSpeed = .12;
      this.settlingRate = .0015; this.coverageThreshold = .008;
      this.floorTimes = new Map(); this.coverage90Times = new Map();
      this.population = society.agents.filter(a => !a.isPlayer).length;
      this.sources = []; this.floors = []; this.disposed = false;
      const floorCount = society.models?.length || L.TOWER?.floors || 30;
      for (let floor = 1; floor <= floorCount; floor++) {
        const people = society.agents.filter(a => !a.isPlayer && a.location === 'floor' && Math.round(a.floor) === floor);
        if (!people.length) continue;
        const model = society.model(floor), rooms = model?.rooms || [];
        if (!model || !rooms.length) continue;
        const weights = rooms.map(r => 1 + people.filter(a => inside(r, a)).length * 4);
        let roll = this.random() * weights.reduce((sum, weight) => sum + weight, 0);
        const room = rooms.find((r, i) => (roll -= weights[i]) <= 0) || rooms[0];
        const vent = room.vent || { x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2 };
        const source = { floor, room: room.id, roomName: room.name, name: room.name + ' · 顶部送风口',
          x: vent.x, z: vent.z, y: 3.16, bounds: { minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ },
          active: true, seed: this.random() * 100 };
        const field = this.makeField(model, floor, source);
        this.floors[floor - 1] = field; this.sources.push(source);
      }
      this.updateMetrics();
    }

    random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

    walls(model) {
      const walls = L.towerSightWalls ? L.towerSightWalls(model) :
        [...(model.layoutItems || []), ...(model.shellItems || []), ...(model.doorSolids || [])];
      return walls.filter(w => w.wall && !w.destroyed && !w.navigationOnly && w.y - w.h / 2 < 1.7 && w.y + w.h / 2 > 1.5);
    }

    interiorBounds(model) {
      const b = { ...model.bounds }, outer = model.bounds;
      // The model's bounding box includes the facade thickness and grid
      // rounding can add a row beyond a room's exterior glazing. Use the
      // interior face of actual perimeter glazing, never source reachability:
      // a closed but usable room must remain in the coverage denominator.
      for (const w of [...(model.layoutItems || []), ...(model.shellItems || [])]) {
        if (!w.wall || w.destroyed || !(w.key === 'glass' || w.navigationOnly || w.exterior) || Math.abs(w.rotation || 0) > .01 || w.y + w.h / 2 < 1.5) continue;
        if (w.w >= 2 && w.d < .3) {
          if (w.z > outer.maxZ - 1) b.maxZ = Math.min(b.maxZ, w.z - w.d / 2);
          if (w.z < outer.minZ + 1) b.minZ = Math.max(b.minZ, w.z + w.d / 2);
        }
        if (w.d >= 2 && w.w < .3) {
          if (w.x > outer.maxX - 1) b.maxX = Math.min(b.maxX, w.x - w.w / 2);
          if (w.x < outer.minX + 1) b.minX = Math.max(b.minX, w.x + w.w / 2);
        }
      }
      return b;
    }

    makeField(model, floor, source) {
      const grid = new L.Grid(model.bounds, .75), walls = this.walls(model), airBounds = this.interiorBounds(model);
      const staticWalls = walls.filter(w => !(model.doorSolids || []).includes(w));
      const cells = [], points = new Array(grid.size), valid = new Uint8Array(grid.size);
      // Actual slab tiles omit elevator shafts and stair voids. The isolated
      // narrow strip beyond a stairwell is not part of a room/circulation floor.
      const tiles = model.towerFloor && L.towerSlabTiles;
      for (let i = 0; i < grid.size; i++) {
        const p = grid.point(i); points[i] = p;
        const supported = !tiles || tiles.some(([w, d, x, z]) => Math.abs(p.x - x) < w / 2 && Math.abs(p.z - z) < d / 2);
        const stairRim = tiles && Math.abs(p.x) > 16.4 && Math.abs(p.z) < 3.6;
        if (!inside(airBounds, p) || !supported || stairRim || staticWalls.some(w => intersects(p, p, w))) { grid.solid[i] = 1; continue; }
        valid[i] = 1; cells.push(i);
      }
      const field = { floor, model, grid, airBounds, points, valid, cells, source,
        air: new Float32Array(grid.size), next: new Float32Array(grid.size),
        edgesA: null, edgesB: null, edgesWind: null, version: null,
        coverage: 0, coveredCells: 0, peak: 0, mean: 0, windAngle: this.random() * Math.PI * 2 };
      let nearest = -1, score = Infinity;
      for (const i of cells) {
        const p = points[i], d = (p.x - source.x) ** 2 + (p.z - source.z) ** 2;
        if (d < score) { score = d; nearest = i; }
      }
      source.cell = nearest;
      if (nearest >= 0) field.air[nearest] = .8 * this.intensity;
      this.rebuildEdges(field);
      return field;
    }

    rebuildEdges(field) {
      const { grid, valid, cells, points, model } = field, walls = this.walls(model);
      const a = [], b = [], wind = [], wx = Math.cos(field.windAngle), wz = Math.sin(field.windAngle);
      for (const i of cells) for (const [offset, flow, edge] of [[1, wx, i % grid.cols < grid.cols - 1], [grid.cols, wz, i + grid.cols < grid.size]]) {
        const j = i + offset;
        if (!edge || !valid[j] || walls.some(w => intersects(points[i], points[j], w))) continue;
        a.push(i); b.push(j); wind.push(flow);
      }
      field.edgesA = Int32Array.from(a); field.edgesB = Int32Array.from(b); field.edgesWind = Float32Array.from(wind);
      field.version = version(model);
    }

    step(dt) {
      for (const field of this.floors) {
        if (!field) continue;
        if (field.version !== version(field.model)) this.rebuildEdges(field);
        const { grid, air, next, cells, edgesA, edgesB, edgesWind, source } = field;
        next.set(air);
        const diffusion = this.diffusion * dt / (grid.cell * grid.cell), advection = this.airSpeed * dt / grid.cell;
        for (let edge = 0; edge < edgesA.length; edge++) {
          const a = edgesA[edge], b = edgesB[edge], flow = edgesWind[edge];
          const transfer = (air[a] - air[b]) * diffusion + flow * (flow >= 0 ? air[a] : air[b]) * advection;
          next[a] -= transfer; next[b] += transfer;
        }
        if (source.active && source.cell >= 0) next[source.cell] += 1.4 * this.intensity * dt;
        const settling = Math.exp(-this.settlingRate * dt);
        for (const i of cells) air[i] = Math.min(8, Math.max(0, next[i]) * settling);
      }
    }

    tick(dt) {
      if (this.disposed || !(dt > 0)) return;
      this.time += dt; this.accumulator += dt;
      while (this.accumulator >= this.interval - 1e-8) {
        // Two bounded explicit substeps keep diffusion and upwind transport
        // stable independently of frame rate and the simulation speed control.
        this.step(this.interval / 2); this.step(this.interval / 2); this.accumulator -= this.interval;
      }
      this.updateMetrics();
    }

    updateMetrics() {
      for (const field of this.floors) {
        if (!field) continue;
        let covered = 0, peak = 0, total = 0;
        for (const i of field.cells) { const c = field.air[i]; if (c >= this.coverageThreshold) covered++; peak = Math.max(peak, c); total += c; }
        field.coveredCells = covered; field.coverage = field.cells.length ? covered / field.cells.length : 0;
        field.peak = peak; field.mean = field.cells.length ? total / field.cells.length : 0;
        if (field.coverage >= .9 && !this.coverage90Times.has(field.floor)) this.coverage90Times.set(field.floor, this.time);
        if (field.cells.length && covered === field.cells.length && !this.floorTimes.has(field.floor)) this.floorTimes.set(field.floor, this.time);
      }
    }

    floorSummary(floor) {
      const field = this.floors[Math.round(floor) - 1];
      if (!field) return { floor: Math.round(floor), coverage: 0, coveredCells: 0, totalCells: 0, completeAt: null, coverage90At: null,
        elapsed: this.time, sourceName: '本层无初始人员', roomName: '', peak: 0 };
      return { floor: field.floor, coverage: field.coverage, coveredCells: field.coveredCells, totalCells: field.cells.length,
        completeAt: this.floorTimes.get(field.floor) ?? null, coverage90At: this.coverage90Times.get(field.floor) ?? null,
        elapsed: this.time, sourceName: field.source.name, roomName: field.source.roomName, peak: field.peak, mean: field.mean,
        threshold: this.coverageThreshold, sourceActive: field.source.active };
    }

    summary() {
      return { time: this.time, population: this.population, sources: this.sources.length, sourceFloors: this.sources.length,
        coveredFloors: this.floorTimes.size, coverage90Floors: this.coverage90Times.size,
        floorTimes: Object.fromEntries(this.floorTimes), coverage90Times: Object.fromEntries(this.coverage90Times),
        threshold: this.coverageThreshold, infected: 0, mode: 'passive-pollution' };
    }

    draw(view) {
      if (this.disposed) return;
      const tower = L.continuousTower, floor = tower?.active ? tower.origin : view.model?.towerFloor;
      const field = this.floors[floor - 1];
      if (!field || L.building?.phase !== 'interior' || tower?.active && tower.worldWalk?.outside) { this.renderer?.hide(); return; }
      if (!L.AirParticleRenderer) return;
      this.renderer ||= new L.AirParticleRenderer({ color: '#42b3ca', maxParticles: 12000, name: '通风污染示踪粒子' });
      const source = field.source;
      if(this.drawFloor!==floor||this.time>=(this.nextCloudDraw||0)||this.drawSourceActive!==source.active){
      const clouds = [];
      if (source.active) clouds.push({ x: source.x, y: source.y, z: source.z, floor,
        born: 0, life: Infinity, strength: 1.25, seed: source.seed, kind: 'vent', radius: 1, bounds: source.bounds });
      for (const i of field.cells) {
        const strength = field.air[i]; if (strength < this.coverageThreshold * .6) continue;
        const p = field.points[i]; clouds.push({ x: p.x, y: 1.55, z: p.z, floor, born: 0, life: Infinity,
          strength: Math.min(1.5, .12 + Math.sqrt(strength) * 1.7), seed: i * .61803399, kind: 'field', radius: field.grid.cell * .32 });
      }
      this.drawClouds=clouds;this.drawFloor=floor;this.drawSourceActive=source.active;this.nextCloudDraw=this.time+.2;
      }
      this.renderer.draw(view, this.drawClouds, this.time);
      this.points = this.renderer.points;
    }

    dispose() { for(const a of this.s.agents){a.ventilationAffected=false;a.ventilationDose=0;}this.disposed = true; this.renderer?.dispose(); this.points = null; this.floors = []; this.sources = []; }
  }
  L.OfficeVentilation = OfficeVentilation;
})();
