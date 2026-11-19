"""Assemble Lux3D segmented URDF and bake local motion using its real joints."""
import bpy,sys,os,json,math,zipfile,hashlib,xml.etree.ElementTree as ET
from mathutils import Vector,Matrix,Quaternion,Euler
source,out,motion=sys.argv[sys.argv.index('--')+1:][:3];source=os.path.abspath(source);out=os.path.abspath(out);folder=os.path.join(os.path.dirname(out),'articulation-parts');os.makedirs(folder,exist_ok=True)
with zipfile.ZipFile(source) as archive:
 if len(archive.infolist())>500 or sum(i.file_size for i in archive.infolist())>500_000_000:raise RuntimeError('Articulation archive too large')
 for item in archive.infolist():
  target=os.path.abspath(os.path.join(folder,item.filename))
  if os.path.commonpath([folder,target])!=folder:raise RuntimeError('Unsafe archive path')
  if item.is_dir():os.makedirs(target,exist_ok=True);continue
  os.makedirs(os.path.dirname(target),exist_ok=True)
  with archive.open(item) as src,open(target,'wb') as dest:dest.write(src.read())
urdfs=[os.path.join(base,n) for base,dirs,names in os.walk(folder) for n in names if n.endswith('.urdf')]
if len(urdfs)!=1:raise RuntimeError('Expected one URDF character')
tree=ET.parse(urdfs[0]).getroot();base_dir=os.path.dirname(urdfs[0]);bpy.ops.wm.read_factory_settings(use_empty=True)
convert=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));inverse=convert.inverted()
def numbers(value,default):return [float(n) for n in (value or default).split()]
def transform(origin):
 if origin is None:return Matrix.Identity(4)
 return convert@(Matrix.Translation(Vector(numbers(origin.get('xyz'),'0 0 0')))@Euler(numbers(origin.get('rpy'),'0 0 0'),'XYZ').to_matrix().to_4x4())@inverse
def empty(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.rotation_mode='QUATERNION';return o
root=empty('robot');links={link.get('name'):empty(link.get('name'),root) for link in tree.findall('link')};records=[]
for j in tree.findall('joint'):
 parent=links[j.find('parent').get('link')];child=links[j.find('child').get('link')];child.parent=parent;child.matrix_basis=transform(j.find('origin'));limit=j.find('limit');axis=j.find('axis');q=child.rotation_quaternion.copy()
 if j.get('type') not in ['fixed','floating']:
  a=convert.to_3x3()@Vector(numbers(axis.get('xyz') if axis is not None else None,'1 0 0'));a.normalize()
  # Wings flap around the fore/aft hinge; inferred vertical axes only twist them.
  if motion=='flight' and 'wing' in j.get('name','').lower():a=Vector((0,-1 if child.location.x>=0 else 1,0))
  records.append({'node':child,'name':j.get('name'),'axis':a,'base':q,'position':child.location.copy(),'lower':float(limit.get('lower','-.5')) if limit is not None else -.5,'upper':float(limit.get('upper','.5')) if limit is not None else .5,'type':j.get('type')})
if not records:raise RuntimeError('No movable joints in provider URDF')
for link in tree.findall('link'):
 for vi,visual in enumerate(link.findall('visual')):
  mesh=visual.find('geometry/mesh')
  if mesh is None:continue
  filename=mesh.get('filename','').replace('package://','');p=os.path.abspath(os.path.join(base_dir,filename))
  if os.path.commonpath([folder,p])!=folder or not p.lower().endswith('.glb'):raise RuntimeError('Unsupported URDF visual')
  holder=empty(link.get('name')+'_visual_'+str(vi),links[link.get('name')]);holder.matrix_basis=transform(visual.find('origin'));sx,sy,sz=numbers(mesh.get('scale'),'1 1 1');holder.scale=(sx,sz,sy)
  before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=p);objects=set(bpy.context.scene.objects)-before
  for o in objects:
   if o.parent not in objects:o.parent=holder
# The package repeats the same texture per part. Preserve it once in the GLB.
images={}
for material in bpy.data.materials:
 if not material.use_nodes:continue
 for node in material.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image and node.image.packed_file:
   digest=hashlib.sha256(node.image.packed_file.data).hexdigest()
   if digest in images:node.image=images[digest]
   else:images[digest]=node.image
clips={'idle-loop':3.,'walk-loop':2.4,'attack':1.2,'death':2.2};actions={name:[] for name in clips};meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];fps=24;bpy.context.scene.render.fps=fps
root_base=root.rotation_quaternion.copy()
def joint_angle(record,clip,t,index):
 name=record['name'].lower();phase=index*1.3;wing='wing' in name;head=any(w in name for w in ['head','neck']);tail=any(w in name for w in ['tail','tentacle','segment']);leg=any(w in name for w in ['leg','foot','wheel','arm']);span=min(.55,max(.05,record['upper']-record['lower'])/2)
 if record['type']=='continuous' and clip=='walk-loop':return t*math.tau
 if clip=='idle-loop':angle=span*(.25 if wing else .12)*math.sin(t*math.tau+phase)
 elif clip=='walk-loop':angle=span*(.95 if wing or leg or tail else .22)*math.sin(t*math.tau+(0 if wing else phase))
 elif clip=='attack':angle=span*(1 if head or wing else .5)*math.sin(math.pi*t)*(1 if index%2 else -1)
 else:angle=span*.7*(1-math.cos(math.pi*t))/2*(1 if index%2 else -1)
 return max(record['lower'],min(record['upper'],angle))
for clip,duration in clips.items():
 for rec in [{'node':root,'base':root_base}]+records:
  o=rec['node'];o.animation_data_create();action=bpy.data.actions.new(clip+'_'+o.name);o.animation_data.action=action;actions[clip].append((o,action))
 for frame in range(int(duration*fps)+1):
  t=frame/(duration*fps);root.rotation_quaternion=root_base@Quaternion(Vector((1,0,0)),min(1,t)*1.45 if clip=='death' else 0);root.keyframe_insert('rotation_quaternion',frame=frame)
  for i,rec in enumerate(records):
   o=rec['node'];angle=joint_angle(rec,clip,t,i)
   if rec['type']=='prismatic':o.location=rec['position']+rec['axis']*angle;o.keyframe_insert('location',frame=frame)
   else:o.rotation_quaternion=rec['base']@Quaternion(rec['axis'],angle);o.keyframe_insert('rotation_quaternion',frame=frame)
 for o,ac in actions[clip]:
  o.animation_data.action=None;o.rotation_quaternion=root_base if o==root else next(r['base'] for r in records if r['node']==o)
  if o!=root:o.location=next(r['position'] for r in records if r['node']==o)
metrics={}
def sample():
 bpy.context.view_layer.update();return [o.matrix_world@Vector(corner) for o in meshes for corner in o.bound_box]
for clip,items in actions.items():
 for o,ac in items:
  o.animation_data.action=ac
  if len(ac.slots):o.animation_data.action_slot=ac.slots[0]
 bpy.context.scene.frame_set(0);first=sample();bpy.context.scene.frame_set(int(clips[clip]*fps*.25));second=sample();metrics[clip]={'sampleDeformation':max((a-b).length for a,b in zip(first,second)),'animatedNodes':len(records)+1}
 for o,ac in items:o.animation_data.action=None
for clip,items in actions.items():
 for o,ac in items:
  track=o.animation_data.nla_tracks.new();track.name=clip;strip=track.strips.new(clip,1,ac)
  if len(ac.slots):strip.action_slot=ac.slots[0]
bpy.context.scene.frame_set(0);bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
report={'mode':'cloud-articulation','source':'Lux3D segmented URDF; locally baked motion from provider joint axes and limits','unweighted':0,'bones':0,'articulatedNodes':len(records),'vertices':sum(len(o.data.vertices) for o in meshes),'animations':metrics,'jointNames':[r['name'] for r in records],'motion':motion,'parts':len(meshes),'textureImages':len(images)}
with open(out+'.json','w',encoding='utf8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
print('ROBOT_ARTICULATION_OK '+json.dumps(report))
