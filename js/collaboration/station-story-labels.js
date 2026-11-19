/* Projected story status cards; independent of the daily robot label layer. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE;
  const robotNames={science:'科研机器人',medical:'医疗机器人',cargo:'运输机器人'};
  const intersects=(a,b,gap=7)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
  const write=(node,value)=>{const text=String(value||'');if(node.textContent!==text)node.textContent=text;};

  class StationStoryLabels {
    constructor(director){
      this.director=director;this.items=new Map();this.disposed=false;
      this.root=document.createElement('div');this.root.className='st-story-labels';this.root.setAttribute('aria-label','情景中的机器人与船员状态');this.root.hidden=true;document.body.appendChild(this.root);
      this.point=new T.Vector3();this.cameraPoint=new T.Vector3();
    }
    create(key,crew=false){
      const element=document.createElement('div');element.className=crew?'st-story-crew-badge':'st-story-robot-badge';element.dataset.storyLabel=crew?'crew':'robot';
      const title=document.createElement('b'),status=document.createElement('span'),task=document.createElement('small');element.append(title,status,task);this.root.appendChild(element);
      const leader=crew?null:document.createElement('i');if(leader){leader.className='st-story-label-link';leader.hidden=true;leader.setAttribute('aria-hidden','true');this.root.insertBefore(leader,element);}
      const item={element,title,status,task,crew,leader};this.items.set(key,item);return item;
    }
    visible(element){return !!element&&!element.hidden&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none';}
    blockers(){
      // Capture styling can hide the story panels without hiding these badges.
      return [...document.querySelectorAll('#co-observation-chat,.st-story-header,.st-story-caption,.st-story-matrix')].filter(el=>this.visible(el)).map(el=>el.getBoundingClientRect());
    }
    subjectBlockers(canvas){
      const d=this.director,camera=d.camera,blocked=[],right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      if(d.robot?.model?.visible){
        const model=d.robot.model;model.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(model),rect={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        if(!box.isEmpty())for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const point=new T.Vector3(x,y,z),view=point.clone().applyMatrix4(camera.matrixWorldInverse);if(view.z>=-camera.near)continue;point.project(camera);const sx=canvas.left+(point.x+1)*canvas.width/2,sy=canvas.top+(1-point.y)*canvas.height/2;rect.left=Math.min(rect.left,sx);rect.right=Math.max(rect.right,sx);rect.top=Math.min(rect.top,sy);rect.bottom=Math.max(rect.bottom,sy);}
        if(Number.isFinite(rect.left))blocked.push(rect);
      }
      const protect=(center,radius)=>{
        const p=center.clone().project(camera),view=center.clone().applyMatrix4(camera.matrixWorldInverse);if(view.z>=-camera.near||p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)return;
        const x=canvas.left+(p.x+1)*canvas.width/2,y=canvas.top+(1-p.y)*canvas.height/2,edgeX=center.clone().addScaledVector(right,radius).project(camera),edgeY=center.clone().addScaledVector(up,radius).project(camera),rx=Math.max(10,Math.abs(edgeX.x-p.x)*canvas.width/2),ry=Math.max(10,Math.abs(edgeY.y-p.y)*canvas.height/2);
        blocked.push({left:x-rx,right:x+rx,top:y-ry,bottom:y+ry});
      };
      for(const actor of (d.stageActors||[]).slice(0,2)){
        if(!actor.model?.visible)continue;actor.model.updateWorldMatrix(true,true);const rig=actor.model.userData.stationRig;
        if(rig?.head)protect(rig.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.08,0)),.23);
        for(const side of ['left','right'])if(rig?.[side+'Hand'])protect(rig[side+'Hand'].getWorldPosition(new T.Vector3()),.16);
      }
      if(d.event?.visible){d.event.updateWorldMatrix(true,false);const alien=d.story?.effect==='alien'||d.options?.scenario==='visitor';protect(d.event.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,alien?.48:0,0)),alien?.34:.28);}
      return blocked;
    }
    anchor(model,crew){
      if(!model)return null;for(let parent=model;parent;parent=parent.parent)if(!parent.visible)return null;
      model.updateWorldMatrix(true,true);
      const head=crew&&model.userData.stationRig?.head;
      if(head)head.getWorldPosition(this.point).add(new T.Vector3(0,.20,0));
      else{model.getWorldPosition(this.point);this.point.y+=(model.userData.height||(crew?1.78:1.5))+.24;}
      return this.point;
    }
    place(item,model,canvas,bounds,blocked){
      const point=this.anchor(model,item.crew),element=item.element,camera=this.director.camera;
      if(item.leader)item.leader.hidden=true;
      if(!point){element.hidden=true;return;}
      this.cameraPoint.copy(point).applyMatrix4(camera.matrixWorldInverse);
      point.project(camera);
      if(this.cameraPoint.z>=-camera.near||!point.toArray().every(Number.isFinite)||point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1){element.hidden=true;return;}
      const anchor={x:canvas.left+(point.x+1)*canvas.width/2,y:canvas.top+(1-point.y)*canvas.height/2};
      element.hidden=false;element.style.visibility='hidden';element.style.maxWidth=Math.max(90,Math.min(item.crew?180:230,bounds.right-bounds.left))+'px';
      const w=element.offsetWidth,h=element.offsetHeight;
      if(w>bounds.right-bounds.left||h>bounds.bottom-bounds.top){element.hidden=true;element.style.visibility='';return;}
      const candidates=[],add=(x,y)=>{x=Math.max(bounds.left,Math.min(bounds.right-w,x));y=Math.max(bounds.top,Math.min(bounds.bottom-h,y));const rect={left:x,top:y,right:x+w,bottom:y+h};if(blocked.some(b=>intersects(rect,b)))return;const score=(x+w/2-anchor.x)**2+(y+h-anchor.y)**2;candidates.push({rect,score});};
      add(anchor.x-w/2,anchor.y-h-10);add(anchor.x+15,anchor.y-h/2);add(anchor.x-w-15,anchor.y-h/2);add(anchor.x-w/2,anchor.y+14);
      for(const dy of [-72,-140,72,140])for(const dx of [0,-w*.7,w*.7])add(anchor.x-w/2+dx,anchor.y-h+dy);
      // The robot status has priority on compact screens. Search remaining
      // free space before hiding it; crew cards may yield when space is tight.
      if(!candidates.length&&!item.crew)for(let y=bounds.top;y<=bounds.bottom-h;y+=24)for(let x=bounds.left;x<=bounds.right-w;x+=28)add(x,y);
      candidates.sort((a,b)=>a.score-b.score);const chosen=candidates[0];
      if(!chosen){element.hidden=true;element.style.visibility='';return;}
      element.style.left=Math.round(chosen.rect.left)+'px';element.style.top=Math.round(chosen.rect.top)+'px';element.style.visibility='';blocked.push(chosen.rect);
      if(item.leader){const x=Math.max(chosen.rect.left,Math.min(chosen.rect.right,anchor.x)),y=Math.max(chosen.rect.top,Math.min(chosen.rect.bottom,anchor.y)),dx=anchor.x-x,dy=anchor.y-y,length=Math.hypot(dx,dy);if(length>26){item.leader.hidden=false;item.leader.style.left=x+'px';item.leader.style.top=y+'px';item.leader.style.width=length+'px';item.leader.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';}}
    }
    update(){
      if(this.disposed)return;const d=this.director,renderer=d.s?.v?.renderer||d.renderer,canvasElement=renderer?.domElement;
      this.root.hidden=!d.active||!!d.loading||!d.camera||!canvasElement;
      if(this.root.hidden)return;
      this.root.classList.toggle('is-cinematic',!!d.options?.cinematic);
      const canvas=canvasElement.getBoundingClientRect(),bounds={left:Math.max(8,canvas.left+8),right:Math.min(innerWidth-8,canvas.right-8),top:Math.max(8,canvas.top+8),bottom:Math.min(innerHeight-8,canvas.bottom-8)};
      if(bounds.right<=bounds.left||bounds.bottom<=bounds.top){this.root.hidden=true;return;}
      d.camera.updateWorldMatrix(true,false);const blocked=[...this.blockers(),...this.subjectBlockers(canvas)],live=new Set();
      if(d.robot?.model){
        const robot=d.robot,item=this.items.get('robot')||this.create('robot');live.add('robot');
        const name=robot.name||robot.spec?.name||d.design?.name||robotNames[d.options?.robot]||'协作机器人',current=d.outcome?.title||robot.status||'等待现场指令';
        write(item.title,'机器人 · '+name);write(item.status,(d.paused?'已暂停 · ':'')+current);write(item.task,'任务：'+(robot.taskLabel||robot.spec?.taskText||d.story?.title||d.title||'空间站应急协作'));
        item.element.dataset.state=d.paused?'paused':d.outcome?'complete':'active';item.element.title=item.status.textContent+'\n'+item.task.textContent;this.place(item,robot.model,canvas,bounds,blocked);
      }
      for(const [index,actor]of (d.stageActors||[]).slice(0,2).entries()){
        if(!actor.model)continue;const key='crew:'+String(actor.id||actor.source?.id||actor.model.uuid||index),item=this.items.get(key)||this.create(key,true);live.add(key);
        const name=actor.name||actor.source?.name||'船员 '+(index+1),role=actor.roleLabel||actor.role;
        write(item.title,role||name);write(item.status,(d.paused?'已暂停 · ':'')+(actor.actionLabel||actor.status||'观察现场'));item.task.hidden=true;item.element.dataset.state=d.paused?'paused':'active';this.place(item,actor.model,canvas,bounds,blocked);
      }
      for(const [key,item]of this.items)if(!live.has(key)){item.element.remove();item.leader?.remove();this.items.delete(key);}
    }
    dispose(){if(this.disposed)return;this.disposed=true;this.root.remove();this.items.clear();this.director=null;}
  }
  C.StationStoryLabels=StationStoryLabels;
})();
