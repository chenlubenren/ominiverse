/* Distance-driven stance/swing, shared by native people and skeletal pose atlases. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.IndoorLab.Locomotion=factory();})(typeof window==='undefined'?globalThis:window,()=>{
 const cycleDistance=(fast=false,build=1)=>(fast?1:.38/.6)*build;
 const isFast=a=>['zombie','turning'].includes(a.health)||(a.gaitSpeed??Math.hypot(a.vx||0,a.vz||0))>2;
 function phase(a,fast=false){return(a.gaitPhase??((a.gaitDistance||0)/cycleDistance(fast,a.appearance?.build||1)))+(a.id%17)/17;}
 function foot(phase,side,fast=false){const t=((phase+(side>0?.5:0))%1+1)%1,stance=t<.6,u=stance?t/.6:(t-.6)/.4,stride=fast?.30:.19;return{z:(stance?1-2*u:-1+2*u)*stride,lift:stance?0:Math.sin(Math.PI*u)*(fast?.13:.075),stance};}
 function record(a,time,dt){
  const old=a.locomotionSample;
  const walkingSurface=['floor','stairs','outside'].includes(a.location)||a.location==='escaped'&&a.outdoorFlight;
  const moving=walkingSurface&&a.pose!=='sit'&&a.state==='moving'&&!['hit','flinch','down','dead','grab','bite','turn','struggle'].includes(a.zombieAnim);
  if(a.gaitTick!==time){a.gaitTick=time;a.gaitStep=0;}
  const elapsed=Math.max(.001,dt),distance=old?Math.hypot(a.x-old.x,a.z-old.z):0;
  if(moving&&old?.location===a.location&&distance<=Math.max(.6,dt*5)){
   a.gaitDistance=(a.gaitDistance||0)+distance;
   a.gaitStep+=distance;
   a.gaitSpeed=a.gaitStep/elapsed;
   a.gaitPhase=(a.gaitPhase||0)+distance/cycleDistance(isFast(a),a.appearance?.build||1);
  }
  a.gaitSpeed=a.gaitStep/elapsed;
  a.locomotionSample={x:a.x,z:a.z,location:a.location};
 }
 return{cycleDistance,isFast,phase,foot,record};
});
