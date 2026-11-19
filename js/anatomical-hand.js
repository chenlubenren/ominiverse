/* Wrist-aligned palms. Fingers bend around local knuckles instead of world Y. */
(() => {
 'use strict';const T=THREE,L=window.IndoorLab,origin=new T.Vector3(),direction=new T.Vector3(),point=new T.Vector3(),up=new T.Vector3(0,1,0),result={palm:[0,0,0],rotation:new T.Quaternion(),fingers:[...Array.from({length:4},()=>Array.from({length:4},()=>[0,0,0])),Array.from({length:3},()=>[0,0,0])]};
 const at=(out,x,y,z)=>point.set(x,y,z).applyQuaternion(result.rotation).add(origin).toArray(out);
 L.anatomicalHand=(wrist,elbow,side,curl=.18)=>{
  origin.fromArray(wrist);direction.copy(origin).sub(point.fromArray(elbow)).normalize();result.rotation.setFromUnitVectors(up,direction);
  for(let f=0;f<4;f++){const x=(f-1.5)*.014,length=[.057,.064,.059,.045][f],points=result.fingers[f];at(points[0],x,.064,0);let y=.064,z=0;for(let j=0;j<3;j++){const fraction=[.43,.33,.24][j],angle=curl*[.7,1.35,1.9][j];y+=Math.cos(angle)*length*fraction;z+=Math.sin(angle)*length*fraction;at(points[j+1],x,y,z);}}
  at(result.fingers[4][0],side*.027,.016,.003);at(result.fingers[4][1],side*.043,.032,.012);at(result.fingers[4][2],side*.037,.054,.025);at(result.palm,0,.032,0);return result;
 };
})();
