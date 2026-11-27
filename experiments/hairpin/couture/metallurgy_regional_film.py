"""METALLURGY regional ritual: actual frozen B bridge followed by TENSION.
Only after the native 161-pose inspection passed. No full accessory or front assembly."""
import bpy,sys,json,math,hashlib,wave,struct
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from metallurgy_solver import height
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');out.mkdir(parents=True,exist_ok=True);baseline=arg('baseline');inspection=arg('inspection');bridge=arg('bridge')
mode=args[args.index('--mode')+1];assert mode in ('metal','clay')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
q=np.load(baseline/'conditioned-correspondence.npz');bq=np.load(bridge/'bridge-correspondence.npz');tq=np.load(inspection/'actual-poses.npz');bm=np.load(bridge/'bridge-motion.npz')
r=json.loads((inspection/'actual-motion-audit.json').read_text());br=json.loads((bridge/'bridge-report.json').read_text());i=json.loads((inspection/'inspection.json').read_text())
assert r['fullSampledPass'] and br['endpointPass'] and br['bridgeMotion']['passes']==81
F=q['faces'];U=q['chart'];assert np.array_equal(F,tq['faces']) and np.array_equal(F,bq['faces']) and np.array_equal(F,bm['faces']) and np.array_equal(U,bq['chart']) and np.array_equal(U,tq['uv'])
assert np.array_equal(bm['poses'][0],bq['frozen']) and np.array_equal(bm['poses'][-1],tq['poses'][0]) and np.array_equal(tq['poses'][-1],q['target'])
file=inspection/'METALLURGY-TENSION.blend';assert sha(file)==i['nativeSha256']
bpy.ops.wm.open_mainfile(filepath=str(file));s=bpy.context.scene;obj=next(o for o in s.objects if o.type=='MESH')
obj.shape_key_clear();d=obj.data;assert np.array_equal(np.array([tuple(p.vertices) for p in d.polygons]),F)
uv0=np.array([tuple(l.uv) for l in d.uv_layers['PersistentMaterialChart'].data]);faceSets=[set(f) for f in F]
def ease(P):
    t=np.linspace(0,1,len(P));x=t**3*(10-15*t+6*t*t)*(len(P)-1);j=np.minimum(np.floor(x).astype(int),len(P)-2);f=x-j
    return ((1-f[:,None,None])*P[j]+f[:,None,None]*P[j+1]).astype(np.float32)
# Eased path is independently re-audited; not substituted on assumption.
B=ease(bm['poses']);T=ease(tq['poses'])
def native_check(P,ref):
    stored=[];counts=[]
    for k,p in enumerate(P):
        d.vertices.foreach_set('co',p.ravel());d.update();bpy.context.view_layer.update();read=np.array([tuple(v.co) for v in d.vertices],dtype=np.float32)
        assert np.array_equal(read,p) and np.array_equal(uv0,np.array([tuple(l.uv) for l in d.uv_layers['PersistentMaterialChart'].data]))
        tree=BVHTree.FromPolygons(read.tolist(),F.tolist(),all_triangles=True);hits=[(a,b) for a,b in tree.overlap(tree) if a<b and not faceSets[a].intersection(faceSets[b])]
        counts.append({'frame':k,'count':len(hits),'pairs':hits[:100]});stored.append(read)
    report,read=height(ref,np.array(stored),False);report['rawBVHOverlapCandidates']=counts;report['peakBVHOverlapCandidates']=max(x['count'] for x in counts);report['fullPass']=bool(report['passes']==len(P) and not report['peakBVHOverlapCandidates'] and np.array_equal(read,P))
    return report
qb={'idealCompact':bq['idealFrozen'],'idealTarget':q['idealCompact'],'compact':bq['frozen'],'target':q['compact'],'faces':F}
report={'bridge':native_check(B,qb),'tension':native_check(T,q),'frozenSourceSha256':br['frozenSha256'],'sourceInspectionSha256':sha(file),'fictionalScaleMmPerAuthoringUnit':10,'scope':'Selected frozen B prong strip only, not complete wearable or front assembly'}
(out/'regional-ritual-gate.json').write_text(json.dumps(report,indent=2))
assert report['bridge']['fullPass'] and report['tension']['fullPass'],'Eased regional native check failed; no film'
# 21 bridge poses, 81 tension poses; share one exact endpoint. Fixed camera
# retains visible scale growth, identical between materials.
P=np.concatenate([B[::4],T[2::2]]);assert len(P)==101
np.savez_compressed(out/'rendered-poses.npz',poses=P,faces=F,uv=U)
if mode=='clay':
    m=bpy.data.materials.get('Inspection clay')
    if m is None:
        m=bpy.data.materials.new('Inspection clay');m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.4,.4,.4,1);bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.5
    d.materials[0]=m
cam=s.camera;center=Vector(tuple((P.max((0,1))+P.min((0,1)))/2));cam.location=center+Vector((55,-25,95));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(12,float(np.max(P.max((0,1))-P.min((0,1))))*1.40)
s.render.resolution_x=1000;s.render.resolution_y=563;s.cycles.samples=32;s.render.fps=16;s.render.image_settings.file_format='PNG'
# Editable absolute linear shape keys, independently reopened and tested.
d.vertices.foreach_set('co',P[0].ravel());d.update();basis=obj.shape_key_add(name='Basis');keys=obj.data.shape_keys;keys.use_relative=False;basis.interpolation='KEY_LINEAR'
for j,p in enumerate(P[1:],1):
    key=obj.shape_key_add(name=f'REGIONAL-{j:03d}');key.data.foreach_set('co',p.ravel());key.interpolation='KEY_LINEAR'
for j,key in enumerate(keys.key_blocks):
    keys.eval_time=key.frame;keys.keyframe_insert(data_path='eval_time',frame=j+1)
for fcurve in keys.animation_data.action.fcurves:
    for kp in fcurve.keyframe_points:kp.interpolation='LINEAR'
s.frame_start=1;s.frame_end=len(P);s.frame_set(1);native=out/f'METALLURGY-REGIONAL-{mode}.blend';bpy.ops.wm.save_as_mainfile(filepath=str(native))
bpy.ops.wm.open_mainfile(filepath=str(native));s=bpy.context.scene;obj=next(o for o in s.objects if o.type=='MESH');d=obj.data
readback=[]
for j,p in enumerate(P):
    s.frame_set(j+1);dg=bpy.context.evaluated_depsgraph_get();eo=obj.evaluated_get(dg);me=eo.to_mesh()
    xyz=np.array([tuple(v.co) for v in me.vertices],dtype=np.float32);err=float(np.max(abs(xyz-p)));readback.append(err);eo.to_mesh_clear()
report['editableSourceMaxCoordinateError']=max(readback);report['editableSourceExact']=bool(max(readback)==0);report['editableSourceSha256']=sha(native)
(out/'regional-ritual-gate.json').write_text(json.dumps(report,indent=2))
# If absolute key evaluation differs, preserve diagnostic and render directly
# from the actual qualified coordinate arrays instead of claiming parity.
obj.shape_key_clear()
for j,p in enumerate(P):
    d.vertices.foreach_set('co',p.ravel());d.update();bpy.context.view_layer.update();assert np.array_equal(np.array([tuple(v.co) for v in d.vertices],dtype=np.float32),p)
    s.render.filepath=str(out/f'frame-{j:04d}.png');bpy.ops.render.render(write_still=True);assert Path(s.render.filepath).stat().st_size>1000
# Original synthesized contact cues timed to the actual bridge/tension/lock
# sequence. No samples, no real mechanism recording, no whole-crown claim.
rate=44100;duration=len(P)/16
with wave.open(str(out/'regional.wav'),'wb') as w:
    w.setparams((1,2,rate,0,'NONE','not compressed'));buf=bytearray()
    for i in range(round(duration*rate)):
        t=i/rate;x=0.
        for cue,f,amp in [(.15,1650,.09),(1.25,1190,.12),(3.9,820,.065),(6.05,1810,.14)]:
            z=t-cue
            if 0<=z<.24:x+=amp*min(1,z/.004)*math.exp(-z/.045)*(math.sin(2*math.pi*f*z)+.32*math.sin(2*math.pi*2.71*f*z))
        u=max(0,min(1,(t-1.25)/4.8));x+=.045*math.sin(math.pi*u)**2*math.sin(2*math.pi*(85*(t-1.25)+35*(t-1.25)**2))
        x*=min(1,(duration-t)/.05);buf.extend(struct.pack('<h',round(max(-1,min(1,x))*32767)))
    w.writeframes(buf)
report['renderedFrames']=len(P);report['fps']=16;report['bridgeLastFrame']=20;report['soundCueSeconds']=[.15,1.25,3.9,6.05]
(out/'regional-ritual-gate.json').write_text(json.dumps(report,indent=2))
