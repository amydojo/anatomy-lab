"""GENESIS AWAKEN: isolated material response on the frozen B master.
No geometry change, no magnetic actuation, no expansion or visibility swap."""
import bpy,sys,math,json,hashlib,wave,struct
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return Path(args[args.index('--'+k)+1]).resolve()
out=arg('out');src=arg('source');out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source_sha=sha(src)
bpy.ops.wm.open_mainfile(filepath=str(src));s=bpy.context.scene
body=next(o for o in s.objects if o.type=='MESH' and o.get('couture_role')=='body')
def coords():return [tuple(v.co) for v in body.data.vertices]
original=coords();mat=next(m for m in body.data.materials if 'Orchid' in m.name)
inds={i for i,m in enumerate(body.data.materials) if m==mat}
vs={i for p in body.data.polygons if p.material_index in inds for i in p.vertices}
ys=[(body.matrix_world@body.data.vertices[i].co).y for i in vs];low,high=min(ys),max(ys)
n=mat.node_tree.nodes;l=mat.node_tree.links;bs=n.get('Principled BSDF')
geo=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],sep.inputs[0])
center=n.new('ShaderNodeValue');center.name='AWAKEN travel';amp=n.new('ShaderNodeValue');amp.name='AWAKEN envelope'
def mathnode(op,a,b):
    x=n.new('ShaderNodeMath');x.operation=op
    for i,v in enumerate((a,b)):
        if isinstance(v,(float,int)):x.inputs[i].default_value=v
        else:l.new(v,x.inputs[i])
    return x.outputs[0]
delta=mathnode('SUBTRACT',sep.outputs['Y'],center.outputs[0])
square=mathnode('MULTIPLY',delta,delta)
profile=mathnode('EXPONENT',mathnode('MULTIPLY',square,-2.0/max((high-low)*.16,0.3)**2),0.)
strength=mathnode('MULTIPLY',profile,amp.outputs[0]);l.new(strength,bs.inputs['Emission Strength'])
bs.inputs['Emission Color'].default_value=(.72,.015,.22,1)
# Restrained moving reflection, emission strength never above .18.
rough=mathnode('SUBTRACT',.25,mathnode('MULTIPLY',strength,.3));l.new(rough,bs.inputs['Roughness'])
N=65;fps=16
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def state(i):
    t=i/fps;f=smooth((t-.75)/1.75);g=smooth((t-.45)/.4)*(1-smooth((t-2.6)/.7));return low-(high-low)*.15+(high-low)*1.3*f,.18*g
for i in range(N):
    c,a=state(i);center.outputs[0].default_value=c;amp.outputs[0].default_value=a
    center.outputs[0].keyframe_insert(data_path='default_value',frame=i+1);amp.outputs[0].keyframe_insert(data_path='default_value',frame=i+1)
s.frame_start=1;s.frame_end=N;s.render.fps=fps
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=False
for v in s.view_layers:v.cycles.use_denoising=False
s.render.threads_mode='FIXED';s.render.threads=4;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
cam=s.camera;cam.location=(-90,-40,100);cam.rotation_euler=(Vector((-43,3,3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=52
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(out/'GENESIS-AWAKEN.blend'))
for i in range(N):
    s.frame_set(i+1);s.render.filepath=str(out/f'frame-{i:04d}.png');bpy.ops.render.render(write_still=True)
    assert Path(s.render.filepath).stat().st_size>1000
assert original==coords() and sha(src)==source_sha
# Original synchronized tonal contact cues: not a recording of an actual mechanism.
rate=44100;duration=N/fps
with wave.open(str(out/'awaken.wav'),'wb') as w:
    w.setparams((1,2,rate,0,'NONE','not compressed'));buf=bytearray()
    for i in range(round(duration*rate)):
        t=i/rate;x=0.
        for cue,f in [(.72,1750),(2.55,1250)]:
            z=t-cue
            if 0<=z<.24:x+=.12*min(1,z/.006)*math.exp(-z/.045)*(math.sin(2*math.pi*f*z)+.3*math.sin(2*math.pi*2.71*f*z))
        u=max(0,min(1,(t-.75)/1.75))
        x+=.035*math.sin(math.pi*u)**2*math.sin(2*math.pi*(220*t+35*t*t))
        buf.extend(struct.pack('<h',round(max(-1,min(1,x))*32767)))
    w.writeframes(buf)
(out/'awaken.json').write_text(json.dumps({'sourceSha256':source_sha,'frames':N,'fps':fps,'geometryUnchanged':True,'orchidFaceCount':sum(p.material_index in inds for p in body.data.polygons),'maxEmissionStrength':.18,'cueSeconds':[.72,2.55],'limitations':['Material-only activation on frozen B; no structural motion or evaluated parity.','Fictional response, no physical actuation claim.']},indent=2))
