"""Two additive arrangements of the supplied Miny stereo mix.

Python + NumPy/SciPy + libfluidsynth/GM soundfont + ffmpeg. No online service.
The MIDI files describe the NEW parts; the musician's original remains audio.
"""
from pathlib import Path
import argparse
import ctypes as C
import ctypes.util
import json
import math
import struct
import subprocess
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
RNG = np.random.default_rng(95)
CHORDS = [(48, 55, 60, 64, 74), (45, 52, 57, 60, 67),
          (41, 52, 57, 60, 67), (43, 50, 55, 60, 69)]
ROOTS = [36, 33, 29, 31]
PROGRAMS = {'keys': 4, 'bass': 33, 'drums': 0, 'pad': 89, 'answer': 73}


def make_score(neon):
    bpm, intro, bars = (128, 8, 64) if neon else (95, 4, 56)
    parts = {key: [] for key in PROGRAMS}
    def note(part, at, length, pitch, velocity):
        parts[part].append((at, length, pitch, max(1, min(110, round(velocity)))))
    for bar in range(bars):
        relative = bar - intro
        ending = bar >= intro + 48
        opening = bar < intro
        bridge = 12 <= relative < 16 or 32 <= relative < 36
        tail = relative >= 44
        strong = not opening and not bridge and not tail and not ending
        final = 36 <= relative < 44
        stage = .65 if opening else .50 if bridge else .55 if tail or ending else 1.0
        index = ((bar if opening else relative) // (1 if opening else 2)) % 4
        if ending:
            index = [2, 3, 0, 0][min(3, (bar-intro-48)//(2 if neon else 1))]
        chord, root = CHORDS[index], ROOTS[index]
        t = bar * 4
        # Wide, slow chord movement: C(add9), Am7, Fmaj9, Gsus4(add6).
        for pitch in chord[1:]:
            note('pad', t+.015, 4.15, pitch, 37*stage+(5 if final else 0))
        # Rhodes in the sky; offbeat stabs and moving sixteenths for neon.
        pattern = [0, 1.5, 2.5, 3.5] if not neon else [.5, 1.5, 2.5, 3.5]
        if opening and bar < 2: pattern = [0, 2.5]
        for j, beat in enumerate(pattern):
            for pitch in chord[1:4]:
                note('keys', t+beat+.008*j, .6 if not neon else .24, pitch+12,
                     (43 if not neon else 48)*stage+(7 if beat==.5 else 0))
        if neon and strong:
            for step in range(8):
                pitch = chord[[1, 2, 3, 4, 3, 2, 4, 2][step]]+12
                note('answer', t+step*.5+.25, .18, pitch, 42+(6 if final else 0))
        # Responses occupy the ends of phrases instead of doubling the original hook.
        elif (relative % 4 == 3 or opening or ending) and bar % 2:
            for beat, pitch in [(2.25, 76), (2.75, 74), (3.25, 72), (3.75, 67)]:
                note('answer', t+beat, .34, pitch, 35 if bridge else 42)
        if opening and bar < (3 if neon else 2):
            note('bass', t, 3.4, root, 50)
        elif bridge:
            note('bass', t, 2.8, root, 50)
            note('bass', t+3.5, .35, root+7, 42)
        elif not (ending and bar >= bars-2):
            sequence = [(0, .7, 0), (1.5, .35, 12), (2.5, .55, 0), (3.5, .35, 7)]
            if neon: sequence = [(0,.38,0),(.75,.18,0),(1.5,.3,12),(2,.38,0),(2.75,.18,7),(3.5,.3,12)]
            for beat, length, offset in sequence:
                note('bass', t+beat, length, root+offset-(12 if neon else 0), (78 if neon else 66)*stage)
        else: note('bass', t, 3.7, root, 42)
        # Drums open, thin out in the breaks, then return with a stronger final chorus.
        if ending and bar >= bars-2: continue
        if opening and bar < (4 if neon else 2):
            if bar: note('drums',t, .15, 36, 40)
            continue
        kicks = [0, 1, 2, 3] if neon and not bridge else [0, 2.5] if not bridge else [0]
        for beat in kicks: note('drums', t+beat, .16, 36, (82 if neon else 62)*stage)
        for beat in [1, 3]:
            note('drums',t+beat,.16,38 if neon else 37,(61 if neon else 46)*stage)
            if neon and strong: note('drums',t+beat+.012,.12,39,37)
        for step in range(16 if neon and final else 8):
            unit = .25 if neon and final else .5
            if bridge and step%2: continue
            note('drums',t+step*unit+(.018 if step%2 else 0),.08,42 if neon else 70,
                 (36 if step%2 else 25)*stage+RNG.integers(-3,4))
        if neon and strong:
            for beat in [.5, 2.5]: note('drums',t+beat,.16,46,31)
        if bar%8==7 and not ending:
            for j, beat in enumerate([3,3.25,3.5,3.75]):
                note('drums',t+beat,.12,[48,47,45,38][j],38+j*4)
        if neon and bridge and relative in [15,35]:
            for j in range(8): note('drums',t+2+j*.25,.10,38,28+j*5)
    return bpm, intro, bars, parts


def fluid_render(notes, program, channel, duration, bpm, soundfont):
    lib = C.CDLL(ctypes.util.find_library('fluidsynth'))
    def api(name, result, *args):
        fn = getattr(lib,name);fn.restype=result;fn.argtypes=list(args);return fn
    ptr, integer, string = C.c_void_p,C.c_int,C.c_char_p
    settings=api('new_fluid_settings',ptr)()
    api('fluid_settings_setnum',integer,ptr,string,C.c_double)(settings,b'synth.sample-rate',SR)
    api('fluid_settings_setnum',integer,ptr,string,C.c_double)(settings,b'synth.gain',.7)
    for key,value in [(b'synth.reverb.active',0),(b'synth.chorus.active',0),(b'synth.polyphony',128)]:
        api('fluid_settings_setint',integer,ptr,string,integer)(settings,key,value)
    synth=api('new_fluid_synth',ptr,ptr)(settings)
    sf=api('fluid_synth_sfload',integer,ptr,string,integer)(synth,str(soundfont).encode(),1)
    if sf<0: raise RuntimeError('Soundfont could not be loaded')
    api('fluid_synth_program_select',integer,ptr,integer,integer,integer,integer)(synth,channel,sf,128 if channel==9 else 0,program)
    on=api('fluid_synth_noteon',integer,ptr,integer,integer,integer)
    off=api('fluid_synth_noteoff',integer,ptr,integer,integer)
    write=api('fluid_synth_write_float',integer,ptr,integer,ptr,integer,integer,ptr,integer,integer)
    events=[]
    for at,length,pitch,velocity in notes:
        events += [(round(at*60/bpm*SR),1,pitch,velocity),(round((at+length)*60/bpm*SR),0,pitch,0)]
    n=round(duration*SR);out=np.zeros((n,2),np.float32);position=0
    for sample,kind,pitch,velocity in sorted(events)+[(n,-1,0,0)]:
        sample=min(n,sample);count=sample-position
        if count>0:
            block=np.empty((count,2),np.float32)
            write(synth,count,block.ctypes.data,0,2,block.ctypes.data,1,2)
            out[position:sample]=block;position=sample
        if kind==1:on(synth,channel,pitch,velocity)
        elif kind==0:off(synth,channel,pitch)
    api('delete_fluid_synth',None,ptr)(synth);api('delete_fluid_settings',None,ptr)(settings)
    return out


def echo(x, seconds, gain, cross=False):
    n=round(seconds*SR);out=np.zeros_like(x)
    out[n:]=x[:-n,::-1] * gain if cross else x[:-n]*gain
    return out


def phrase_balance(mix, bpm, bars):
    """Keep the new intro/outro audible beside a mastered stereo recording.

    Bar-long RMS windows and interpolation avoid audio-rate pumping. Preserve
    a quiet opening and the release tail; the final limiter handles transients.
    """
    beat=60/bpm;centres=[];gains=[]
    for bar in range(bars):
        left=round(bar*4*beat*SR);right=round((bar+1)*4*beat*SR)
        rms=math.sqrt(float(np.mean(mix[left:right]**2)))
        centres.append((left+right)/2/SR)
        gains.append(float(np.clip(.09/max(.001,rms),.70,3.0)))
    time=np.arange(len(mix),dtype=np.float32)/SR
    mix*=np.interp(time,centres,gains).astype(np.float32)[:,None]


def midi_file(path, bpm, bars, parts, programs, intro):
    def vlq(n):
        data=[n&127];n>>=7
        while n:data.insert(0,(n&127)|128);n>>=7
        return bytes(data)
    def track(events):
        data=bytearray();last=0
        for tick,event in sorted(events,key=lambda e:e[0]):
            data+=vlq(tick-last)+event;last=tick
        data+=vlq(max(0,bars*4*480-last))+b'\xff\x2f\x00'
        return b'MTrk'+struct.pack('>I',len(data))+data
    tempo=round(60_000_000/bpm)
    meta=[(0,b'\xff\x51\x03'+tempo.to_bytes(3,'big')),(0,b'\xff\x58\x04\x04\x02\x18\x08')]
    for bar,name in [(0,'Intro'),(intro,'Original mix enters'),(intro+12,'Break'),(intro+16,'Chorus'),(intro+32,'Break 2'),(intro+36,'Final chorus'),(intro+48,'Outro')]:
        label=name.encode();meta.append((bar*4*480,b'\xff\x06'+bytes([len(label)])+label))
    tracks=[track(meta)]
    for channel,(name,notes) in enumerate(parts.items()):
        ch=9 if name=='drums' else channel
        data=[(0,b'\xff\x03'+bytes([len(name)])+name.encode()),(0,bytes([0xc0|ch,programs[name]]))]
        for at,length,pitch,velocity in notes:
            data += [(round(at*480),bytes([0x90|ch,pitch,velocity])),(round((at+length)*480),bytes([0x80|ch,pitch,0]))]
        tracks.append(track(data))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(tracks),480)+b''.join(tracks))


def master(wav, output, target):
    norm=f'loudnorm=I={target}:TP=-1.8:LRA=10'
    raw=subprocess.run(['ffmpeg','-hide_banner','-i',str(wav),'-af',norm+':print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
    measured=json.JSONDecoder().raw_decode(raw[raw.rfind('{'):])[0]
    params=':'.join(f'{dest}={measured[src]}' for dest,src in [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),('measured_thresh','input_thresh'),('offset','target_offset')])
    master_path=wav.with_name(wav.stem+'-master.wav')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-af',norm+':'+params+':linear=true','-ar',str(SR),'-c:a','pcm_s24le',str(master_path)],check=True)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(master_path),'-c:a','libmp3lame','-b:a','224k','-metadata','title='+output.stem,str(output.with_suffix('.mp3'))],check=True)
    return measured,master_path


def render(source, output, work, soundfont, neon):
    bpm,intro,bars,parts=make_score(neon);beat=60/bpm;duration=bars*4*beat+3
    name='miny-crystal-drive' if neon else 'miny-skyline'
    programs=dict(PROGRAMS)
    if neon: programs.update({'bass':38,'answer':98,'keys':5,'pad':90})
    n=round(duration*SR);mix=np.zeros((n,2),np.float32)
    filter_audio=['atempo='+str(bpm/95)] if neon else []
    args=['ffmpeg','-v','error','-i',str(source)]
    if filter_audio:args+=['-af',','.join(filter_audio)]
    original=np.frombuffer(subprocess.check_output(args+['-ac','2','-ar',str(SR),'-f','f32le','pipe:1']),np.float32).reshape(-1,2).copy()
    original=sosfilt(butter(2,100 if neon else 65,btype='highpass',fs=SR,output='sos'),original,axis=0).astype(np.float32)
    at=round(intro*4*beat*SR);mix[at:at+len(original)]+=original*(.56 if neon else .67)
    del original
    levels={'keys':.027,'bass':.039,'drums':.037,'pad':.018,'answer':.017} if neon else {'keys':.025,'bass':.030,'drums':.023,'pad':.017,'answer':.013}
    time=np.arange(n,dtype=np.float32)/SR
    for channel,(part,notes) in enumerate(parts.items()):
        print(name,part,len(notes),flush=True)
        stem=fluid_render(notes,programs[part],9 if part=='drums' else channel,duration,bpm,soundfont)
        if part=='bass':stem=sosfilt(butter(2,1800 if neon else 1300,fs=SR,output='sos'),stem,axis=0).astype(np.float32)
        if part in ['keys','pad','answer']:
            stem=sosfilt(butter(2,6500 if neon else 4700,fs=SR,output='sos'),stem,axis=0).astype(np.float32)
            stem+=echo(stem,beat*.75,.17 if neon else .12,True)
            stem+=echo(stem,.073,.09,True)+echo(stem,.173,.06,True)
            if neon:stem*= (1-.22*np.exp(-((time/beat)%1)/.16))[:,None]
        active=np.max(np.abs(stem),axis=1)>.001
        rms=math.sqrt(float(np.mean(stem[active]**2))) if np.any(active) else .1
        mix+=stem*min(3.0,levels[part]/max(rms,.001));del stem
    # A restrained cymbal lift announces section changes, never an in-game SFX.
    if neon:
        for bar in [intro+4,intro+16,intro+36]:
            count=round(beat*4*SR);noise=RNG.normal(0,1,count).astype(np.float32)
            noise=sosfilt(butter(2,[2000,8500],btype='bandpass',fs=SR,output='sos'),noise).astype(np.float32)
            envelope=np.linspace(0,1,count,dtype=np.float32)**2
            start=round((bar-1)*4*beat*SR);mix[start:start+count]+=noise[:,None]*envelope[:,None]*.014
    mix=sosfilt(butter(2,28,btype='highpass',fs=SR,output='sos'),mix,axis=0).astype(np.float32)
    phrase_balance(mix,bpm,bars)
    mix[:round(.04*SR)]*=np.linspace(0,1,round(.04*SR),dtype=np.float32)[:,None]
    fade=round(2.3*SR);mix[-fade:]*=np.linspace(1,0,fade,dtype=np.float32)[:,None]
    # Float input preserves headroom for two-pass loudness/true-peak mastering.
    raw=work/(name+'.f32');mix.tofile(raw);del mix
    wav=work/(name+'.wav')
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i',str(raw),'-c:a','pcm_f32le',str(wav)],check=True)
    measured,master_path=master(wav,output/name,-16 if neon else -17)
    midi_file(output/(name+'.mid'),bpm,bars,parts,programs,intro)
    print(json.dumps({'name':name,'bpm':bpm,'bars':bars,'duration':duration,'original_starts':intro*4*beat,'master_wav':str(master_path),'measurement':measured}),flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=Path('public/music-demo/miny-original.mp3'))
    parser.add_argument('--output',type=Path,default=Path('public/music-demo'))
    parser.add_argument('--work',type=Path,default=Path('/tmp/sfb-miny'))
    parser.add_argument('--soundfont',type=Path,default=Path('/usr/share/sounds/sf2/TimGM6mb.sf2'))
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True);args.work.mkdir(parents=True,exist_ok=True)
    for neon in [False,True]:render(args.source,args.output,args.work,args.soundfont,neon)

if __name__=='__main__':main()
