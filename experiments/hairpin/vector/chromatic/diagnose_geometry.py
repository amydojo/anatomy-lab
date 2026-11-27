"""CHROMATIC PRECISION exact mesh equivalence and mismatch diagnostics.
Raw ordered fingerprints retained. No positional tolerance, quantization,
nearest-neighbor substitution or relaxation of control-mesh identity.
"""
import bpy,sys,os,json,hashlib,struct,collections,math
def sha(path):return hashlib.sha256(open(path,'rb').read()).hexdigest()
def digest(x):return hashlib.sha256(repr(x).encode()).hexdigest()
def mesh_snapshot(m,matrix):
    m.calc_loop_triangles()
    local=tuple(tuple(float(x) for x in v.co) for v in m.vertices)
    world=tuple(tuple(float(x) for x in matrix@v.co) for v in m.vertices)
    faces=tuple(tuple(p.vertices) for p in m.polygons)
    edges=tuple(tuple(e.vertices) for e in m.edges)
    triangles=tuple(tuple(t.vertices) for t in m.loop_triangles)
    h=hashlib.sha256()
    for v in world:h.update(struct.pack('<3f',*v))
    for f in faces:h.update(struct.pack('<I',len(f)));h.update(struct.pack('<'+'I'*len(f),*f))
    return {'local':local,'world':world,'faces':faces,'edges':edges,'triangles':triangles,'raw':h.hexdigest()}
def snapshot():
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();res={}
    for o in sorted(bpy.context.scene.objects,key=lambda x:x.name):
        if o.type!='MESH':continue
        ev=o.evaluated_get(deps);m=ev.to_mesh()
        res[o.name]={'assembly':o.get('assembly'),'matrix':tuple(tuple(float(v) for v in row) for row in o.matrix_world),'evaluatedMatrix':tuple(tuple(float(v) for v in row) for row in ev.matrix_world),'control':mesh_snapshot(o.data,o.matrix_world),'evaluated':mesh_snapshot(m,ev.matrix_world)}
        ev.to_mesh_clear()
    assert len(res)==25
    return res
def cycle(face):
    # Preserve oriented winding; normalize only cyclic starting corner.
    return min(face[i:]+face[:i] for i in range(len(face)))
def canonical(m):
    v=m['world']
    # Python float equality normalizes +0/-0, never rounds nonzero values.
    # Preserve multiplicity of vertices, edges, polygons and triangulated faces.
    # Also preserve incidence at coincident vertices via per-vertex signatures.
    incidence=[[] for _ in v]
    for a,b in m['edges']:
        incidence[a].append(('e',v[b]));incidence[b].append(('e',v[a]))
    for f in m['faces']:
        for i,a in enumerate(f):
            incidence[a].append(('f',tuple(v[f[(i+j)%len(f)]] for j in range(1,len(f)))))
    return {'vertices':sorted(v),'edges':sorted(tuple(sorted((v[a],v[b]))) for a,b in m['edges']),
        'faces':sorted(cycle(tuple(v[i] for i in f)) for f in m['faces']),
        'triangles':sorted(cycle(tuple(v[i] for i in f)) for f in m['triangles']),
        'incidence':sorted((p,tuple(sorted(incidence[i]))) for i,p in enumerate(v))}
def delta(a,b):
    if len(a)!=len(b):return None
    return max((math.dist(x,y) for x,y in zip(a,b)),default=0)
def compare(a,b):
    out={}
    for name in sorted(set(a)|set(b)):
        if name not in a or name not in b:
            out[name]={'pass':False,'reason':'missing component'};continue
        aa,bb=a[name],b[name];matrix=aa['matrix']==bb['matrix'] and aa['evaluatedMatrix']==bb['evaluatedMatrix']
        c=aa['control'];d=bb['control'];e=aa['evaluated'];f=bb['evaluated']
        controlFields={k:c[k]==d[k] for k in ('local','world','faces','edges','triangles','raw')}
        exact={k:e[k]==f[k] for k in ('local','world','faces','edges','triangles','raw')}
        ce,cf=canonical(e),canonical(f)
        canonicalFields={k:ce[k]==cf[k] for k in ce}
        # Require exact indexed control identity and exact evaluated surface,
        # including triangulation and vertex incidence. No epsilon allowed.
        ok=matrix and aa['assembly']==bb['assembly'] and all(controlFields.values()) and all(canonicalFields.values())
        out[name]={'pass':ok,'assembly':aa['assembly'],'objectTransformsExact':matrix,'controlFieldsExact':controlFields,'evaluatedFieldsExact':exact,'evaluatedCanonicalExact':canonicalFields,'orderedHashes':[e['raw'],f['raw']],'controlVertexCount':[len(c['local']),len(d['local'])],'evaluatedVertexCount':[len(e['local']),len(f['local'])],'evaluatedPolygonCount':[len(e['faces']),len(f['faces'])],'indexedWorldMaxDelta':delta(e['world'],f['world']),'sortedWorldMaxDelta':delta(ce['vertices'],cf['vertices']),'classification':('ordered identical' if all(exact.values()) else 'exact surface equivalence; ordering or signed zero' if ok else 'unresolved geometry mismatch')}
    return out
def allpass(result):return all(v['pass'] for v in result.values())
def open_snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(path));return snapshot()
def historical(source,packages,out):
    baseline=open_snapshot(source);report={'sourceSha256':sha(source),'blender':bpy.app.version_string,'packages':{},'sourceRepeat':compare(baseline,open_snapshot(source))}
    for package in packages:
        manifest=json.load(open(os.path.join(package,'afterburn-material-manifest.json')));p={}
        assert manifest['sourceSha256']==sha(source)
        for edition,entry in manifest['studies'].items():
            path=os.path.join(package,entry['master']);assert sha(path)==entry['sha256']
            current=open_snapshot(path);comparison=compare(baseline,current)
            for name,item in comparison.items():
                recorded=entry['meshFingerprintsBefore'][name];post=entry['meshFingerprintsAfter'][name]
                item['recordedPrePostExact']=recorded==post
                item['reopenedControlMatchesRecorded']=current[name]['control']['raw']==recorded['control']
                item['reopenedEvaluatedMatchesRecorded']=current[name]['evaluated']['raw']==recorded['evaluated']
                item['sourceEvaluatedMatchesRecorded']=baseline[name]['evaluated']['raw']==recorded['evaluated']
                item['pass']=item['pass'] and item['recordedPrePostExact'] and item['reopenedControlMatchesRecorded']
            p[edition]={'pass':allpass(comparison),'sha256':sha(path),'components':comparison}
        report['packages'][os.path.basename(package)]=p
    report['pass']=allpass(report['sourceRepeat']) and all(v['pass'] for p in report['packages'].values() for v in p.values())
    json.dump(report,open(out,'w'),indent=2)
    print('CHROMATIC_DIAGNOSTICS',json.dumps({'pass':report['pass'],'packages':{p:{k:{'pass':v['pass'],'different':[n for n,c in v['components'].items() if not all(c['evaluatedFieldsExact'].values()) or not c['reopenedEvaluatedMatchesRecorded'] or not c['sourceEvaluatedMatchesRecorded']]} for k,v in d.items()} for p,d in report['packages'].items()}}),flush=True)
    if not report['pass']:raise RuntimeError('Exact mesh equivalence not established; see component report')
if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:]
    def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
    source=arg('source');assert sha(source)=='1f55c85022e8f6a70fbf7f7c06617c8c01005b1a5ce178796a8ab112dd7dfe55'
    historical(source,[arg('successful'),arg('partial')],arg('out'))
