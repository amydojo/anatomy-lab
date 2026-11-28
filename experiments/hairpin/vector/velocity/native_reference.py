"""Independent native triangle reference for the pinned baked master; no geometry edits."""
import bpy, sys, json, hashlib
args=sys.argv[sys.argv.index('--')+1:]
src,out=args
assert hashlib.sha256(open(src,'rb').read()).hexdigest()=='f51f570cf1815a9c2c6d31df0af3fc75f17683450e619736be5edb703dd17fe2'
bpy.ops.wm.open_mainfile(filepath=src)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
groups={k:[] for k in ('front','rear','joint','front_pod','rear_pod')}
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles()
    v=[ev.matrix_world@p.co for p in m.vertices]
    pts=[[float(p.x)*.001,float(p.z)*.001,-float(p.y)*.001] for p in v]
    groups[o['assembly']].extend([[pts[i] for i in t.vertices] for t in m.loop_triangles])
    ev.to_mesh_clear()
assert sum(map(len,groups.values()))==19986 and all(groups.values())
json.dump(groups,open(out,'w'),separators=(',',':'))
print('NATIVE_REFERENCE', {k:len(v) for k,v in groups.items()})
