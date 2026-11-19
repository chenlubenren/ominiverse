"""Trusted Blender worker: CC0 crocodile template, reference render and skin transfer."""
import bpy, sys, os, json, math
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; mode,source,out=args[:3];source=os.path.abspath(source);out=os.path.abspath(out)
if len(args)>3:args[3]=os.path.abspath(args[3])
bpy.ops.wm.open_mainfile(filepath=source,load_ui=False,use_scripts=False)
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.vertex_groups)]
base=max(meshes,key=lambda o:len(o.data.vertices))
for o in list(bpy.context.scene.objects):
 if o not in [arm,base]: bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data_clear()
for p in arm.pose.bones: p.location=(0,0,0);p.rotation_euler=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
actions=[a for a in bpy.data.actions if a.name in ['idle-loop','walk-loop','attack','death']]
arm.animation_data_create()
for a in actions:
 track=arm.animation_data.nla_tracks.new();track.name=a.name
 strip=track.strips.new(a.name,1,a);strip.action_frame_start=a.frame_range[0];strip.action_frame_end=a.frame_range[1]
 if len(a.slots):strip.action_slot=a.slots[0]
 track.mute=True
def bounds(o):
 v=[o.matrix_world@Vector(c) for c in o.bound_box];return Vector([min(p[i] for p in v) for i in range(3)]),Vector([max(p[i] for p in v) for i in range(3)])
folder=os.path.dirname(source)
if not base.data.materials: base.data.materials.append(bpy.data.materials.new('Crocodile'))
for mat in base.data.materials:
 mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF') or mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled');output=next((n for n in mat.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None) or mat.node_tree.nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(bsdf.outputs[0],output.inputs['Surface']);tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(os.path.join(folder,'croc_diffuse.png'),check_existing=True);mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.68
bpy.context.view_layer.update()
if mode=='bind':
 incoming=args[3];old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=incoming)
 imported=[o for o in bpy.data.objects if o not in old and o.type=='MESH']
 if not imported: raise RuntimeError('Lux3D result contains no mesh')
 bpy.ops.object.select_all(action='DESELECT')
 for o in imported:o.select_set(True)
 bpy.context.view_layer.objects.active=imported[0];bpy.ops.object.join();target=bpy.context.object
 # Normalize and align the generated surface to the template rest pose.
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 lo,hi=bounds(base);tl,th=bounds(target);axis=max([0,1],key=lambda i:(hi-lo)[i]);other=1-axis
 if (th-tl)[other]>(th-tl)[axis]:target.rotation_euler.z=math.pi/2;bpy.context.view_layer.update()
 # Match all rest-pose extents, not just total length: a taller generated body
 # otherwise receives torso weights where the template expects lower leg joints.
 def end_width(o,axis,lo,hi,sign):
  points=[o.matrix_world@v.co for v in o.data.vertices];cut=lo[axis]+(hi[axis]-lo[axis])*(.22 if sign<0 else .78);ends=[p[1-axis] for p in points if p[axis]<cut] if sign<0 else [p[1-axis] for p in points if p[axis]>cut];return max(ends)-min(ends) if ends else 0
 tl,th=bounds(target);jaw=next((b for b in arm.data.bones if 'jaw' in b.name.lower()),None);source_head=-1 if jaw and (arm.matrix_world@jaw.head_local)[axis]<(lo+hi)[axis]/2 else 1
 target_head=-1 if end_width(target,axis,tl,th,-1)>end_width(target,axis,tl,th,1) else 1
 if source_head!=target_head:target.rotation_euler.z+=math.pi;bpy.context.view_layer.update();tl,th=bounds(target)
 fit=[(hi-lo)[i]/max((th-tl)[i],1e-6) for i in range(3)]
 for i in range(3):target.scale[i]*=fit[i]
 bpy.context.view_layer.update();tl,th=bounds(target)
 target.location+=(lo+hi)/2-(tl+th)/2;bpy.context.view_layer.update();bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for vg in base.vertex_groups:target.vertex_groups.new(name=vg.name)
 transfer=target.modifiers.new('Template skin weights','DATA_TRANSFER');transfer.object=base;transfer.use_vert_data=True;transfer.data_types_verts={'VGROUP_WEIGHTS'};transfer.vert_mapping='POLYINTERP_NEAREST';transfer.layers_vgroup_select_src='ALL';transfer.layers_vgroup_select_dst='NAME'
 bpy.ops.object.modifier_apply(modifier=transfer.name)
 missing=sum(1 for v in target.data.vertices if sum(g.weight for g in v.groups)<.0001)
 if missing:raise RuntimeError('Unweighted vertices: '+str(missing))
 bpy.ops.object.mode_set(mode='WEIGHT_PAINT');bpy.ops.object.vertex_group_normalize_all(lock_active=False);bpy.ops.object.mode_set(mode='OBJECT')
 mod=target.modifiers.new('Reused crocodile skeleton','ARMATURE');mod.object=arm;world=target.matrix_world.copy();target.parent=arm;target.matrix_world=world
 bpy.data.objects.remove(base,do_unlink=True);base=target
else:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
 scene.world.color=(.8,.8,.8);lo,hi=bounds(base);center=(lo+hi)/2;extent=(hi-lo).length
 camera=bpy.data.objects.new('Template reference camera',bpy.data.cameras.new('Reference'));scene.collection.objects.link(camera);camera.location=center+Vector((1,-1,.7)).normalized()*extent*1.2;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=extent*1.12;scene.camera=camera
 for i,p in enumerate([(2,-3,5),(-3,-1,3),(0,4,4)]):
  light=bpy.data.objects.new('Light'+str(i),bpy.data.lights.new('Area','AREA'));scene.collection.objects.link(light);light.location=center+Vector(p)*extent/3;light.data.energy=700;light.data.shape='DISK';light.data.size=extent
 scene.render.filepath=os.path.join(os.path.dirname(out),'reference.png');bpy.ops.render.render(write_still=True)
# Check evaluated deformation independently of glTF export.
metrics={}
for track in arm.animation_data.nla_tracks:track.mute=True
for action in actions:
 arm.animation_data.action=action
 if len(action.slots):arm.animation_data.action_slot=action.slots[0]
 positions=[]
 for frame in [action.frame_range[0],sum(action.frame_range)/2,action.frame_range[1]]:
  bpy.context.scene.frame_set(int(frame));deps=bpy.context.evaluated_depsgraph_get();ev=base.evaluated_get(deps);m=ev.to_mesh();positions.append([tuple(v.co) for v in m.vertices]);ev.to_mesh_clear()
 delta=max((Vector(a)-Vector(b)).length for a,b in zip(positions[0],positions[1]))
 metrics[action.name]={'frames':list(action.frame_range),'sampleDeformation':delta}
arm.animation_data.action=None
for track in arm.animation_data.nla_tracks:track.mute=False
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);base.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_def_bones=True,export_yup=True)
report={'bones':len(arm.data.bones),'vertices':len(base.data.vertices),'unweighted':sum(1 for v in base.data.vertices if not v.groups),'animations':metrics,'source':'CC0 br-n518 crocodile','mode':mode}
with open(out+'.json','w',encoding='utf8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
print('ROBOT_SKINNING_OK '+json.dumps(report))
