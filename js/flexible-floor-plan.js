/* Variable-size rooms around a protected lift/stair circulation spine. */
(() => {
 const L=window.IndoorLab;
 L.randomFloorPlan=(floor,r)=>{
  const rooms=[],split=(x0,x1,sign,count)=>{const min=4.6,extra=x1-x0-count*min,weights=Array.from({length:count},()=>.3+r()),sum=weights.reduce((a,b)=>a+b,0);let x=x0;for(let i=0;i<count;i++){const w=min+extra*weights[i]/sum,front=4.8+r()*1.05;rooms.push({x0:x,x1:x+w,sign,front,height:2.35+r()*.5,glass:r()<.25,kind:'work',seed:Math.floor(r()*1e6)});x+=w;}};
  split(-17.7,17.7,-1,4+Math.floor(r()*2));
  if(floor===1){split(-17.7,-3.4,1,2);split(3.4,17.7,1,2);}else split(-17.7,17.7,1,4+Math.floor(r()*2));
  if(floor===1){const south=rooms.filter(q=>q.sign===1);south[0].kind='reception';south.at(-1).kind='reception';}
  const order=rooms.map((_,i)=>i).filter(i=>rooms[i].kind!=='reception');for(let i=order.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  ['toilet','coffee','meeting','lounge'].forEach((kind,i)=>rooms[order[i]].kind=kind);
  const coreRooms=floor===1?[]:[-1,1].map(side=>({
   x:side*(7.2+r()*.45),w:2.9+r()*.45,front:-1.38-r()*.25,back:1.45+r()*.25,
   glass:r()<.45,kind:side<0?'focus':'consult'
  }));
  return{rooms,coreRooms};
 };
 L.buildFlexibleFloor=({spec,kit,box,wall,doorWall,registerRoom,anchor,text,goals,seats,semanticDoor})=>{
  const rooms=spec.plan.rooms,names={work:'办公工区',meeting:'团队会议室',lounge:'会客休闲',coffee:'茶水间',toilet:'卫生间',reception:'前台接待'};
  for(let i=0;i<rooms.length;i++){
   const r=rooms[i],w=r.x1-r.x0,d=12.65-r.front,cx=(r.x0+r.x1)/2,cz=r.sign*(r.front+d/2),front=r.sign*r.front,back=r.sign*12.65,room='flex-'+i,start=seats.length,opts={key:r.glass?'glass':'wall',h:r.height};
   doorWall('x',front,r.x0,r.x1,cx,1.65,{...opts,roomId:room,name:names[r.kind]});
   const previous=rooms[i-1],next=rooms[i+1],adjoins=(neighbor,edge)=>neighbor?.sign===r.sign&&Math.abs(edge)<.01;
   const edge=adjoins(previous,previous?.x1-r.x0)?Math.min(previous.front,r.front):r.front;
   wall(.16,12.65-edge,r.x0,r.sign*(edge+12.65)/2,{h:r.height,exterior:Math.abs(r.x0)>17});
   if(!adjoins(next,next?.x0-r.x1))wall(.16,d,r.x1,cz,{h:r.height,exterior:Math.abs(r.x1)>17});
   wall(w,.16,cx,back,{h:r.height,exterior:true});
   registerRoom(room,names[r.kind],r.x0,r.x1,Math.min(front,back),Math.max(front,back));
   kit.room=room;kit.at(cx,cz,r.sign===1?Math.PI:0,()=>{
    const cols=Math.max(1,Math.floor((w-1.5)/1.9)),rows=Math.max(1,Math.floor((d-2.9)/2.65)+1);
    if(r.kind==='work'){for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)kit.desk((col-(cols-1)/2)*1.9,-d/2+1.0+row*2.65);}
    else if(r.kind==='meeting')kit.table(0,-.25,{w:Math.min(w-2.0,5.2),d:1.3,chairs:Math.max(4,2*Math.floor((w-1.8)/1.25)),kind:'meeting'});
    else if(r.kind==='lounge'){kit.sofa(0,-.7,0,{width:Math.min(w-1.6,3.8)});kit.b('desk',1.6,.08,.7,0,.44,.5,{name:'会客茶几'});kit.chair(0,1.5,Math.PI,{kind:'lounge',name:'访客座椅'});}
    else if(r.kind==='coffee'){kit.coffee(0,-d/2+.6,0,Math.min(w-1.2,3.5));kit.feature('coffee','茶水间',0,-d/2+1.6);}
    else if(r.kind==='toilet'){kit.b('desk',.65,.46,.8,-w*.23,.23,-d/2+1);kit.b('desk',.9,.82,.45,w*.2,.41,-d/2+.6);kit.feature('toilet','卫生间',0,-d/2+2);}
    else if(r.kind==='reception'){kit.b('desk',Math.min(w-1.2,3.5),1.0,.75,0,.5,.4,{name:'接待前台'});kit.chair(0,-.65,0,{kind:'staff',name:'接待工作椅'});kit.feature('reception','前台接待',0,1.5);}
   });
   const entry={x:cx,z:front-r.sign*.8};anchor(room,r.kind,names[r.kind],entry.x,entry.z,{seats:seats.slice(start).map(s=>s.id),doorApproach:{x:cx,z:front+r.sign*.8},roomBounds:{minX:r.x0,maxX:r.x1,minZ:Math.min(front,back),maxZ:Math.max(front,back)}});goals.push({id:20+i,name:names[r.kind],...entry});text(names[r.kind],cx,front+r.sign*.4,Math.min(3.5,w-.7));
  }
  for(const [i,room]of (spec.plan.coreRooms||[]).entries()){
   const {x,w,front,back}=room,left=x-w/2,right=x+w/2,depth=back-front;
   const id='core-room-'+i,name=room.kind==='focus'?'专注室':'洽谈室',start=seats.length;
   doorWall('x',front,left,right,x,1.4,{key:room.glass?'glass':'wall',roomId:id,name});
   wall(w,.16,x,back);
   for(const edge of [left,right])wall(.16,depth,edge,(front+back)/2);
   registerRoom(id,name,left,right,front,back);
   kit.room=id;
   kit.desk(x,back-.50,Math.PI,{seat:false,width:1.4,name});
   kit.chair(x,back-1.22,0,{kind:'lounge',name:name+'座位'});
   const entry={x,z:front-.75};
   anchor(id,'lounge',name,entry.x,entry.z,{seats:seats.slice(start).map(s=>s.id),doorApproach:{x,z:front+.42},roomBounds:{minX:left,maxX:right,minZ:front,maxZ:back}});
   goals.push({id:60+i,name,...entry});
   text(name,x,front+.25,1.9);
  }
  kit.room='public';kit.printer(-8.2,2.5);anchor('print','print','共享打印区',-8.2,1.5);anchor('social','chat','交流碰面',8.2,-2.7);goals.push({id:5,name:'公共交流区',x:0,z:-4.0},{id:8,name:'电梯厅',x:0,z:3.7});
  if(spec.floor===1){semanticDoor('mainExitDoor','一楼主入口 / 室外出口',0,12.2,'x',6,{external:true});anchor('entry','entry','一楼主入口',0,12.1);anchor('gallery','gallery','企业展示',0,-4.2);anchor('reception','reception','前台接待',-8.5,4.0);anchor('reception-east','reception','前台接待',8.5,4.0);for(const sign of [-1,1])anchor('guard-'+sign,'guard','入口值守',sign*2.6,10.6);goals.push({id:11,name:'大厅主入口',x:0,z:12.1,external:true});}
 };
})();
