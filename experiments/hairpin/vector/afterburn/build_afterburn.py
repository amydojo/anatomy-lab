"""AFTERBURN 004.1 — exact CONTINUITY geometry, editable material studies.
Blender 4.x. No geometry edits, runtime export, or displacement.
"""
import bpy,sys,os,json,hashlib,struct,math
import numpy as np
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
source=arg('source');out=arg('out');os.makedirs(out,exist_ok=True)
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
assert sha(source)=='1f55c85022e8f6a70fbf7f7c06617c8c01005b1a5ce178796a8ab112dd7dfe55'
PALETTE={'petrol':'103C59','orange':'FF6900','orchid':'F52BAA','silver':'D5D0C8','obsidian':'181C23','amber':'FFAD49'}
def linear(h):
    s=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in s)
# All evaluated vertex positions, topology, transforms; excludes intended
# material indices and UV changes. Compare every mesh, not only front 17.
def fingerprint():
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();res={}
    for o in sorted(bpy.context.scene.objects,key=lambda o:o.name):
        if o.type!='MESH':continue
        def digest(mesh,mat):
            h=hashlib.sha256()
            for v in mesh.vertices:h.update(struct.pack('<3f',*(mat@v.co)))
            for p in mesh.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
            return h.hexdigest()
        ev=o.evaluated_get(deps);m=ev.to_mesh()
        res[o.name]={'assembly':o.get('assembly'),'control':digest(o.data,o.matrix_world),'evaluated':digest(m,ev.matrix_world)}
        ev.to_mesh_clear()
    return res
# Custom filled motorsport glyph polygons. Counterforms use a separate
# subtraction mask; artwork remains reusable SVG as well as packed PNG.
G={'M':[(0,1),(0,0),(.22,0),(.5,.36),(.78,0),(1,0),(1,1),(.76,1),(.76,.40),(.5,.76),(.24,.40),(.24,1)],
'A':[(0,1),(.27,0),(.73,0),(1,1),(.74,1),(.63,.66),(.37,.66),(.26,1)],
'P':[(0,1),(0,0),(.8,0),(1,.20),(1,.56),(.8,.72),(.25,.72),(.25,1)],
'O':[(.16,0),(.84,0),(1,.16),(1,.84),(.84,1),(.16,1),(0,.84),(0,.16)],
'D':[(0,0),(.73,0),(1,.26),(1,.74),(.73,1),(0,1)],
'F':[(0,0),(1,0),(1,.23),(.26,.23),(.26,.44),(.82,.44),(.82,.67),(.26,.67),(.26,1),(0,1)],
'U':[(0,0),(.25,0),(.25,.76),(.75,.76),(.75,0),(1,0),(1,.84),(.84,1),(.16,1),(0,.84)]}
HOLES={'A':[(.43,.37),(.57,.37),(.62,.54),(.38,.54)],'P':[(.25,.23),(.73,.23),(.73,.48),(.25,.48)],'O':[(.25,.23),(.75,.23),(.75,.77),(.25,.77)],'D':[(.25,.24),(.62,.24),(.75,.36),(.75,.64),(.62,.76),(.25,.76)]}
# Additional small serial labels use compact block glyphs, hand-authored.
BITS={'V':['10001','10001','10001','10001','01010','01010','00100'],'E':['11111','10000','10000','11110','10000','10000','11111'],'C':['01111','10000','10000','10000','10000','10000','01111'],'T':['11111','00100','00100','00100','00100','00100','00100'],'O':['01110','10001','10001','10001','10001','10001','01110'],'R':['11110','10001','10001','11110','10100','10010','10001'],'0':['01110','10001','10011','10101','11001','10001','01110'],'5':['11111','10000','10000','11110','00001','00001','11110'],'H':['10001','10001','10001','11111','10001','10001','10001'],'A':['01110','10001','10001','11111','10001','10001','10001'],'I':['111','010','010','010','010','010','111'],'P':['11110','10001','10001','11110','10000','10000','10000'],'N':['10001','11001','11001','10101','10011','10011','10001'],'F':['11111','10000','10000','11110','10000','10000','10000'],'B':['11110','10001','10001','11110','10001','10001','11110'],'U':['10001','10001','10001','10001','10001','10001','01110'],'M':['10001','11011','10101','10101','10001','10001','10001'],'D':['11110','10001','10001','10001','10001','10001','11110'],'-':['000','000','000','111','000','000','000']}
def raster(name,w,h,shapes):
    # Supersampled pixel centers, vector even-odd fill. UV origin bottom-left.
    yy,xx=np.mgrid[0:h,0:w];X=(xx+.5)/w;Y=(yy+.5)/h
    a=np.zeros((h,w,4),np.float32)
    svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">']
    def inside(poly):
        m=np.zeros((h,w),bool)
        for (x,y),(u,v) in zip(poly,poly[1:]+poly[:1]):
            m^=((y>Y)!=(v>Y)) & (X<(u-x)*(Y-y)/(v-y+1e-20)+x)
        return m
    for poly,holes,col in shapes:
        m=inside(poly)
        for hole in holes:m&=~inside(hole)
        a[m,:3]=linear(col);a[m,3]=1
        def path(p):return 'M'+' L'.join(f'{x*1000:.3f},{(1-y)*1000:.3f}' for x,y in p)+'Z'
        svg.append('<path fill="#'+col+'" fill-rule="evenodd" d="'+path(poly)+''.join(' '+path(p) for p in holes)+'"/>')
    svg.append('</svg>')
    open(os.path.join(out,name+'.svg'),'w').write(''.join(svg))
    # Blender float buffer is linear; save PNG in sRGB using standard transform.
    # Store sRGB byte values directly for packed image interpreted as sRGB.
    srgb=np.where(a[:,:,:3]<=.0031308,a[:,:,:3]*12.92,1.055*np.power(a[:,:,:3],1/2.4)-.055)
    a[:,:,:3]=srgb
    im=bpy.data.images.new(name,width=w,height=h,alpha=True,float_buffer=False);im.colorspace_settings.name='sRGB';im.pixels.foreach_set(a.ravel());im.update()
    im.filepath_raw=os.path.join(out,name+'.png');im.file_format='PNG';im.save();im.pack()
    return im
def wordmark():
    shapes=[]
    for i,ch in enumerate('MAPO DOFU'):
        if ch==' ':continue
        def tr(p):return [( .045+i*.099+x*.091+(1-y)*.017, .20+(1-y)*.60) for x,y in p]
        shapes.append((tr(G[ch]),[tr(HOLES[ch])] if ch in HOLES else [],'D5D0C8'))
    return shapes
def labels():
    shapes=[]
    for line,txt in enumerate(['VECTOR 005','HAIRPIN','AFTERBURN','MD-005']):
        for i,ch in enumerate(txt):
            if ch==' ':continue
            for j,row in enumerate(BITS[ch]):
                for k,b in enumerate(row):
                    if b!='1':continue
                    x=.05+i*.09+k*.013;y=.85-line*.21-j*.021
                    shapes.append(([(x,y),(x+.012,y),(x+.012,y-.020),(x,y-.020)],[],'D5D0C8'))
    return shapes
def insignia():
    # elongated angular four-point velocity vector; no petals or flower.
    return [([(.10,.50),(.44,.55),(.60,.87),(.56,.56),(.91,.50),(.57,.45),(.38,.13),(.43,.45)],[],'F52BAA')]
PARAMS={
'petrol':('petrol',.84,.24,.24,0),
'orange':('orange',.42,.22,.28,0),
'silver':('silver',.95,.29,.08,0),
'carbon':('obsidian',.18,.38,.16,0),
'grip':('obsidian',.04,.75,0,0),
'orchid':('orchid',.55,.25,.22,0),
'amber':('amber',.22,.27,.06,.55)}
def socket(node,*names):
    for name in names:
        found=node.inputs.get(name)
        if found is not None:return found
    raise RuntimeError('Unsupported shader input '+str(names)+' on '+node.bl_idname+'; available='+str([i.name for i in node.inputs]))
def material(key,art=None):
    pal,metal,rough,coat,emit=PARAMS[key];m=bpy.data.materials.new('AFTERBURN / '+key+(' / '+art.name if art else ''));m.use_nodes=True
    m.diffuse_color=(*linear(PALETTE[pal]),1);m['family']=key;m['base_srgb_hex']='#'+PALETTE[pal]
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;socket(p,'Coat Weight','Clearcoat').default_value=coat;socket(p,'Coat Roughness','Clearcoat Roughness').default_value=.22
    if key=='silver':
        socket(p,'Anisotropic IOR Level','Anisotropic').default_value=.28
        uv=n.new('ShaderNodeUVMap');uv.uv_map='AfterburnUV'
        tangent=n.new('ShaderNodeTangent');tangent.direction_type='UV_MAP';tangent.uv_map='AfterburnUV';l.new(tangent.outputs['Tangent'],p.inputs['Tangent'])
    if key=='amber':
        socket(p,'Emission Color','Emission').default_value=(*linear(PALETTE['amber']),1);p.inputs['Emission Strength'].default_value=emit
    if key in ('grip','carbon','silver'):
        # Shading detail only; no displacement. Object-scale texture, not
        # oversized weave. Fine directional tread on grip, fine noise on alloy.
        tc=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(2.5,.6,2.5) if key=='grip' else (1,12,1)
        l.new(tc.outputs['Object'],mapping.inputs[0])
        if key=='grip':
            tex=n.new('ShaderNodeTexWave');tex.wave_type='BANDS';tex.bands_direction='X';tex.inputs['Scale'].default_value=2.4;tex.inputs['Distortion'].default_value=1.4;tex.inputs['Detail Scale'].default_value=1.1;fac=tex.outputs['Fac']
        else:
            tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=7 if key=='carbon' else 12;tex.inputs['Detail'].default_value=2;fac=tex.outputs['Fac']
        l.new(mapping.outputs[0],tex.inputs['Vector']);bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22 if key=='grip' else .12;bump.inputs['Distance'].default_value=.035 if key=='grip' else .009;l.new(fac,bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
    if art:
        uv=n.new('ShaderNodeUVMap');uv.uv_map='AfterburnUV';im=n.new('ShaderNodeTexImage');im.image=art;im.extension='CLIP';l.new(uv.outputs['UV'],im.inputs['Vector'])
        mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=m.diffuse_color;l.new(im.outputs['Alpha'],mix.inputs[0]);l.new(im.outputs['Color'],mix.inputs[2]);l.new(mix.outputs['Color'],p.inputs['Base Color'])
    return m
def build(treatment):
    bpy.ops.wm.open_mainfile(filepath=source);before=fingerprint()
    assert len(before)==25
    logo=raster('MAPO-DOFU-wordmark',2048,256,wordmark())
    serial=raster('VECTOR-005-serial',1024,512,labels())
    emblem=raster('VECTOR-velocity-emblem',512,256,insignia())
    mats={k:material(k) for k in PARAMS};mats['logo']=material('petrol',logo);mats['serial']=material('petrol',serial);mats['emblem']=material('grip',emblem)
    zones={}
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        d=o.data;role=o['role'];g=o['assembly'];d.materials.clear()
        for m in mats.values():d.materials.append(m)
        idx={k:i for i,k in enumerate(mats)}
        uv=d.uv_layers.get('AfterburnUV') or d.uv_layers.new(name='AfterburnUV')
        coords=[(v.co.x,v.co.z,-v.co.y) for v in d.vertices]
        counts={}
        for f in d.polygons:
            vs=[coords[i] for i in f.vertices];x,y,z=[sum(v[k] for v in vs)/len(vs) for k in range(3)]
            key='silver'
            frame=role in ('continuous frame','rear continuous frame')
            # Primary frame has four known 101x9 sampled rail blocks; shared
            # nose/tail faces handled separately. Material follows rail lanes,
            # not arbitrary random mesh colors. No face split.
            blocks={i//909 for i in f.vertices if i<3636}
            upper=frame and (len(blocks)==1 and next(iter(blocks)) in (0,2) or role=='rear continuous frame' and (len(blocks)!=1 or max(f.vertices)>=3636) and y>5)
            lower=frame and len(blocks)==1 and next(iter(blocks)) in (1,3)
            lane=sum(i%9 for i in f.vertices)/len(f.vertices)
            if frame:
                if lower:key='silver' if treatment!='covert' or lane>2 else 'carbon'
                elif upper:
                    key='petrol' if treatment!='covert' or lane>3 else 'carbon'
                    # Asymmetric orange longitudinal sweep, not mirrored bands.
                    if (treatment=='afterburn' and ((x<0 and z>10 and lane>3.5) or (x>0 and z<-8 and lane>3.5))) or (treatment=='factory' and lane>6.4 and ((x<0 and z>22) or (x>0 and z<-24))) or (treatment=='covert' and lane>6.5 and (z>24 or z<-29)):key='orange'
                    if lane>7.2 and ((x>0 and z>28) or (x<0 and z<-29)):key='orchid'
                    if g=='front' and x>0 and 10.5<z<28 and len(blocks)==1:key='logo'
                    if g=='rear' and x<0 and -26<z<-11 and len(blocks)==1:key='serial'
                    if g=='rear' and max(f.vertices)>=3636:key='orange' if treatment=='afterburn' else 'petrol'
                else:key='petrol' if y>0 else 'silver'
            elif 'standing insert' in role:key='emblem' if g=='rear' else 'grip'
            elif 'support web' in role or 'pod saddle' in role:key='carbon'
            elif 'bearing sleeve' in role or role=='gimbal collar':key='silver'
            elif role=='gimbal':key='carbon'
            elif role=='propulsion housing':key='silver' if y<-4.7 else 'carbon'
            elif role=='propulsion hub':key='carbon'
            elif role=='radial elements':key='amber'
            f.material_index=idx[key];counts[key]=counts.get(key,0)+1
            for li in f.loop_indices:
                vi=d.loops[li].vertex_index;vx,vy,vz=coords[vi]
                if key=='logo':u=(28-vz)/17.5;v=1-(vi%9)/8
                elif key=='serial':u=(-vz-11)/15;v=(vi%9)/8
                elif key=='emblem':u=(vx+5)/10;v=(-vz-9)/20
                else:u=vz/74+.5;v=vx/24+.5
                uv.data[li].uv=(u,v)
        zones[o.name]=counts
    after=fingerprint();assert before==after,'Geometry fingerprint changed during material assignment'
    bpy.context.scene['stage']='AFTERBURN 004.1 / '+treatment+' / unapproved material study'
    bpy.context.scene['source_sha256']=sha(source)
    dest=os.path.join(out,'VECTOR-005-'+treatment.upper()+'-master.blend')
    bpy.ops.wm.save_as_mainfile(filepath=dest)
    return {'master':os.path.basename(dest),'sha256':sha(dest),'geometryUnchanged':before==after,'meshFingerprintsBefore':before,'meshFingerprintsAfter':after,'zones':zones}
def preflight():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    probe=bpy.data.materials.new('Principled compatibility probe');probe.use_nodes=True
    p=probe.node_tree.nodes.get('Principled BSDF')
    report={'blender':bpy.app.version_string,'principledInputs':[{'name':i.name,'identifier':i.identifier,'type':i.bl_idname} for i in p.inputs],
        'anisotropySocket':socket(p,'Anisotropic IOR Level','Anisotropic').name,
        'coatSocket':socket(p,'Coat Weight','Clearcoat').name,
        'coatRoughnessSocket':socket(p,'Coat Roughness','Clearcoat Roughness').name,
        'emissionSocket':socket(p,'Emission Color','Emission').name,'families':{},'artworkBranches':[]}
    print('AFTERBURN_SOCKET_INVENTORY',json.dumps(report),flush=True)
    im=bpy.data.images.new('Preflight artwork',width=4,height=4,alpha=True)
    for key in PARAMS:
        mat=material(key);n=mat.node_tree.nodes;p=n.get('Principled BSDF')
        assert p is not None and n.get('Material Output').inputs['Surface'].is_linked
        if key=='silver':
            assert abs(socket(p,'Anisotropic IOR Level','Anisotropic').default_value-.28)<1e-6
            assert p.inputs['Tangent'].is_linked and p.inputs['Normal'].is_linked
        if key=='amber':assert abs(p.inputs['Emission Strength'].default_value-.55)<1e-6
        report['families'][key]={'nodes':[n.bl_idname for n in mat.node_tree.nodes],'links':len(mat.node_tree.links)}
    for key in ('petrol','grip'):
        mat=material(key,im);assert mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].is_linked
        report['artworkBranches'].append(key)
    # Audit actual artwork creation too, including all label glyphs.
    for name,shapes in [('wordmark',wordmark()),('serial',labels()),('emblem',insignia())]:
        image=raster('preflight-'+name,64,32,shapes);assert image.packed_file
    report['passed']=True
    json.dump(report,open(os.path.join(out,'shader-preflight.json'),'w'),indent=2)
    print('AFTERBURN_PREFLIGHT_PASS',json.dumps(report),flush=True)
if '--preflight-only' in args:
    preflight()
    sys.exit(0)
def verify_package():
    manifest=json.load(open(os.path.join(out,'afterburn-material-manifest.json')))
    pre=json.load(open(os.path.join(out,'shader-preflight.json')))
    assert pre['passed'] and pre['blender']==bpy.app.version_string
    bpy.ops.wm.open_mainfile(filepath=source);baseline=fingerprint()
    assert len(baseline)==25 and manifest['sourceSha256']==sha(source)
    verified={}
    for edition in ('factory','afterburn','covert'):
        entry=manifest['studies'][edition];path=os.path.join(out,entry['master'])
        assert sha(path)==entry['sha256'] and os.path.getsize(path)>0
        bpy.ops.wm.open_mainfile(filepath=path)
        actual=fingerprint()
        assert actual==baseline==entry['meshFingerprintsBefore']==entry['meshFingerprintsAfter']
        families={m.get('family') for o in bpy.context.scene.objects if o.type=='MESH' for m in o.data.materials if m}
        assert set(PARAMS)<=families
        art=[im for im in bpy.data.images if im.name in ('MAPO-DOFU-wordmark','VECTOR-005-serial','VECTOR-velocity-emblem')]
        assert len(art)==3 and all(im.packed_file and im.size[0]>0 and im.size[1]>0 for im in art)
        silver=next(m for m in bpy.data.materials if m.get('family')=='silver')
        p=silver.node_tree.nodes.get('Principled BSDF')
        assert abs(socket(p,'Anisotropic IOR Level','Anisotropic').default_value-.28)<1e-6 and p.inputs['Tangent'].is_linked
        verified[edition]={'sha256':sha(path),'bytes':os.path.getsize(path),'geometryFingerprints':len(actual),'materialFamilies':sorted(families),'packedArtwork':sorted(im.name for im in art),'anisotropySocket':socket(p,'Anisotropic IOR Level','Anisotropic').name}
    json.dump({'qualifiedMasterPackage':True,'sourceSha256':sha(source),'blender':bpy.app.version_string,'masters':verified},open(os.path.join(out,'master-package-verification.json'),'w'),indent=2)
    print('AFTERBURN_MASTER_PACKAGE_PASS',json.dumps(verified),flush=True)
if '--verify-only' in args:
    verify_package()
    sys.exit(0)
studies={name:build(name) for name in ('factory','afterburn','covert')}
report={'sourceSha256':sha(source),'referenceSha256':'b63e7e1238e4fdcd38ec6b439d2745991eb4c745b00777008f58f399d6efd555','paletteSRGB':PALETTE,'materials':{k:{'palette':v[0],'metallic':v[1],'roughness':v[2],'coat':v[3],'restEmission':v[4],'linearBaseColor':linear(PALETTE[v[0]])} for k,v in PARAMS.items()},'studies':studies,'textures':{'wordmark':[2048,256],'serial':[1024,512],'emblem':[512,256]},'limitations':'Procedural bump, coat and anisotropy are Blender-native; no texture bake, production unwrap, runtime material parity or legibility certification. UVs are local graphic projections, not nonoverlapping atlases. No geometry edits.'}
json.dump(report,open(os.path.join(out,'afterburn-material-manifest.json'),'w'),indent=2)
print('AFTERBURN_BUILD',json.dumps({k:{'sha256':v['sha256'],'geometryUnchanged':v['geometryUnchanged']} for k,v in studies.items()}))
