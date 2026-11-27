"""AFTERBURN 004.2: material-only directional livery refinement.
Open the successful native AFTERBURN master, never reconstruct geometry.
"""
import bpy,sys,os,json,math,hashlib
import numpy as np
from mathutils import Vector
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from diagnose_geometry import snapshot,compare,allpass,sha
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
source=arg('source');out=arg('out');os.makedirs(out,exist_ok=True)
assert sha(source)=='464e25dea9fef7b609b0117a744d94f659aaa862bc8eedd7cc6ff4d40c481dfe'
bpy.ops.wm.open_mainfile(filepath=source);before=snapshot()
def srgb(h):return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
# Painted diagonal slashes; packed RGBA texture on orange enamel, no
# separate decal geometry. Transparent area preserves the original shader.
W,H=1024,256;yy,xx=np.mgrid[0:H,0:W];u=(xx+.5)/W;v=(yy+.5)/H
image=np.zeros((H,W,4),np.float32)
shapes=[(.18,.225,'181C23'),(.24,.275,'103C59'),(.295,.313,'F52BAA')]
for a,b,h in shapes:
    mask=(u-.11*(v-.5)>a)&(u-.11*(v-.5)<b)&(v>.13)&(v<.87)
    image[mask,:3]=srgb(h);image[mask,3]=1
im=bpy.data.images.new('CHROMATIC-velocity-stripes',width=W,height=H,alpha=True)
im.colorspace_settings.name='sRGB';im.pixels.foreach_set(image.ravel());im.update();im.filepath_raw=os.path.join(out,'CHROMATIC-velocity-stripes.png');im.file_format='PNG';im.save();im.pack()
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 256">']
for a,b,h in shapes:
    xy=[((a+.11*(v-.5))*1024,(1-v)*256) for v in (.13,.87)]+[((b+.11*(v-.5))*1024,(1-v)*256) for v in (.87,.13)]
    svg.append('<polygon fill="#'+h+'" points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in xy)+'"/>')
open(os.path.join(out,'CHROMATIC-velocity-stripes.svg'),'w').write(''.join(svg)+'</svg>')
def mat(name):return bpy.data.materials['AFTERBURN / '+name]
stripe=mat('orange').copy();stripe.name='AFTERBURN / orange / directional stripe'
n=stripe.node_tree.nodes;l=stripe.node_tree.links;p=n.get('Principled BSDF')
uv=n.new('ShaderNodeUVMap');uv.uv_map='ChromaticArtworkUV'
tex=n.new('ShaderNodeTexImage');tex.image=im;tex.extension='CLIP';l.new(uv.outputs['UV'],tex.inputs['Vector'])
mix=n.new('ShaderNodeMixRGB');mix.inputs[1].default_value=p.inputs['Base Color'].default_value;l.new(tex.outputs['Alpha'],mix.inputs[0]);l.new(tex.outputs['Color'],mix.inputs[2]);l.new(mix.outputs['Color'],p.inputs['Base Color'])
# Lower glare only on the painted wordmark, preserving petrol substrate.
logo=mat('petrol / MAPO-DOFU-wordmark').copy();logo.name='AFTERBURN / petrol / CHROMATIC wordmark'
n=logo.node_tree.nodes;l=logo.node_tree.links;p=n.get('Principled BSDF')
for node in n:
    if node.bl_idname=='ShaderNodeUVMap':node.uv_map='ChromaticArtworkUV'
art=next(node for node in n if node.bl_idname=='ShaderNodeTexImage')
rough=n.new('ShaderNodeMixRGB');rough.inputs[1].default_value=(.24,.24,.24,1);rough.inputs[2].default_value=(.43,.43,.43,1);l.new(art.outputs['Alpha'],rough.inputs[0]);l.new(rough.outputs[0],p.inputs['Roughness'])
metal=n.new('ShaderNodeMixRGB');metal.inputs[1].default_value=(.84,.84,.84,1);metal.inputs[2].default_value=(.18,.18,.18,1);l.new(art.outputs['Alpha'],metal.inputs[0]);l.new(metal.outputs[0],p.inputs['Metallic'])
serial=mat('petrol / VECTOR-005-serial')
# Dedicated UVs use actual arc lengths along the center rail and across
# each transverse section. Do not overwrite the original alloy tangent UVs.
zones={};graphic={}
for name in ('TENSION_continuous_frame','CONTINUITY_rear_frame'):
    o=bpy.data.objects[name];d=o.data;g=o['assembly']
    assert len(d.vertices)>=3636
    uv=d.uv_layers.get('ChromaticArtworkUV') or d.uv_layers.new(name='ChromaticArtworkUV')
    for m in (stripe,logo):
        if m.name not in d.materials:d.materials.append(m)
    slot={m.name:i for i,m in enumerate(d.materials)}
    coords=[Vector((v.co.x,v.co.z,-v.co.y)) for v in d.vertices]
    arc={};cross={}
    for block in (0,2):
        points=[coords[block*909+i*9+4] for i in range(101)];dist=[0.]
        for a,b in zip(points,points[1:]):dist.append(dist[-1]+(a-b).length)
        arc[block]=dist
        for i in range(101):
            pts=coords[block*909+i*9:block*909+i*9+9];c=[0.]
            for a,b in zip(pts,pts[1:]):c.append(c[-1]+(a-b).length)
            cross[block,i]=c
    def longitudinal(block,z):
        return min(range(101),key=lambda i:abs(coords[block*909+i*9+4].z-z))
    ranges={}
    for block in (0,2):
        za,zb=(29,10.5) if g=='front' else (-9,-27)
        a,b=longitudinal(block,za),longitudinal(block,zb)
        ranges[block]=(arc[block][a],arc[block][b])
    counts={}
    for f in d.polygons:
        ids=list(f.vertices);blocks={i//909 for i in ids if i<3636}
        x,y,z=[sum(coords[i][k] for i in ids)/len(ids) for k in range(3)]
        old=d.materials[f.material_index]
        m=old
        if len(blocks)==1 and next(iter(blocks)) in (0,2) and max(ids)<3636:
            block=next(iter(blocks));lane=sum(i%9 for i in ids)/len(ids)
            # Orange leads along both sections, with a narrow petrol
            # inner lane and a larger near-side wordmark panel.
            m=mat('orange') if lane>=2.5 else mat('petrol')
            if g=='front':
                if block==2 and 10.3<z<29.2 and 1.5<=lane<=6.5:m=logo
                if block==0 and lane>=3.5 and 15<z<30:m=stripe
                if block==2 and lane>=7.5 and z>30:m=mat('orchid')
                if z<7 or z>35:m=mat('petrol')
            else:
                if block==0 and -27<z<-10 and lane<=3.5:m=serial
                if block==2 and lane>=3.5 and -29<z<-12:m=stripe
                if block==0 and lane>=7.5 and z<-30:m=mat('orchid')
                if z>-6:m=mat('petrol')
            for li in f.loop_indices:
                i=d.loops[li].vertex_index;row=(i%909)//9;col=i%9
                a,b=ranges[block];u=(arc[block][row]-a)/max(b-a,1e-8)
                c=cross[block,row];middle=(c[2]+c[6])/2
                # Width fixed in authoring units, not stretched with the
                # changing cross-section. Existing full wordmark mask has
                # 60% glyph height; 1.9-unit projection yields 1.14 height.
                v=.5-(c[col]-middle)/1.9
                if m==stripe:v=.5-(c[col]-c[5])/max(c[-1]-c[2],.1)
                uv.data[li].uv=(u,v)
        elif g=='rear' and max(ids)>=3636 and y>5:m=mat('orange')
        f.material_index=slot[m.name];counts[m.name]=counts.get(m.name,0)+1
    zones[name]=counts;graphic[name]={'projection':'arc length longitudinal, fixed physical transverse width; separate UV channel','wordmarkGlyphHeightAuthoringUnits':1.14}
after=snapshot();audit=compare(before,after)
json.dump({'sourceSha256':sha(source),'components':audit,'pass':allpass(audit),'zones':zones,'graphic':graphic},open(os.path.join(out,'chromatic-build-diagnostics.json'),'w'),indent=2)
# Never allow control mesh changes; evaluated mismatches are retained and
# independently gated on reopening rather than silently certified.
assert all(v['objectTransformsExact'] and all(v['controlFieldsExact'].values()) for v in audit.values())
bpy.context.scene['stage']='AFTERBURN 004.2 / CHROMATIC PRECISION / unapproved'
dest=os.path.join(out,'VECTOR-005-AFTERBURN-0042-master.blend');bpy.ops.wm.save_as_mainfile(filepath=dest)
report={'sourceSha256':sha(source),'masterSha256':sha(dest),'master':os.path.basename(dest),'preSaveExactEquivalence':allpass(audit),'zones':zones,'artwork':graphic}
json.dump(report,open(os.path.join(out,'chromatic-manifest.json'),'w'),indent=2);print('CHROMATIC_BUILD',json.dumps(report),flush=True)
