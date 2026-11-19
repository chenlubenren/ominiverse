/* Reversible scene edits share the visible world and its navigation footprint. */
(() => {
  'use strict';const C=window.CoScene,T=THREE,L=window.IndoorLab;
  const catalog={plant:{name:'绿植',w:.62,d:.62,h:1.15},chair:{name:'座椅',w:.68,d:.72,h:.95},cargo:{name:'补给箱',w:.72,d:.60,h:.65},instrument:{name:'实验仪器',w:.68,d:.62,h:1.10}};
  const cloneGrid=g=>{const copy=new L.Grid({minX:g.minX,maxX:g.maxX,minZ:g.minZ,maxZ:g.maxZ},g.cell);copy.solid.set(g.solid);copy.support.set(g.support);copy.finalize();return copy;};
  function raster(grid,items){for(const b of items)for(let i=0;i<grid.size;i++){const p=grid.point(i);if(Math.abs(p.x-b.x)<=b.w/2+grid.cell*.6&&Math.abs(p.z-b.z)<=b.d/2+grid.cell*.6)grid.solid[i]=1;}grid.finalize();return grid;}
  class SceneCustomization {
    constructor(owner){this.o=owner;this.states=new Map();this.serial=0;const tower=owner.b.continuous;if(tower){const build=tower.build.bind(tower);tower.build=(...args)=>{const result=build(...args);for(const state of this.states.values())if(state.environment==='office'){this.syncOfficeColliders(state);for(const [surface,style]of state.styles)this.applyStyle(state,surface,style);}return result;};}}
    state(){const o=this.o,ctx=o.currentContext(),key=o.key();if(!this.states.has(key)){const group=new T.Group();group.name='聊天布置 · '+key;group.userData.noAO=true;ctx.world.root.add(group);this.states.set(key,{key,ctx,group,items:[],history:[],styles:new Map(),originalMaterials:new Map(),clones:new Set(),baseGrid:cloneGrid(ctx.sim.grid),baseColliders:[...(ctx.world.colliders||[])],environment:o.environment,floor:o.environment==='office'?o.b.selected:null});}return this.states.get(key);}
    label(state){return state.environment==='office'?state.floor+'F 办公楼':state.environment==='campus'?'园区':state.ctx.world.spec.name;}
    dirty(){const v=this.o.v;v.shadowDirty=true;v.renderer.shadowMap.needsUpdate=true;v.pipeline._aoExcluded=null;const ao=this.o.stationExperience?.ao;if(ao)ao._cacheKey=null;}
    themeNodes(state,surface){
      const o=this.o,roots=state.environment==='office'?this.officeModels(state.floor).map(model=>model.group):[state.environment==='station'?state.ctx.world.root:o.campusAmenities],nodes=[];
      for(const root of new Set(roots))root?.traverse(node=>{if(!node.isMesh||!node.material||Array.isArray(node.material)||node.userData.sceneDecoration)return;const name=node.name.split(' / ').at(-1),furnitureTone=node.geometry?.userData.furnitureKey?.split(':').at(-1);let matches=surface==='floor'?name==='floor':surface==='wall'?name==='wall'||name==='shell'||name==='white':['blue','chair','fabric','accent'].includes(name)||['blue','navy','pale'].includes(furnitureTone);
        if(state.environment==='campus')matches=surface==='accent'&&(node.material===o.b.materials.blue||state.originalMaterials.get(node)?.material===o.b.materials.blue);
        if(matches)nodes.push(node);
      });return nodes;
    }
    applyStyle(state,surface,style){
      const nodes=this.themeNodes(state,surface);if(!nodes.length)throw Error('此处没有可单独修改的'+({floor:'地板',wall:'墙面',accent:'装饰'})+'。园区可发送“装饰改成橙色”。');
      for(const node of nodes){let record=state.originalMaterials.get(node);if(style){if(!record){const original=node.material,material=original.clone();material.userData={...original.userData,styleLocked:true};record={material:original,surface};state.originalMaterials.set(node,record);state.clones.add(material);node.material=material;}node.material.color.set(style.color).convertSRGBToLinear();}else if(record){const material=node.material;node.material=record.material;state.originalMaterials.delete(node);state.clones.delete(material);material.dispose();}}
      if(style)state.styles.set(surface,style);else state.styles.delete(surface);this.dirty();
    }
    recolor(surface,color,label){const state=this.state(),previous=state.styles.get(surface)||null;this.applyStyle(state,surface,{color,label});state.history.push({kind:'style',surface,previous});return this.label(state)+'的'+({floor:'地板',wall:'墙面',accent:'装饰配色'}[surface])+'已改为'+label+'。发送“撤销装饰”可恢复。';}
    makeObject(kind,station,color){
      const group=new T.Group(),materials={shell:C.material('#e8eef3'),accent:C.material(color||'#6b9bc4'),dark:C.material('#364e65'),leaf:C.material('#639e7a'),strap:C.material('#e69a50')};
      const part=(shape,key,size,pos,rotation)=>{const mesh=C.part(group,shape,materials[key],size,pos,rotation);mesh.userData.sceneDecoration=true;return mesh;};
      if(kind==='plant'){part('cylinder','shell',[.54,.42,.54],[0,.21,0]);part('cylinder','dark',[.05,.62,.05],[0,.66,0]);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;part('sphere','leaf',[.23,.48,.13],[Math.cos(a)*.15,.77+(i%3)*.10,Math.sin(a)*.15],[.35*Math.cos(a),a,.3*Math.sin(a)]);}if(station){part('box','shell',[.65,.06,.65],[0,.03,0]);part('box','accent',[.62,.035,.045],[0,.46,0]);}}
      else if(kind==='chair'){part('box','accent',[.61,.13,.60],[0,.48,0]);part('box','accent',[.61,.46,.12],[0,.73,-.25]);for(const x of [-.24,.24])for(const z of [-.23,.23])part('cylinder','dark',[.045,.42,.045],[x,.22,z]);if(station){part('box','strap',[.045,.04,.58],[0,.57,0]);part('box','strap',[.50,.045,.05],[0,.76,-.17]);}}
      else if(kind==='cargo'){part('box','shell',[.70,.57,.58],[0,.32,0]);part('box','accent',[.72,.08,.60],[0,.65,0]);for(const x of [-.24,.24]){part('box','strap',[.055,.59,.605],[x,.34,0]);part('box','dark',[.065,.025,.15],[x,.655,.05]);}}
      else{part('box','shell',[.64,.65,.58],[0,.36,0]);part('box','dark',[.50,.28,.04],[0,.47,.305]);part('box','accent',[.30,.18,.045],[0,.48,.335]);part('cylinder','shell',[.26,.40,.26],[0,.89,0]);part('cylinder','accent',[.28,.05,.28],[0,1.08,0]);}
      if(station){for(const x of [-.26,.26])for(const z of [-.24,.24])part('box','dark',[.10,.045,.10],[x,.025,z]);group.userData.anchored=true;}
      group.userData.sceneDecoration=true;group.userData.kind=kind;group.name=(station?'固定式 ':'')+catalog[kind].name;return group;
    }
    radius(kind){const spec=catalog[kind];return Math.hypot(spec.w,spec.d)/2+.12;}
    officeModels(floor){const o=this.o;return[...new Set([o.b.society.model(floor),o.b.plates[floor-1]?.model,o.app.model,o.v.model,o.b.continuous?.models[floor-1]].filter(model=>model?.towerFloor===floor))];}
    syncOfficeColliders(state){const items=state.items.map(item=>item.collider);for(const model of this.officeModels(state.floor)){model.dynamicSolids=(model.dynamicSolids||[]).filter(b=>!b.sceneDecoration).concat(items);model.physicsVersion=(model.physicsVersion||0)+1;}if(this.o.v.model?.towerFloor===state.floor)this.o.v.firstPerson.collisionModel=null;}
    candidateGrid(state,items){return state.environment==='campus'?raster(cloneGrid(state.baseGrid),items):C.makeNavigation({...state.ctx.world,colliders:[...state.baseColliders,...items]});}
    valid(state,kind,point){
      const sim=state.ctx.sim,radius=this.radius(kind);if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z)||!sim.grid.isClear(point.x,point.z,radius))return false;
      if(state.ctx.world.getPeople)sim.syncExternalPeople();if(sim.actors().some(a=>Math.hypot(a.x-point.x,a.z-point.z)<a.radius+radius+.25))return false;
      const world=state.ctx.world,office=state.environment==='office'?this.o.b.society.model(state.floor):null,protectedPoints=[world.spawn,world.pickup,...(world.taskPoints||[]),...(world.hatches||[]),...(office?[...(office.doors||[]),{x:-1.6,z:2.4},{x:1.6,z:2.4}]:[])].filter(Boolean);if(protectedPoints.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<radius+.75))return false;
      const collider={...catalog[kind],...point},grid=this.candidateGrid(state,[...state.items.map(i=>i.collider),collider]),before=sim.grid.nav(.3),after=grid.nav(.3),start=grid.nearest(world.spawn,.3);if(start<0)return false;
      // A single furnishing must not disconnect an existing corridor or task point.
      if(after.mainFree.length<before.mainFree.length*.85)return false;
      for(const p of protectedPoints){const old=sim.grid.nearest(p,.3),next=grid.nearest(p,.3);if(old>=0&&before.component[old]===before.largest&&(next<0||after.component[next]!==after.component[start]))return false;}return true;
    }
    choosePoint(state,kind,location){if(location){if(!this.valid(state,kind,location))throw Error('标记位置被占用、太靠近通道或任务点，无法安全放置。请重新标记空闲位置。');return{x:location.x,z:location.z};}
      const sim=state.ctx.sim,origin=state.ctx.world.spawn,candidates=sim.grid.nav(this.radius(kind)).mainFree.map(i=>sim.grid.point(i)).sort((a,b)=>Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z));
      for(const point of candidates.filter((_,i)=>i%5===0).slice(0,160))if(this.valid(state,kind,point))return point;throw Error('当前没有合适的布置空间。可先移除物品，或使用位置标记指定空闲处。');
    }
    refreshNavigation(state,{relocate=false}={}){
      const world=state.ctx.world,items=state.items.map(i=>i.collider);world.colliders=[...state.baseColliders,...items];const grid=this.candidateGrid(state,items);world.grid=grid;
      if(state.ctx.sim.invalidateNavigation)state.ctx.sim.invalidateNavigation(grid,{relocate});else{state.ctx.sim.grid=grid;for(const r of state.ctx.sim.robots)r.blockedTime=5;}
      if(state.environment==='office'){const s=this.o.b.society;this.syncOfficeColliders(state);s.grids.delete(state.floor);if(this.o.environment==='office'&&this.o.b.selected===state.floor)this.o.v.grid=s.grid(state.floor);}
      else if(state.environment==='campus'){const exterior=this.o.b.society.exterior;state.exteriorBase??=cloneGrid(exterior.navigation());state.exteriorDestinations??=[...exterior.destinations];exterior.grid=raster(cloneGrid(state.exteriorBase),items);exterior.destinations=state.exteriorDestinations.filter(p=>exterior.grid.isClear(p.x,p.z,.3));if(this.o.key()===state.key)this.o.v.grid=grid;}
      else if(this.o.key()===state.key)this.o.v.grid=grid;this.dirty();
    }
    refreshContext(ctx){
      const state=this.states.get(ctx.key);if(!state)return false;state.ctx=ctx;state.baseColliders=(ctx.world.colliders||[]).filter(b=>!b.sceneDecoration);state.baseGrid=C.makeNavigation({...ctx.world,colliders:state.baseColliders});const original=[...state.items];state.items=[];ctx.sim.grid=state.baseGrid;let removed=0;
      for(const item of original){if(this.valid(state,item.kind,item.collider)){state.items.push(item);ctx.sim.grid=this.candidateGrid(state,state.items.map(i=>i.collider));}else{this.remove(state,item);removed++;}}
      const styles=[...state.styles];for(const [node,record]of state.originalMaterials){const clone=node.material;node.material=record.material;if(state.clones.has(clone))clone.dispose();}state.originalMaterials.clear();state.clones.clear();state.styles.clear();for(const [surface,style]of styles)this.applyStyle(state,surface,style);state.history=[];this.refreshNavigation(state,{relocate:true});if(removed)this.o.chat.add(this.label(state)+'布局已更新，移除了 '+removed+' 件与新布局冲突的布置物。','现场');return true;
    }
    place(kind,location,color){const state=this.state();if(state.items.length>=12)throw Error('当前空间最多布置 12 件物品，可发送“撤销装饰”或“清除装饰”。');const point=this.choosePoint(state,kind,location),spec=catalog[kind],object=this.makeObject(kind,state.environment==='station',color);object.position.set(point.x,state.environment==='campus'?this.o.b.society.exterior.ground(point.x,point.z):0,point.z);state.group.add(object);
      const item={id:'scene-item-'+(++this.serial),kind,object,collider:{...spec,...point,y:spec.h/2,rotation:0,name:object.name,sceneDecoration:true}};state.items.push(item);state.history.push({kind:'place',item});this.refreshNavigation(state);
      return this.label(state)+'已放置'+object.name+'，坐标 '+point.x.toFixed(1)+'，'+point.z.toFixed(1)+'。'+(state.environment==='station'?'已加固定底座/约束带，避免失重漂散。':'')+'发送“撤销装饰”可移除。';
    }
    remove(state,item){state.items=state.items.filter(i=>i!==item);item.object.parent?.remove(item.object);const materials=new Set();item.object.traverse(o=>{if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());}
    undo(){const state=this.state(),entry=state.history.pop();if(!entry)return'当前空间没有可撤销的装饰操作。';if(entry.kind==='place'){this.remove(state,entry.item);this.refreshNavigation(state);}else this.applyStyle(state,entry.surface,entry.previous);return'已撤销'+this.label(state)+'的上一步装饰操作。';}
    clear(){const state=this.state();for(const item of [...state.items])this.remove(state,item);for(const surface of [...state.styles.keys()])this.applyStyle(state,surface,null);state.history=[];this.refreshNavigation(state);return'已清除'+this.label(state)+'的新增物品，并恢复原有装饰配色。';}
  }
  C.SceneCustomization=SceneCustomization;C.sceneItemCatalog=catalog;
})();
