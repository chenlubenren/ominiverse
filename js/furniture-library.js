/* Clean, closed furniture meshes. TRELLIS studies informed silhouettes; the
 * shipped shapes are rebuilt with solid primitives and explicit supports. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE;
  const colors={white:'#edf3f7',blue:'#6a9ec7',navy:'#3879ac',pale:'#b3cde0',metal:'#a9bbc8',dark:'#435c70',screen:'#294d68',green:'#629987',soil:'#65736d'};
  function merge(items){const arrays={position:[],normal:[],uv:[]};for(const g of items){const n=g.index?g.toNonIndexed():g;for(const key of Object.keys(arrays))arrays[key].push(...n.attributes[key].array);if(n!==g)n.dispose();g.dispose();}const g=new T.BufferGeometry();for(const key of Object.keys(arrays))g.setAttribute(key,new T.Float32BufferAttribute(arrays[key],key==='uv'?2:3));g.computeBoundingBox();g.computeBoundingSphere();return g;}
  function roundedBox(w,h,d,r,detail){
    r=Math.min(r,w*.24,h*.24,d*.24);if(!detail||r<.004)return new T.BoxGeometry(w,h,d);
    const g=new T.BoxGeometry(2,2,2,3,3,3),p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){
      const v=new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)),half=[w/2,h/2,d/2];
      for(let k=0;k<3;k++){const x=v.getComponent(k);v.setComponent(k,Math.abs(x)>.9?Math.sign(x)*half[k]:Math.sign(x)*(half[k]-r));}
      const inner=v.clone().clamp(new T.Vector3(-w/2+r,-h/2+r,-d/2+r),new T.Vector3(w/2-r,h/2-r,d/2-r)),normal=v.clone().sub(inner).normalize();v.copy(inner).addScaledVector(normal,r);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
    }return g;
  }
  const types=['office-chair','task-chair','meeting-chair','cantilever-chair','guest-chair','visitor-chair','sofa','lounge-sofa','plant','office-cabinet','bookcase','workstation','meeting-table','coffee-table','reception','printer','coffee-station','display'];
  function build(kind,detail=true,columns=2,dimensions={}){
    const pieces=new Map(),segments=detail?12:6;
    function add(key,g,x=0,y=0,z=0,rotation){const q=new T.Quaternion();if(rotation)q.setFromEuler(new T.Euler(...rotation));g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1)));if(!pieces.has(key))pieces.set(key,[]);pieces.get(key).push(g);}
    const box=(key,w,h,d,x,y,z,r=.025,rot)=>add(key,roundedBox(w,h,d,r,detail),x,y,z,rot);
    const ball=(key,x,y,z,sx,sy=sx,sz=sx)=>{const g=new T.SphereGeometry(1,detail?12:8,detail?8:6);g.scale(sx,sy,sz);add(key,g,x,y,z);};
    function rod(key,a,b,r=.018){const from=new T.Vector3(...a),to=new T.Vector3(...b),v=to.clone().sub(from),g=new T.CylinderGeometry(r,r,v.length(),segments,1,false);g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize())));const at=from.add(to).multiplyScalar(.5);add(key,g,at.x,at.y,at.z);}
    function bend(key,points,r=.018){for(let i=1;i<points.length;i++)rod(key,points[i-1],points[i],r);for(const p of points.slice(1,-1))ball(key,...p,r);}
    const leg=(x,z,top=.735)=>rod('white',[x,0,z],[x,top,z],.027);
    let size=[1,1,1];
    if(kind.endsWith('chair')){
      size=[.60,1,.59];
      const visitor=kind==='visitor-chair',guest=kind==='guest-chair',sled=kind==='cantilever-chair',white=kind==='task-chair';
      const hue=visitor?'pale':guest?'blue':white?'blue':'navy';
      box(hue,.47,.105,.46,0,.4775,.012,.055); // Every chair shares the .53 m seating plane.
      if(visitor){
        box('pale',.54,.20,.50,0,.355,-.005,.04);box('pale',.51,.43,.10,0,.705,-.205,.045);
        for(const s of [-1,1]){box('pale',.075,.25,.48,s*.257,.57,-.005,.035);for(const z of [-.18,.19])leg(s*.225,z,.27);}
      }else{
        const backH=guest?.36:sled?.43:white?.49:.54;
        box(guest?'white':white?'white':hue,.43,backH,.065,0,.55+backH/2,-.213,.04,[-.07,0,0]);
        if(white){box('blue',.375,backH-.065,.027,0,.55+backH/2,-.17,.023,[-.07,0,0]);for(let i=0;i<5;i++)box('pale',.33,.012,.014,0,.66+i*.057,-.151,.004);}
        if(guest||kind==='meeting-chair'){for(const s of [-1,1])for(const z of [-1,1])rod('metal',[s*.25,.018,z*.24],[s*.19,.43,z*.17],.018);for(const s of [-1,1])for(const z of [-1,1])ball('dark',s*.25,.012,z*.24,.012);rod('metal',[-.19,.36,-.17],[.19,.36,-.17],.012);}
        else if(sled){for(const s of [-1,1])bend('metal',[[s*.24,.025,-.24],[s*.24,.025,.23],[s*.24,.44,.23],[s*.24,.44,-.20]],.022);rod('metal',[-.24,.44,-.20],[.24,.44,-.20],.022);}
        else{
          rod(white?'white':'metal',[0,.115,0],[0,.43,0],.032);
          for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.sin(a)*.235,z=Math.cos(a)*.235;rod(white?'white':'metal',[0,.15,0],[x,.10,z],.022);rod('dark',[x,.045,z-.02],[x,.045,z+.02],.045);rod('dark',[x,.06,z],[x,.10,z],.018);}
          rod(white?'white':'metal',[0,.40,-.18],[0,.66,-.22],.024);
        }
        if(guest||sled||kind==='meeting-chair')for(const s of [-1,1])rod(guest?'white':'metal',[s*.16,.45,-.18],[s*.16,.67,-.22],.018);
        if(!guest)for(const s of [-1,1]){bend(white?'white':'metal',[[s*.23,.45,-.13],[s*.26,.665,-.13],[s*.26,.665,.10]],.016);box(white?'white':'dark',.055,.035,.28,s*.26,.68,-.005,.016);}
      }
    }else if(kind==='sofa'||kind==='lounge-sofa'){
      size=[2.5,1,.82];const low=kind==='lounge-sofa',hue=low?'blue':'pale';
      box(hue,2.44,.24,.75,0,.34,0,.04);box(hue,2.20,.20,.12,0,.49,-.31,.025);
      for(const s of [-1,1]){box(hue,1.055,.11,.61,s*.55,.485,.047,.045);box(hue,1.07,low?.34:.42,.14,s*.55,low?.71:.75,-.31,.045,[-.06,0,0]);box(hue,.13,low?.27:.34,.76,s*1.17,low?.52:.56,0,.035);for(const z of [-.29,.29])rod('white',[s*1.08,0,z],[s*1.08,.22,z],low?.022:.035);}
      if(low){for(const z of [-.29,.29])rod('white',[-1.08,.15,z],[1.08,.15,z],.018);}
    }else if(kind==='workstation'||kind==='meeting-table'){
      const desk=kind==='workstation',w=dimensions.width||(desk?1.5:2.5),d=dimensions.depth||(desk?.76:1.5);size=[w,1,d];
      box('white',w,.065,d,0,.775,0,.026);
      for(const s of [-1,1]){for(const z of [-d*.36,d*.36])leg(s*(w/2-.12),z,.7425);rod('metal',[s*(w/2-.12),.69,-d*.36],[s*(w/2-.12),.69,d*.36],.018);}
      rod('metal',[-w/2+.12,.65,0],[w/2-.12,.65,0],.023);
      if(desk){
        box('metal',.29,.022,.18,0,.82,-.18,.012);rod('white',[0,.83,-.21],[0,1.02,-.21],.025);box('white',.57,.35,.046,0,1.055,-.21,.014);box('screen',.525,.303,.008,0,1.055,-.182,.008);
        box('pale',.44,.017,.16,0,.817,.235,.008);if(detail)for(let row=0;row<3;row++)box('white',.395,.003,.025,0,.827,.185+row*.044,.002);
        ball('white',.36,.832,.235,.034,.022,.049);box('blue',.13,.023,.19,-w*.36,.82,.10,.007);
      }else{box('dark',.45,.028,.27,0,.824,0,.014);box('blue',.40,.004,.23,0,.840,0,.008);}
    }else if(kind==='coffee-table'){
      size=[1,.48,1];box('white',1,.055,1,0,.4525,0,.035);for(const x of [-.38,.38])for(const z of [-.36,.36])rod('metal',[x,0,z],[x,.425,z],.022);
    }else if(kind==='office-cabinet'||kind==='bookcase'||kind==='reception'){
      const open=kind==='bookcase',reception=kind==='reception';size=[2.2,1.25,.42];
      box('dark',2.08,.07,.35,0,.035,0,.01);box('white',2.2,.045,.42,0,1.2275,0,.012);box('white',2.2,.045,.42,0,.0925,0,.012);box('pale',2.12,1.09,.028,0,.66,-.192,.005);
      for(const x of [-1.0775,1.0775])box('white',.045,1.09,.42,x,.66,0,.009);
      for(let i=0;i<columns;i++){const cell=2.11/columns,x=-1.055+cell*(i+.5);if(open){
        for(const y of [.44,.80])box('white',cell,.032,.38,x,y,0,.005);
        if(detail)for(let j=0;j<3;j++)box(j%2?'white':'blue',cell*.11,.22,.23,x-cell*.28+j*cell*.15,.565,.03,.004);
      }else if(reception){box('white',cell-.012,1.09,.035,x,.66,.19,.01);box('blue',cell-.035,.12,.012,x,.88,.216,.005);}
      else{box('white',cell-.014,1.09,.035,x,.66,.19,.01);rod('metal',[x+cell*.28,.58,.221],[x+cell*.28,.76,.221],.008);}
      if(i<columns-1)box('white',.032,1.09,.38,x+cell/2,.66,0,.004);}
    }else if(kind==='plant'){
      size=[.6,1.27,.6];add('white',new T.CylinderGeometry(.20,.145,.40,segments),0,.20,0);add('soil',new T.CylinderGeometry(.178,.178,.012,segments),0,.407,0);rod('green',[0,.41,0],[0,1.15,0],.015);
      for(let i=0;i<8;i++){const a=i*2.4,y=.61+i*.075,x=Math.sin(a)*.15,z=Math.cos(a)*.15;rod('green',[0,y-.12,0],[x,y,z],.008);const g=new T.SphereGeometry(1,detail?10:6,detail?6:4);g.scale(.095,.17,.018);g.rotateZ(Math.sin(a)*.65);g.rotateY(a);add('green',g,x,y,z);}
    }else if(kind==='printer'){
      size=[.9,1,.62];box('white',.84,.64,.57,0,.36,0,.028);box('dark',.77,.06,.51,0,.05,0,.015);box('pale',.82,.33,.57,0,.875,0,.025);box('white',.82,.045,.57,0,1.06,0,.016);box('dark',.43,.055,.024,0,.86,.292,.01);box('white',.40,.012,.25,0,.837,.19,.005);box('screen',.17,.065,.012,.23,1.01,.296,.009);
    }else if(kind==='coffee-station'){
      const w=dimensions.width||2.3;size=[w,1,.62];box('white',w,.87,.59,0,.435,0,.018);box('dark',w-.1,.06,.52,0,.03,0,.01);box('white',w+.05,.065,.67,0,.9175,0,.02);
      for(let i=0;i<columns;i++){const cell=w/columns,x=-w/2+cell*(i+.5);box('pale',cell-.024,.73,.018,x,.46,.305,.008);rod('metal',[x+cell*.28,.62,.324],[x+cell*.28,.78,.324],.008);}
      const machine=-w*.27,sink=w*.22;
      box('dark',.40,.40,.38,machine,1.15,0,.024);box('white',.30,.23,.018,machine,1.17,.20,.012);box('screen',.14,.08,.012,machine,1.22,.215,.005);box('metal',.32,.018,.28,machine,.963,.10,.005);
      box('metal',.54,.012,.40,sink,.959,0,.02);box('dark',.46,.013,.32,sink,.967,0,.035);bend('metal',[[sink,.96,-.16],[sink,1.20,-.16],[sink,1.20,0],[sink,1.14,0]],.015);
    }else if(kind==='display'){
      size=[2.7,1,.5];for(const s of [-1,1]){box('metal',.36,.04,.48,s*.70,.02,0,.012);rod('white',[s*.70,.04,0],[s*.70,1.66,0],.028);}box('white',2.7,1.45,.07,0,1.65,0,.025);box('screen',2.60,1.35,.012,0,1.65,.042,.015);
    }
    return [...pieces].map(([key,items])=>{const geometry=merge(items);geometry.scale(1/size[0],1/size[1],1/size[2]);geometry.userData.furnitureKey=`${kind}:${detail?'interior':'overview'}:${columns}:${dimensions.width||0}:${dimensions.depth||0}:${key}`;const material=new T.MeshStandardMaterial({color:colors[key],roughness:key==='metal'?.4:.78,metalness:key==='metal'?.45:.02});material.color.convertSRGBToLinear();material.userData.styleLocked=true;material.userData.officeRole='furniture';return{geometry,material};});
  }
  L.FurnitureLibrary={types,build,roundedBox};
})();
