"""Render the original SFB 30-second music sketch; no audio device is required.
Requires numpy, scipy, ffmpeg, libfluidsynth and a General MIDI soundfont.
Usage: python3 music/freefall/render.py --output /tmp/sfb-music
"""
from pathlib import Path
import argparse
import ctypes as C
import ctypes.util
import math
import struct
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR, BPM, BARS = 44100, 128, 16
BEAT = 60 / BPM
DURATION = BARS * 4 * BEAT
N = round(DURATION * SR)
RNG = np.random.default_rng(128)
CHORDS = [(57, 60, 64, 67, 71), (53, 57, 60, 64, 69),
          (55, 59, 60, 64, 74), (55, 59, 62, 64, 67)]
BASS = [33, 29, 36, 31]
ARPS = [(69, 72, 76, 71, 67, 72, 76, 71), (69, 72, 76, 72, 65, 69, 72, 76),
        (67, 71, 74, 76, 72, 71, 74, 76), (67, 71, 74, 76, 71, 67, 74, 71)]
HOOK = [[(.5, 76), (1.25, 74), (2.5, 72), (3.25, 69)],
        [(.5, 69), (1.25, 72), (2.5, 76), (3.25, 74)],
        [(.5, 67), (1.25, 71), (2.5, 74), (3.25, 76)],
        [(.5, 74), (1.5, 71), (2.5, 69), (3.25, 67)]]
# Each note is (time in beats, duration in beats, pitch, velocity, channel).
notes = {name: [] for name in ['keys', 'hook', 'bass', 'drums']}

def note(stem, t, length, pitch, velocity, channel=0):
    notes[stem].append((t, length, pitch, velocity, channel))

for bar in range(BARS):
    t = bar * 4
    chord = bar % 4
    active = 4 <= bar < 14
    for step, pitch in enumerate(ARPS[chord]):
        # Breathing room is intentional: game impacts occupy the foreground.
        if bar < 4 and step % 2 or bar >= 14 and step in [3, 5, 7]:
            continue
        timing = step * .5 + (.025 if step % 2 else 0)
        note('keys', t + timing, .32 if active else .43, pitch - 12,
             (49 if active else 39) + (5 if step % 4 == 0 else -3), 0)
    if 4 <= bar < 12:
        for timing, pitch in HOOK[chord]:
            note('hook', t + timing, .38 if bar < 8 else .52, pitch, 53 if bar < 8 else 60, 1)
    elif bar in [2, 3, 12, 13]:
        for timing, pitch in HOOK[chord][::2]:
            note('hook', t + timing, .60, pitch, 42, 1)
    for timing, length, offset, velocity in [(0, .82, 0, 81), (1.5, .36, 12, 58), (2.5, .63, 0, 75), (3.5, .30, 7, 49)]:
        if bar < 2 and timing != 0 or bar >= 14 and timing > 2.5:
            continue
        note('bass', t + timing, length, BASS[chord] + offset, velocity, 2)
    kick_times = [0, 2.5] if not active else [0, 1.75, 2.5]
    if bar == 15:
        kick_times = [0]
    for timing in kick_times:
        note('drums', t + timing, .20, 36, 83 if active else 65, 9)
    for timing in [1, 3]:
        if bar < 2 or bar == 15 and timing == 3:
            continue
        note('drums', t + timing, .2, 38 if active else 37, 66 if active else 42, 9)
        if active:
            note('drums', t + timing + .018, .15, 39, 22, 9)
    for step in range(8):
        if bar < 2 and step % 2 == 0 or bar == 15 and step >= 6:
            continue
        note('drums', t + step * .5 + (.035 if step % 2 else 0), .11, 42,
             (42 if step % 2 else 28) + int(RNG.integers(-4, 5)), 9)
    if active:
        note('drums', t + 2.5, .25, 46, 22, 9)
    if bar in [7, 11]:
        for step in [3.25, 3.75]:
            note('drums', t + step, .13, 38, 26, 9)


def fluid_render(stem, program, soundfont):
    lib = C.CDLL(ctypes.util.find_library('fluidsynth'))
    def api(name, result, *args):
        f = getattr(lib, name); f.restype = result; f.argtypes = list(args)
        return f
    ptr, integer, string = C.c_void_p, C.c_int, C.c_char_p
    settings = api('new_fluid_settings', ptr)()
    api('fluid_settings_setnum', integer, ptr, string, C.c_double)(settings, b'synth.sample-rate', SR)
    api('fluid_settings_setnum', integer, ptr, string, C.c_double)(settings, b'synth.gain', .65)
    set_int = api('fluid_settings_setint', integer, ptr, string, integer)
    for key, value in [(b'synth.reverb.active', 0), (b'synth.chorus.active', 0), (b'synth.polyphony', 128), (b'synth.cpu-cores', 1)]:
        set_int(settings, key, value)
    synth = api('new_fluid_synth', ptr, ptr)(settings)
    sf = api('fluid_synth_sfload', integer, ptr, string, integer)(synth, str(soundfont).encode(), 1)
    if sf < 0:
        raise RuntimeError('Soundfont could not be loaded')
    on = api('fluid_synth_noteon', integer, ptr, integer, integer, integer)
    off = api('fluid_synth_noteoff', integer, ptr, integer, integer)
    select = api('fluid_synth_program_select', integer, ptr, integer, integer, integer, integer)
    write = api('fluid_synth_write_float', integer, ptr, integer, ptr, integer, integer, ptr, integer, integer)
    channels = {n[4] for n in notes[stem]}
    for channel in channels:
        select(synth, channel, sf, 128 if channel == 9 else 0, program)
    events = []
    for start, duration, pitch, velocity, channel in notes[stem]:
        events.extend([(round(start * BEAT * SR), 1, channel, pitch, velocity),
                       (round((start + duration) * BEAT * SR), 0, channel, pitch, 0)])
    events.sort()
    # Render two periods and keep the second, including the previous period's tails.
    events = sorted(events + [(sample + N, kind, ch, key, vel) for sample, kind, ch, key, vel in events])
    out = np.zeros((N * 2, 2), np.float32)
    position = 0
    for sample, kind, channel, pitch, velocity in events + [(N * 2, -1, 0, 0, 0)]:
        sample = min(N * 2, sample)
        count = sample - position
        if count > 0:
            block = np.zeros((count, 2), np.float32)
            write(synth, count, block.ctypes.data, 0, 2, block.ctypes.data, 1, 2)
            out[position:sample] = block
            position = sample
        if kind == 1:
            on(synth, channel, pitch, velocity)
        elif kind == 0:
            off(synth, channel, pitch)
    api('delete_fluid_synth', None, ptr)(synth)
    api('delete_fluid_settings', None, ptr)(settings)
    return out[N:]


def pads():
    out = np.zeros((N, 2), np.float64)
    for bar in range(BARS):
        length = round((4 * BEAT + .72) * SR)
        t = np.arange(length) / SR
        envelope = np.minimum(1, t / .18) * np.minimum(1, (length / SR - t) / .72)
        level = .007 if bar < 4 or bar >= 14 else .010
        for voice, pitch in enumerate(CHORDS[bar % 4]):
            f = 440 * 2 ** ((pitch - 69) / 12)
            for channel, detune in enumerate([-.0009, .0009]):
                phase = 2 * np.pi * f * (1 + detune) * t + voice * .71
                wave = np.sin(phase) + .25 * np.sin(phase * 2) + .09 * np.sin(phase * 3)
                signal = wave * envelope * level * (1 + .07 * np.sin(2 * np.pi * .8 * t + voice))
                idx = (round(bar * 4 * BEAT * SR) + np.arange(length)) % N
                np.add.at(out[:, channel], idx, signal)
    return out


def delay(signal, seconds, gain, cross=False):
    shifted = np.roll(signal, round(seconds * SR), axis=0)
    return shifted[:, ::-1] * gain if cross else shifted * gain


def ambience(signal):
    # Quiet circular taps preserve ambience across the 30 s loop boundary.
    result = signal.copy()
    for seconds, gain in [(.071, .10), (.113, .08), (.179, .06), (.233, .05), (.307, .035), (.419, .025), (.557, .016)]:
        result += delay(signal, seconds, gain, True)
    return result


def midi_file(path):
    def vlq(n):
        data = [n & 127]; n >>= 7
        while n:
            data.insert(0, (n & 127) | 128); n >>= 7
        return bytes(data)
    def track(events):
        data = bytearray(); last = 0
        for tick, event in sorted(events, key=lambda e:e[0]):
            data += vlq(tick - last) + event; last = tick
        data += vlq(BARS * 4 * 480 - last) + b'\xff\x2f\x00'
        return b'MTrk' + struct.pack('>I', len(data)) + data
    tempo = round(60000000 / BPM)
    tracks = [track([(0, b'\xff\x51\x03' + tempo.to_bytes(3, 'big')), (0, b'\xff\x58\x04\x04\x02\x18\x08')])]
    all_notes = dict(notes)
    all_notes['pad'] = [(bar * 4, 3.8, pitch, 34, 3) for bar in range(BARS) for pitch in CHORDS[bar % 4]]
    programs = {'keys':4, 'hook':11, 'bass':38, 'drums':0, 'pad':89}
    for name, part in all_notes.items():
        channels = {n[4] for n in part}
        events = [(0, b'\xff\x03' + bytes([len(name)]) + name.encode())]
        events += [(0, bytes([0xc0 | channel, programs[name]])) for channel in channels]
        for start, length, pitch, velocity, channel in part:
            events.extend([(round(start * 480), bytes([0x90 | channel, pitch, velocity])),
                           (round((start + length) * 480), bytes([0x80 | channel, pitch, 0]))])
        tracks.append(track(events))
    path.write_bytes(b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), 480) + b''.join(tracks))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('/tmp/sfb-music'))
    parser.add_argument('--soundfont', type=Path, default=Path('/usr/share/sounds/sf2/TimGM6mb.sf2'))
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    stems = {name: fluid_render(name, program, args.soundfont) for name, program in [('keys', 4), ('hook', 11), ('bass', 38), ('drums', 0)]}
    # Leave the 880–1760 Hz coin notes and impact transients in the foreground.
    keys = sosfilt(butter(2, 2300, fs=SR, output='sos'), stems['keys'], axis=0)
    hook = sosfilt(butter(2, 3000, fs=SR, output='sos'), stems['hook'], axis=0)
    bass = sosfilt(butter(2, 1800, fs=SR, output='sos'), stems['bass'], axis=0)
    drum = stems['drums']
    time = np.arange(N) / SR
    duck = 1 - .26 * np.exp(-((time / BEAT) % 1) / .13)
    melodic = ambience(keys * .80 + pads()) * duck[:, None]
    melodic += (hook + delay(hook, BEAT * .75, .19, True) + delay(hook, BEAT * 1.5, .08, True)) * .65
    mix = melodic + bass * .79 + drum * .88
    mix = sosfilt(butter(2, 30, btype='highpass', fs=SR, output='sos'), np.tile(mix, (2, 1)), axis=0)[N:]
    # Smooth limiting, then reserve a little headroom before the final loudness pass.
    peak = np.max(np.abs(mix)); mix = np.tanh(mix * .93 / max(peak, .0001))
    mix *= .89 / max(np.max(np.abs(mix)), .0001)
    # Match endpoints over 8 ms without a perceptible fade between loop cycles.
    edge = round(SR * .008)
    target = (mix[0] + mix[-1]) / 2
    ramp = (.5 + .5 * np.cos(np.linspace(0, np.pi, edge)))[:, None]
    mix[:edge] += ramp * (target - mix[0])
    mix[-edge:] += ramp[::-1] * (target - mix[-1])
    wav = args.output / 'sfb-freefall-30s.wav'
    with wave.open(str(wav), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
    for suffix, codec in [('mp3', ['-codec:a', 'libmp3lame', '-b:a', '160k']), ('ogg', ['-codec:a', 'libvorbis', '-q:a', '5'])]:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                        '-af', 'loudnorm=I=-18:TP=-1.5:LRA=8', '-ar', str(SR),
                        *codec, str(args.output / ('sfb-freefall-30s.' + suffix))], check=True)
    midi_file(args.output / 'sfb-freefall-30s.mid')
    print(f'Rendered {DURATION:.3f} s / {BARS} bars / {BPM} BPM; peak before encoding: {20*math.log10(np.max(np.abs(mix))):.2f} dBFS')

if __name__ == '__main__':
    main()
