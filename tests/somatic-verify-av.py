import json, pathlib, subprocess, math, array
files=list(pathlib.Path('test-results').rglob('synesthesia-av.*'))
assert files, 'missing audiovisual export'
for p in files:
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_packets','-of','json',str(p)]))
 streams=data['streams']; v=next(s for s in streams if s['codec_type']=='video'); a=next(s for s in streams if s['codec_type']=='audio')
 def span(s):
  pts=[float(x['pts_time']) for x in data['packets'] if x['stream_index']==s['index'] and 'pts_time' in x]; return min(pts),max(pts),len(pts)
 vs,ve,vn=span(v);as_,ae,an=span(a)
 pcm=array.array('h',subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-ac','1','-ar','16000','-f','s16le','-']))
 rms=math.sqrt(sum(x*x for x in pcm)/len(pcm))/32768
 frames=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-vf','scale=64:36','-f','rawvideo','-pix_fmt','rgb24','-'])
 frame_count=len(frames)//(64*36*3)
 assert vn>5 and frame_count>5 and an>5 and rms>.01 and ve-vs>1 and ae-as_>1
 assert abs(vs-as_)<.5 and abs(ve-ae)<1.0, 'track timestamp spans differ excessively'
 print('SYNESTHESIA_AV_VERIFY '+json.dumps({'file':str(p),'video_codec':v['codec_name'],'audio_codec':a['codec_name'],'decoded_frames':frame_count,'audio_rms':rms,'video_start':vs,'audio_start':as_,'video_end':ve,'audio_end':ae,'start_skew_seconds':abs(vs-as_),'end_skew_seconds':abs(ve-ae),'video_packets':vn,'audio_packets':an,'duration_video':ve-vs,'duration_audio':ae-as_}))
