import json, pathlib, subprocess, math, array
files=list(pathlib.Path('test-results').rglob('synesthesia-av.*'))
assert files, 'missing audiovisual export'
morph=list(pathlib.Path('test-results').rglob('morphology-av.*'))
assert morph, 'missing facial audiovisual export'
files+=morph
visceral=list(pathlib.Path('test-results').rglob('visceral-av.*'))
assert visceral, 'missing visceral audiovisual export'
files+=visceral
for p in files:
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_packets','-of','json',str(p)]))
 streams=data['streams']; v=next(s for s in streams if s['codec_type']=='video'); a=next(s for s in streams if s['codec_type']=='audio')
 def span(s):
  pts=[float(x['pts_time']) for x in data['packets'] if x['stream_index']==s['index'] and 'pts_time' in x]; return min(pts),max(pts),len(pts)
 vs,ve,vn=span(v);as_,ae,an=span(a)
 pcm=array.array('h',subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-ac','1','-ar','16000','-f','s16le','-']))
 rms=math.sqrt(sum(x*x for x in pcm)/len(pcm))/32768
 frames=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-vf','scale=64:36','-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','-'])
 frame_count=len(frames)//(64*36*3)
 assert vn>5 and frame_count>5 and an>5 and rms>.01 and ve-vs>1 and ae-as_>1
 assert abs(vs-as_)<.5 and abs(ve-ae)<1.0, 'track timestamp spans differ excessively'
 print('SYNESTHESIA_AV_VERIFY '+json.dumps({'file':str(p),'video_codec':v['codec_name'],'audio_codec':a['codec_name'],'decoded_frames':frame_count,'audio_rms':rms,'video_start':vs,'audio_start':as_,'video_end':ve,'audio_end':ae,'start_skew_seconds':abs(vs-as_),'end_skew_seconds':abs(ve-ae),'video_packets':vn,'audio_packets':an,'duration_video':ve-vs,'duration_audio':ae-as_}))

 if p.name.startswith('visceral-av.'):
  # Stationary specimen, no typography or temporal effects. Exclude constant background using corner RGB.
  raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-vf','scale=160:100','-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','-'])
  stride=160*100*3;images=[raw[i:i+stride] for i in range(0,len(raw),stride) if len(raw[i:i+stride])==stride]
  assert len(images)>5
  bg=images[0][:3];best=0
  for i,x in enumerate(images):
   for y in images[i+1:]:
    region=changed=0
    for k in range(0,stride,3):
     if max(sum(abs(x[k+j]-bg[j]) for j in range(3)),sum(abs(y[k+j]-bg[j]) for j in range(3)))<45: continue
     region+=1
     if sum(abs(x[k+j]-y[k+j]) for j in range(3))>60: changed+=1
    if region>100:best=max(best,changed/region)
  assert best>.12, 'encoded stationary anatomy does not visibly change'
  print('VISCERAL_ENCODED_PIXEL_CHANGE '+json.dumps({'frames':len(images),'max_foreground_changed_fraction':best}))
