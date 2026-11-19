/* Small position pins share the existing scene and follow the tower's floor transforms. */
(() => {
  'use strict';const C=window.CoScene,T=THREE;
  class SceneMarkers {
    constructor(owner){this.owner=owner;this.items=[];this.serial=0;this.overlay=document.createElement('div');this.overlay.id='co-scene-markers';document.body.appendChild(this.overlay);}
    number(location){return String(location.id).replace('location-','');}
    label(location){const name=location.environment==='office'?location.floor+'F 办公楼':location.environment==='campus'?'楼外园区':'空间站 · '+(C.stationModule(location.module)?.name||'舱内');return '标记 '+this.number(location)+' · '+name+' · '+location.x.toFixed(1)+', '+location.z.toFixed(1);}
    pick(event){
      const o=this.owner,v=o.v,b=o.b,rect=v.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();v.camera.updateMatrixWorld(true);
      ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),v.camera);
      let floor=b.selected,point=new T.Vector3(),bounds;
      if(o.environment==='office'&&b.phase!=='interior'){
        floor=b.pickFloor(event);if(!floor)return null;
        const origin=b.plates[floor-1].group.getWorldPosition(new T.Vector3());
        const hit=ray.intersectObjects(b.pickable,true).find(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});
        if(!hit)return null;point.copy(hit.point).sub(origin);bounds=b.society.model(floor).bounds;
        point.x=T.MathUtils.clamp(point.x,bounds.minX+.2,bounds.maxX-.2);point.z=T.MathUtils.clamp(point.z,bounds.minZ+.2,bounds.maxZ-.2);
      }else{
        if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-(v.floorOrigin?.y||0)),point))return null;
        if(v.floorOrigin)point.sub(v.floorOrigin);
        bounds=o.environment==='office'?v.bounds:o.currentContext().world.bounds;
        if(point.x<bounds.minX||point.x>bounds.maxX||point.z<bounds.minZ||point.z>bounds.maxZ)return null;
      }
      return{id:'location-'+(++this.serial),environment:o.environment,floor:o.environment==='office'?floor:null,module:o.environment==='station'?o.stationExperience.selected:null,x:Number(point.x.toFixed(2)),z:Number(point.z.toFixed(2))};
    }
    show(location,pending=false){
      this.remove(location.id);const root=new T.Group();root.name='聊天位置标记';root.userData.noAO=true;
      const color='#2589df';
      const material=new T.MeshBasicMaterial({color,transparent:true,opacity:.95,depthTest:true});
      const ring=new T.Mesh(new T.RingGeometry(.42,.54,40),material);ring.rotation.x=-Math.PI/2;ring.position.y=.055;root.add(ring);
      const stem=new T.Mesh(new T.CylinderGeometry(.045,.045,1.25,8),material);stem.position.y=.69;root.add(stem);
      const head=new T.Mesh(new T.SphereGeometry(.18,16,12),material);head.position.y=1.4;root.add(head);
      const halo=new T.Mesh(new T.SphereGeometry(.19,16,12),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.35}));halo.position.y=1.4;root.add(halo);
      const badge=document.createElement('div');badge.className='co-scene-marker'+(pending?' is-pending':'');badge.setAttribute('aria-label',this.label(location));
      const dot=document.createElement('b'),caption=document.createElement('span');dot.textContent=this.number(location);caption.textContent=pending?'待发送':location.environment==='office'?location.floor+'F · 位置标记':'位置标记';badge.append(dot,caption);this.overlay.appendChild(badge);
      if(location.environment==='station')this.owner.stationExperience.getRoom(location.module||this.owner.stationExperience.selected).root.add(root);else this.owner.v.scene.add(root);this.owner.v.pipeline._aoExcluded=null;this.items.push({location,root,badge,ring});while(this.items.length>12)this.remove(this.items[0].location.id);this.update();return root;
    }
    remove(id){const i=this.items.findIndex(item=>item.location.id===id);if(i<0)return;const {root,badge}=this.items[i];badge.remove();root.parent?.remove(root);const materials=new Set();root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());this.items.splice(i,1);}
    update(){
      if(!this.items.length)return;
      const o=this.owner,b=o.b,rect=o.v.renderer.domElement.getBoundingClientRect();o.v.camera.updateMatrixWorld(true);
      for(const {location:p,root,badge}of this.items){root.visible=p.environment===o.environment&&(p.environment!=='office'||b.phase!=='intro'&&(b.phase!=='interior'||p.floor===b.selected))&&(p.environment!=='station'||o.stationExperience.phase==='interior'&&(!p.module||p.module===o.stationExperience.selected));badge.hidden=!root.visible;if(!root.visible)continue;
        const base=new T.Vector3();if(p.environment==='office'){
          if(b.phase==='interior'){if(o.v.floorOrigin)base.copy(o.v.floorOrigin);else base.y=b.continuous.active?(p.floor-b.continuous.origin)*3.6:0;}
          else{b.plates[p.floor-1].group.getWorldPosition(base);base.y+=.82;}
        }else if(p.environment==='campus')base.y=b.society.exterior.ground(p.x,p.z);
        root.position.set(base.x+p.x,base.y,base.z+p.z);
        const screen=root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,1.55,0)).project(o.v.camera);badge.hidden=screen.z< -1||screen.z>1||Math.abs(screen.x)>1||Math.abs(screen.y)>1;
        if(!badge.hidden){badge.style.left=(rect.left+(screen.x+1)*rect.width/2)+'px';badge.style.top=(rect.top+(1-screen.y)*rect.height/2)+'px';}
      }
    }
    async reveal(location){
      const o=this.owner,scenarios=o.stationExperience?.scenarios;if(scenarios?.blocksObservation??scenarios?.active){o.chat.add('请先停止剧情，再查看日常场景的位置标记。','未执行');return;}if(o.switching)return;o.chat.close(false);
      if(o.environment!==location.environment)await o.switchEnvironment(location.environment);
      if(o.environment!==location.environment)return;
      if(location.environment==='station'&&(o.stationExperience.shellStudy?.changed||o.stationExperience.morphBusy)){o.chat.add('请先恢复原貌，再查看舱内位置标记。','未执行');return;}
      if(location.environment==='office'){if(o.b.phase!=='interior'||o.b.selected!==location.floor)await o.b.enterFloor(location.floor);o.originalSetView('detail');}
      else if(location.environment==='station'){o.stationExperience.enter(location.module||o.stationExperience.selected,{animate:false});o.externalCamera('detail',false);}else o.externalCamera('detail');
      o.following=false;this.show(location);const pin=this.items.find(i=>i.location.id===location.id);const target=pin.root.position.clone().add(new T.Vector3(0,.6,0));if(o.v.floorOrigin)target.sub(o.v.floorOrigin);o.v.controls.target.copy(target);o.v.camera.position.copy(target).add(new T.Vector3(6,5,7));o.v.controls.update();o.v.shadowDirty=true;
    }
  }
  C.SceneMarkers=SceneMarkers;
})();
