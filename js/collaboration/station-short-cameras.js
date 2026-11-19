/* Shot composition only: track real action, keep hands clear of foreground heads. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,V=p=>p?.isVector3?p.clone():new T.Vector3(...p),clamp=T.MathUtils.clamp;
  const smooth=u=>{u=clamp(u,0,1);return u*u*(3-2*u);};
  const actor=(id,anchor='chest',weight=1)=>({actor:id,anchor,weight}),prop=(id,weight=1)=>({prop:id,weight}),point=(p,weight=1)=>({point:p,weight});
  // Cameras remain inside the open aisle, with no position placed on a person.
  // The x-positive rack is deliberately kept behind the subjects, never between
  // the lens and a tool. Actual anchors are evaluated after each animation step.
  const layouts={
    water:[
      {position:[.52,2.30,-3.52],target:[prop('cup',2),actor('lead','rightHand',1),actor('lead','chest',.6)],fov:48},
      {position:[1.30,2.65,-3.60],target:[prop('water',1.6),actor('lead','chest',1),actor('science','body',.15)],fov:56},
      {position:[-.20,3.12,-4.55],target:[prop('water',1.3),actor('lead','chest',.65),actor('partner','chest',.65)],fov:61},
      {position:[-.58,2.64,-3.58],target:[prop('water',1.5),prop('electric',.8),actor('partner','chest',.45)],fov:57},
      {position:[.04,2.76,-.72],target:[prop('water',1.6),actor('science','capture',1.25)],fov:49},
      {position:[.09,2.35,-.70],target:[prop('cup',1.4),actor('science','capture',1),actor('science','cup',1)],fov:43},
      {position:[.45,2.55,-4.18],target:[prop('cup',1.5),actor('lead','chest',.75),actor('science','body',.6)],fov:53},
      {position:[.76,2.47,-4.04],target:[prop('cup',1.6),actor('lead','rightHand',1),actor('science','cup',1),actor('lead','chest',.45)],fov:45},
      {position:[.22,2.80,-4.10],positionEnd:[.28,3.00,-4.65],pullStart:28,target:[actor('lead','chest',1),actor('science','body',1),actor('partner','chest',.55)],fov:58}
    ],
    visitor:[
      {position:[.56,2.36,-3.35],target:[prop('crate',1.5),actor('lead','rightHand',1),actor('lead','chest',.55)],fov:49},
      {position:[1.18,2.56,-3.45],target:[prop('alien',1.6),actor('lead','chest',1),prop('crate',.5)],fov:56},
      {position:[-.02,3.12,-4.60],target:[prop('alien',1.3),actor('lead','chest',.6),actor('partner','chest',.6)],fov:63},
      {position:[.95,2.64,-1.02],target:[actor('science','body',1.2),prop('alien',1),prop('lure',.7)],fov:54},
      {position:[1.35,2.72,-3.95],target:[prop('alien',1.5),prop('lure',1),actor('science','capture',.7)],fov:48},
      {position:[.95,2.48,-3.98],target:[prop('bubble',1.2),prop('alien',1.4),actor('lead','chest',.65)],fov:51},
      {position:[.42,2.13,-3.34],target:[prop('alien',1.8),prop('bubble',1),actor('lead','rightHand',.25)],fov:40},
      {position:[.35,2.80,-4.50],target:[prop('bubble',1),actor('lead','chest',.85),actor('science','body',.7)],fov:58},
      {position:[.43,2.20,-3.48],target:[prop('alien',1.5),prop('bubble',1.7),actor('lead','rightHand',.3)],fov:43}
    ],
    rescue:[
      {position:[1.15,2.50,-.83],target:[actor('lead','chest',1),prop('tool',1.4)],fov:52},
      {position:[-.57,2.65,2.20],target:[point([0,1.62,0],1),actor('partner','chest',.7),actor('lead','chest',.35)],fov:54},
      {position:[1.32,2.78,-.76],target:[actor('lead','chest',1),actor('partner','chest',1)],fov:58},
      {position:[1.23,2.66,-1.55],target:[actor('medical','body',1.5),point([0,1.45,0],.75)],fov:56},
      {position:[-1.18,2.66,-2.82],target:[actor('lead','leftHand',1.4),actor('medical','frontRescue',1.4),actor('lead','chest',.7),actor('medical','body',.5)],fov:54},
      {position:[1.08,2.46,-1.26],target:[prop('patch',1.4),prop('rift',1.3),actor('engineer','seal',1)],fov:48},
      {position:[-1.18,2.75,2.65],target:[actor('lead','chest',1),actor('medical','body',1),point([0,1.5,0],.6)],fov:58},
      {position:[-1.32,2.42,2.66],target:[actor('lead','rightHand',1.6),actor('medical','probe',1.6),actor('lead','chest',.7),actor('medical','body',.55)],fov:53},
      {position:[1.30,2.72,3.45],positionEnd:[1.43,3.02,4.20],pullStart:28,target:[actor('lead','chest',1),actor('partner','chest',.8),actor('medical','body',.8)],fov:57}
    ]
  };
  function anchor(f,ref){if(ref.point)return V(ref.point);if(ref.prop)return f.props.get(ref.prop)?.root.getWorldPosition(new T.Vector3());if(ref.actor)return f.anchor(ref.actor,ref.anchor);return null;}
  C.stationShortCamera=(film,shot,t)=>{
    const index=film.story.shots.indexOf(shot);let spec=layouts[film.id]?.[index];if(!spec)return null;
    // After the latch closes, watch the visitor inside the complete frame.
    // Failed captures keep their pursuit composition rather than pointing at
    // a hidden container. This also supplies the matrix's final merge closeup.
    if(film.id==='visitor'&&t>=20&&film.props.get('alien')?.owner==='bubble'&&film.facts?.resultFlags?.['visitor-contained'])spec={position:[.43,2.20,-3.48],target:[prop('alien',1.5),prop('bubble',1.7),actor('lead','rightHand',.3)],fov:43};
    const target=new T.Vector3();let total=0;for(const ref of spec.target){const p=anchor(film,ref);if(p&&p.toArray().every(Number.isFinite)){target.addScaledVector(p,ref.weight);total+=ref.weight;}}
    if(!total)return null;target.multiplyScalar(1/total);
    const u=smooth((t-shot.start)/Math.max(.001,shot.end-shot.start)),position=V(spec.position);
    if(spec.positionEnd)position.lerp(V(spec.positionEnd),smooth((t-(spec.pullStart??shot.start))/Math.max(.001,shot.end-(spec.pullStart??shot.start))));else position.add(V([.045*Math.sin(u*Math.PI),.025*u,-.035*u]));
    // Damp only the look point, so hand motion never shakes the observer's head.
    const previous=film.shortCameraComposition;if(previous?.index===index&&t>=previous.time&&t-previous.time<.2){const alpha=1-Math.exp(-Math.max(0,t-previous.time)*7);target.lerpVectors(previous.target,target,alpha);}
    film.shortCameraComposition={index,time:t,target:target.clone()};
    // A final guard protects later action-blocking changes from putting a
    // character's head directly through the camera near plane.
    for(const a of film.actors){const head=a.model.userData.stationRig?.head?.getWorldPosition(new T.Vector3());if(!head)continue;const delta=position.clone().sub(head),distance=delta.length();if(distance<.66)position.addScaledVector(delta.normalize(),.66-distance);}
    return{position,target,fov:spec.fov};
  };
})();
