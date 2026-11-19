"""Normalize validated Lux3D humanoid rig/combined animations for the game."""
import bpy,sys,os,json,struct,re
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:];source,out=map(os.path.abspath,a[:2]);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=source)
arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.vertex_groups)]
if not arms or not meshes:raise RuntimeError('Lux3D did not return a skinned skeleton')
if len(arms)!=1:raise RuntimeError('Expected one character skeleton')
arm=arms[0];base=max(meshes,key=lambda o:len(o.data.vertices));actions=list(bpy.data.actions);mapping={'idle-loop':['idle'],'walk-loop':['walk'],'attack':['punch','attack','melee'],'death':['death']};chosen={}
with open(source,'rb') as f:raw=f.read()
doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);source_names=[a.get('name','') for a in doc.get('animations',[])]
# The combined endpoint currently labels clips animation_1..4 in request order.
ordinal_names=source_names if source_names==['animation_1','animation_2','animation_3','animation_4'] else []
for index,(name,words) in enumerate(mapping.items()):
 match=next((ac for ac in actions if any(w in ac.name.lower() for w in words)),None)
 if not match and ordinal_names:match=next((ac for ac in actions if ac.name==ordinal_names[index] or ac.name.startswith(ordinal_names[index]+'_')),None)
 if not match:raise RuntimeError('Missing required motion: '+name)
 chosen[name]=match
for o in list(bpy.context.scene.objects):
 if o.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data_clear();arm.animation_data_create();metrics={}
for name,ac in chosen.items():
 ac.name=name;arm.animation_data.action=ac
 if len(ac.slots):arm.animation_data.action_slot=ac.slots[0]
 poses=[]
 for frame in [ac.frame_range[0],sum(ac.frame_range)/2]:
  bpy.context.scene.frame_set(int(frame));ev=base.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();poses.append([tuple(v.co) for v in m.vertices]);ev.to_mesh_clear()
 metrics[name]={'frames':list(ac.frame_range),'sampleDeformation':max((Vector(x)-Vector(y)).length for x,y in zip(*poses))}
arm.animation_data.action=None
for name,ac in chosen.items():
 track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,ac)
 if len(ac.slots):strip.action_slot=ac.slots[0]
bpy.context.scene.frame_set(1);bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_def_bones=True)
report={'bones':len(arm.data.bones),'vertices':sum(len(m.data.vertices) for m in meshes),'unweighted':sum(1 for m in meshes for v in m.data.vertices if sum(g.weight for g in v.groups)<.0001),'animations':metrics,'source':'Lux3D automatic humanoid rig and preset motion retarget','mode':'cloud-rig','motionOrder':['Idle_Loop','Walk_Loop','Punch_Cross','Death01'],'sourceClipNames':source_names}
with open(out+'.json','w',encoding='utf8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
print('ROBOT_SKINNING_OK '+json.dumps(report))
