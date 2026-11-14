import runpy, wave, struct, subprocess, json
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

import argparse
parser=argparse.ArgumentParser(description='SFB Crystal Canyon: new melody and harmony, preserving the Neon arrangement')
parser.add_argument('--output', type=Path, default=Path('/workspace/work/audio/crystal-v2'))
parser.add_argument('--score', type=Path, default=Path(__file__).with_name('score-v2.py'))
parser.add_argument('--name', default='sfb-crystal-canyon-v2')
args=parser.parse_args()
d=runpy.run_path(str(args.score))
sr=44100; end=d['beat']*.5; size=int((end+4)*sr)
out=args.output; out.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(17)
stems={k:np.zeros((size,2),np.float32) for k in ['lead','pads','bass','arp','drums','fx']}
mid={k:[] for k in stems}
def put(key,y,start,gain=1,pan=0):
    i=round(start*sr); n=min(len(y),size-i)
    if n<=0:return
    if y.ndim==1:y=np.column_stack((y*np.sqrt((1-pan)/2),y*np.sqrt((1+pan)/2)))
    stems[key][i:i+n]+=y[:n]*gain
def freq(n):return 440*2**((n-69)/12)
def env(t,length,a=.008,r=.08):return np.minimum(t/a,1)*np.minimum(np.maximum(length-t,0)/r,1)
def synth(n,length,kind):
    t=np.arange(round(length*sr))/sr; f=freq(n)
    if kind=='lead':
        result=[]
        for detune in [-.0025,.0025]:
            ph=2*np.pi*f*(1+detune)*t+.045*np.sin(2*np.pi*5.2*t)
            y=sum(np.sin(ph*h)/h**1.65*np.exp(-h*t*.9) for h in range(1,9))
            result.append(y*env(t,length,.009,.05))
        return np.column_stack(result)*.25
    if kind=='bass':
        ph=2*np.pi*f*t
        y=np.sin(ph)+.35*np.sin(2*ph)+.12*np.sin(3*ph)
        return y*np.exp(-t*2)*env(t,length,.004,.04)*.34
    if kind=='arp':
        ph=2*np.pi*f*t
        return (np.sin(ph)+.4*np.sin(2*ph)+.2*np.sin(3*ph))*np.exp(-t*10)*env(t,length,.003,.07)*.13
    result=[]
    for detune in [-.003,.003]:
        ph=2*np.pi*f*(1+detune)*t
        y=sum(np.sin(ph*h)/h**2 for h in range(1,7))
        result.append(y*env(t,length,.5,.8)*(.8+.2*np.sin(2*np.pi*.23*t)))
    return np.column_stack(result)*.065
def note(key,n,start,length,gain=1,pan=0):
    put(key,synth(n,length,key if key!='pads' else 'pad'),start,gain,pan)
    mid[key].extend([(round(start*960),2,bytes([0x90,n,round(min(120,85*gain))])),(round((start+length)*960),1,bytes([0x80,n,0]))])
for b,dur,n,name in d['events']:
    strong='Припев' in name
    note('lead',n,b*.5,dur*.5*.94,1.05 if strong else .86)
    if strong: note('lead',n-12,b*.5,dur*.5*.9,.22)
# D#m9, Bmaj9, G#m9, C#6sus4. Bass supplies the roots;
# four pad voices preserve the previous arrangement's density.
chords=d.get('chords',[(39,[54,58,61,65]),(35,[54,58,61,63]),(44,[54,58,59,63]),(37,[54,56,58,61])])
markers=d['markers']
for si,(b,name) in enumerate(markers):
    start=b*.5; stop=markers[si+1][0]*.5 if si+1<len(markers) else end
    strong='Припев' in name; intro='Вступление'==name; outro='Финал'==name; bridge='Переход' in name
    bar=0; s=start
    while s<stop-.1:
        root,ch=chords[bar%4]; length=min(2,stop-s)
        for n in ch:note('pads',n,s,length+.75,1.3 if strong else .95)
        steps=int(np.ceil(length/.25))
        for j in range(steps):
            at=s+j*.25
            if at>=stop:break
            if not intro or bar>=2:
                note('bass',root-12 if j%4!=3 else root,at,min(.21,stop-at),.95 if strong else .7)
            if not intro or bar>=1:
                arpnote=ch[[0,2,1,3,2,1,3,2][j%8]]+12
                note('arp',arpnote,at,.34,.9 if strong else .55,np.sin(j*1.4)*.65)
        if not outro and (not intro or bar>=2):
            for j in range(4):
                at=s+j*.5
                if at>=stop:continue
                if j in [0,2] or strong:
                    t=np.arange(int(.42*sr))/sr
                    phase=2*np.pi*(48*t+95*.028*(1-np.exp(-t/.028)))
                    y=np.sin(phase)*np.exp(-t*13)+rng.normal(0,.12,len(t))*np.exp(-t*160)
                    put('drums',y,at,.7)
                    mid['drums'].extend([(round(at*960),2,bytes([0x99,36,105])),(round((at+.1)*960),1,bytes([0x89,36,0]))])
                if j%2:
                    t=np.arange(int(.25*sr))/sr
                    noise=rng.normal(0,1,len(t)); noise=sosfilt(butter(2,1400,fs=sr,btype='highpass',output='sos'),noise)
                    y=(noise*.35+np.sin(2*np.pi*185*t)*.22)*np.exp(-t*17)
                    put('drums',y,at,.6,.08)
                    mid['drums'].extend([(round(at*960),2,bytes([0x99,38,95])),(round((at+.1)*960),1,bytes([0x89,38,0]))])
            for j in range(8 if not strong else 16):
                at=s+j*(.25 if not strong else .125)
                if at>=stop:break
                t=np.arange(int(.075*sr))/sr
                noise=sosfilt(butter(2,7500,fs=sr,btype='highpass',output='sos'),rng.normal(0,1,len(t)))
                put('drums',noise*np.exp(-t*65),at,.10 if j%2 else .14,(-1)**j*.4)
        s+=2;bar+=1
    if strong or bridge:
        length=min(2,start)
        t=np.arange(int(length*sr))/sr
        y=sosfilt(butter(2,3500,fs=sr,btype='highpass',output='sos'),rng.normal(0,1,len(t)))
        put('fx',y*(t/length)**3*.075,start-length)
        t=np.arange(int(1.8*sr))/sr
        put('fx',rng.normal(0,1,len(t))*np.exp(-t*4),start,.055)
# Beat-synced stereo echoes and diffuse tails.
for key in ['lead','arp','pads']:
    dry=stems[key].copy()
    for delay,gain in [(.375,.25),(.75,.13),(1.125,.065)]:
        k=int(delay*sr);stems[key][k:]+=dry[:-k,::-1]*gain
    for delay,gain in [(.061,.08),(.093,.065),(.149,.05),(.211,.04)]:
        k=int(delay*sr);stems[key][k:]+=dry[:-k,::-1]*gain
for key in ['pads','bass','arp']:
    for si,(b,name) in enumerate(markers):
        if name in ['Вступление','Финал']:continue
        a=int(b*.5*sr);z=int((markers[si+1][0]*.5 if si+1<len(markers) else end)*sr)
        t=np.arange(z-a)/sr
        pump=1-(.38 if key=='pads' else .2)*np.exp(-np.mod(t,.5)/.095)
        stems[key][a:z]*=pump[:,None]
mix=sum(stems.values())
fade=np.ones(size); a=int((end-7)*sr);fade[a:]=np.linspace(1,0,size-a)**1.2
mix*=fade[:,None];mix*=np.minimum(np.arange(size)/(sr*.35),1)[:,None]
mix=np.tanh(mix*1.18)
mix*=.94/np.max(np.abs(mix))
assert np.isfinite(mix).all()
with wave.open(str(out/(args.name+'.wav')),'wb') as w:
    w.setparams((2,2,sr,0,'NONE','not compressed'));w.writeframes((mix*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-y','-v','error','-i',str(out/(args.name+'.wav')),'-c:a','libmp3lame','-b:a','256k',str(out/(args.name+'.mp3'))],check=True)
tracks=[d['chunk'](d['meta'])]
for ch,(key,ev) in enumerate(mid.items()):
    if not ev:continue
    if key!='drums':
        ev=[(t,p,bytes([(msg[0]&240)|ch])+msg[1:]) for t,p,msg in ev]
        ev.insert(0,(0,0,bytes([0xc0|ch,{'lead':81,'pads':89,'bass':38,'arp':98,'fx':95}[key]])))
    label=key.encode();ev.append((0,0,b'\xff\x03'+bytes([len(label)])+label));tracks.append(d['chunk'](ev))
(out/(args.name+'.mid')).write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(tracks),480)+b''.join(tracks))
print(json.dumps({'duration':size/sr,'peak':float(np.max(np.abs(mix))),'rms':float(np.sqrt(np.mean(mix**2))),'tracks':len(tracks)}))
