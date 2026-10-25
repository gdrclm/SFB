"""New melodic material on the existing composition's exact rhythmic skeleton."""
import runpy
import re
from pathlib import Path

source = runpy.run_path(str(Path(__file__).with_name('score.py')))
intro = 'C#5 G#4 E4 F#4 G#4 B4 G#4 E4 D#4 E4 G#4 C#5'
verse = [
    'C#4 E4 G#4 B4 G#4 E4 D#4 F#4 A4 G#4 E4 D#4 C#4',
    'E4 G#4 B4 A4 G#4 E4 D#4 F#4 E4 C#4',
    'C#4 D#4 E4 G#4 B4 G#4 E4 D#4 E4 F#4 A4 G#4 F#4 E4',
    'E4 G#4 B4 C#5 B4 G#4 F#4 E4 D#4 C#4',
]
bridge = [
    'G#4 E4 G#4 B4 G#4 E4 F#4 A4 G#4 E4 D#4 F#4',
    'E4 G#4 B4 G#4 E4 F#4 A4 C#5 B4 G#4 F#4',
    'G#4 B4 D#5 C#5 B4 A4 G#4 F#4 D#4',
    'E4 G#4 B4 A4 G#4 F#4 E4 D#4 B3 D#4',
]
chorus = [
    'C#5 G#4 B4 E5 D#5 B4 G#4 C#5 E5 D#5 B4 G#4 F#4 E4 G#4',
    'B4 G#4 E4 F#4 D#4 E4 G#4 B4 A4 G#4 F#4 E4',
    'E4 G#4 B4 C#5 B4 G#4 F#4 E4 D#4',
    'E4 G#4 B4 D#5 C#5 B4 G#4 E4 C#4',
    'C#5 B4 G#4 E5 D#5 B4 G#4 F#4',
    'E4 G#4 B4 A4 G#4 F#4 E4 D#4 C#4',
]
solo = [
    'C#6 G#5 E5 F#5 G#5 B5 G#5 E5 D#5 E5 G#5 C#6',
    'E5 G#5 B5 G#5 E5 F#5 A5 G#5 E5 D#5 F#5 G#5',
    'B5 G#5 E5 F#5 A5 G#5 F#5 E5 D#5 B4 G#4 E4 C#4',
]
outro = [intro,
    'B4 G#4 E4 F#4 D#4 E4',
    'G#4 E4 D#4 F#4 E4 C#4',
    'E4 D#4 B3 G#3 B3 C#4',
]
replacements = [ [intro], verse, bridge, chorus, solo, verse, bridge, chorus, outro ]
def midi(token):
    m = re.fullmatch(r'([A-G])(#?)([0-8])', token)
    assert m, token
    letter, sharp, octave = m.groups()
    return (int(octave)+1)*12 + {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[letter] + bool(sharp)

events=[]
for (name, original), replacement in zip(source['sections'], replacements):
    original_events = [e for e in source['events'] if e[3]==name]
    original_lines = original.splitlines()
    assert len(original_lines)==len(replacement), name
    pitches=[]
    for old, new in zip(original_lines,replacement):
        expected = len(re.findall(r'\^?[A-G]#?', old))
        notes = new.split()
        assert len(notes)==expected, (name,expected,len(notes))
        pitches.extend(midi(n) for n in notes)
    assert len(pitches)==len(original_events)
    events.extend((b,d,n,name) for (b,d,_,_),n in zip(original_events,pitches))

markers=source['markers']
beat=source['beat']
chunk=source['chunk']
meta=source['meta']
chords=[(37,[52,56,59,63]),(33,[52,56,59,61]),(42,[52,56,57,61]),(35,[52,54,56,59])]

assert len(events)==len(source['events'])
assert all(a[:2]==b[:2] and a[3]==b[3] for a,b in zip(events,source['events']))
changed=sum(a[2]!=b[2] for a,b in zip(events,source['events']))
interval_changes=sum((a[2]-pa[2])!=(b[2]-pb[2]) for pa,a,pb,b in zip(events,events[1:],source['events'],source['events'][1:]))
assert changed/len(events)>.85
assert interval_changes/(len(events)-1)>.6
