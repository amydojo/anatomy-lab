"""Verify the reopened chromatic candidate against exact source and clay.
No tolerance or weakening of mechanical requirements.
"""
import bpy,sys,os,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from diagnose_geometry import open_snapshot,compare,allpass,sha
args=sys.argv[sys.argv.index('--')+1:]
def arg(k):return os.path.abspath(args[args.index('--'+k)+1])
source,clay,master=arg('source'),arg('clay'),arg('master')
assert sha(source)=='464e25dea9fef7b609b0117a744d94f659aaa862bc8eedd7cc6ff4d40c481dfe'
assert sha(clay)=='1f55c85022e8f6a70fbf7f7c06617c8c01005b1a5ce178796a8ab112dd7dfe55'
manifest=json.load(open(os.path.join(os.path.dirname(master),'chromatic-manifest.json')))
assert sha(master)==manifest['masterSha256']
a=open_snapshot(clay);b=open_snapshot(source);c=open_snapshot(master)
checks={'clayToCandidate':compare(a,c),'afterburnToCandidate':compare(b,c)}
families={m.get('family') for o in bpy.context.scene.objects if o.type=='MESH' for m in o.data.materials if m}
images={im.name:bool(im.packed_file) for im in bpy.data.images}
silver=next(m for m in bpy.data.materials if m.get('family')=='silver')
p=silver.node_tree.nodes.get('Principled BSDF');aniso=p.inputs.get('Anisotropic') or p.inputs.get('Anisotropic IOR Level')
materialPass=set(['petrol','orange','silver','carbon','grip','orchid','amber'])<=families and all(images.get(k) for k in ('MAPO-DOFU-wordmark','VECTOR-005-serial','VECTOR-velocity-emblem','CHROMATIC-velocity-stripes')) and aniso is not None and abs(aniso.default_value-.28)<1e-6 and p.inputs['Tangent'].is_linked
report={'sourceSha256':sha(source),'claySha256':sha(clay),'masterSha256':sha(master),'checks':checks,'preSaveExactEquivalence':manifest['preSaveExactEquivalence'],'materialPass':materialPass,'packedImages':images}
report['pass']=all(allpass(v) for v in checks.values()) and materialPass and manifest['preSaveExactEquivalence']
json.dump(report,open(arg('out'),'w'),indent=2)
print('CHROMATIC_REOPEN',json.dumps({'pass':report['pass'],'materialPass':materialPass,'mismatches':{k:[n for n,c in v.items() if not c['pass']] for k,v in checks.items()}}),flush=True)
if not report['pass']:raise RuntimeError('Independent exact equivalence not established')
