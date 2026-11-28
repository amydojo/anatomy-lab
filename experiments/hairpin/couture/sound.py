"""Original synthetic mechanical ritual: no samples or external assets."""
import math,random,struct,wave,sys
rate=44100;duration=49/8; rng=random.Random(5)
def pulse(t,start,length,f,amp):
    d=t-start
    if d<0 or d>length:return 0
    env=min(1,d/.003)*math.exp(-d/(length/5))
    return amp*env*(.65*math.sin(2*math.pi*f*d)+.35*math.sin(2*math.pi*f*2.71*d))
buf=bytearray()
for i in range(round(duration*rate)):
    t=i/rate
    a=sum(pulse(t,s,.16,f,.19) for s,f in [(0.72,1750),(1.08,2300),(2.0,920),(2.5,1450),(4.45,1900),(5.1,1250)])
    u=max(0,min(1,(t-1.3)/3.2))
    if 1.3<t<4.5:a+=.055*math.sin(math.pi*u)**2*(math.sin(2*math.pi*(90*(t-1.3)+37*(t-1.3)**2))+.35*math.sin(2*math.pi*370*t))
    a+=.10*max(0,min(1,(t-5.5)/.45))*math.sin(2*math.pi*48*t)
    a+=.035*rng.uniform(-1,1)*sum(math.exp(-((t-s)/.012)**2) for s in [.72,1.08,4.45,5.1])
    a*=min(1,(duration-t)/.06)
    buf+=struct.pack('<h',round(max(-1,min(1,a))*32767))
with wave.open(sys.argv[1],'wb') as w:w.setparams((1,2,rate,0,'NONE','not compressed'));w.writeframes(buf)
