import struct
import re

intro='F#~---F#~---F#~-F#~-F#~---F#~---F#~-F#~---G#~-A#~-G#~-F#~'
verse1='''F# ^C# A#~ A# G# F# R F# ^B A#~ A# G# G# F# R
F# ^B A# A# G# G# F# G# D#~ C#~
F# F# ^C# A# A# G# G#~ R F# F# ^B A# A# G# G#~ R
F# F# ^B A# G# G# F# G# D#~ C#~'''
bridge='''F# F# F# F# F# F# R F# D# F# F# A# F#~ R
F# F# F# F# F# D# F# F# F# A# F#~
A# A# ^C# ^B A# F# G# F# F#~ R
F# A# F# F# F# D# F# F# D# C#~'''
chorus='''F# A# F# ^C# F# A# F# ^C#~ R F# A# F# ^C# F# A# F#~
F# ^C# A# A# G# F#~ R F# ^C# A# A# G# F#~
F# ^C# A# A# G# F# G# A# G#~ R
F# ^C# A# A# G# F# G# A# G#~
F# A# F# ^C# F# A# F# ^C#~
A# A# G# F# F# F# E D# F#~'''
solo=re.sub(r'(?<![A-Za-z#])([A-G]#?)',r'^\1',intro)+'''
^F# ^F# ^D# ^F# ^F# ^F# ^F# ^D# ^F# ^F# ^A# ^G#~
^F# ^F# ^D# ^F# ^F# ^F# ^F# ^D# ^C# B A# G# F#~'''
verse2=verse1.replace('^C# A#~','^C# A#').replace('^B A#~','^B A#').replace('G# F# R','G# F#~ R').replace('G# G# F# R','G# G# F#~ R')
outro=intro+'\n'+'\n'.join(['F# ^C# A# A# G# F#~']*3)
sections=[('Вступление',intro),('Куплет 1',verse1),('Переход 1',bridge),('Припев 1',chorus),('Соло',solo),('Куплет 2',verse2),('Переход 2',bridge.replace('F# F# F# F# F# F# R','F# F# F# F# F# F#~ R',1)),('Припев 2',chorus),('Финал',outro)]
pitch={'F#':66,'G#':68,'A#':70,'B':59,'C#':61,'D#':63,'E':64}
events=[]; markers=[]; beat=0
for name,notes in sections:
    markers.append((beat,name))
    for m in re.finditer(r'(\^?)([A-G]#?|R)(~?)(-*)',notes):
        high,n,hold,dashes=m.groups()
        dur=2.0 if len(dashes)>=3 else (1.0 if hold else .5)
        if n!='R': events.append((beat,dur,pitch[n]+12*bool(high),name))
        beat+=dur
    beat+=.5

def vlq(v):
    a=[v&127]; v>>=7
    while v: a.insert(0,(v&127)|128); v>>=7
    return bytes(a)
def chunk(es):
    es.sort(key=lambda x:(x[0],x[1])); data=b''; last=0
    for tick,priority,msg in es: data+=vlq(tick-last)+msg; last=tick
    data+=b'\x00\xff\x2f\x00'
    return b'MTrk'+struct.pack('>I',len(data))+data
meta=[(0,0,b'\xff\x51\x03\x07\xa1\x20'),(0,0,b'\xff\x58\x04\x04\x02\x18\x08')]
for b,name in markers:
    s=name.encode(); meta.append((round(b*480),1,b'\xff\x06'+vlq(len(s))+s))
