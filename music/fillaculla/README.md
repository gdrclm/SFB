# Fillaculla — первая локация SFB

`fillaculla.flac` — исходный загруженный файл, без изменений: стерео, 44,1 кГц,
101,151338 секунды. Он заменяет Freefall в небесной локации (0–500 м).
Тема Miny главного меню и Crystal Canyon v2 второй локации сохраняются.

Браузер использует `public/music-demo/fillaculla-sky.ogg` (Vorbis q5) или
`fillaculla-sky.mp3` (192 кбит/с). FLAC не загружается игровым клиентом.
Трек зациклен штатным проигрывателем, работает с паузой, переключателем
музыки и существующим переходом в кристальную локацию.

Исходная интегральная громкость — −8,09 LUFS. Постоянное усиление −9,91 dB
приводит игровой файл примерно к −18 LUFS. Дополнительные инструменты,
сжатие динамики, изменение темпа или высоты не применяются.

Повторный экспорт из корня репозитория:

```sh
ffmpeg -i music/fillaculla/fillaculla.flac -af volume=-9.91dB -ar 44100 \
  -c:a libvorbis -q:a 5 public/music-demo/fillaculla-sky.ogg
ffmpeg -i music/fillaculla/fillaculla.flac -af volume=-9.91dB -ar 44100 \
  -c:a libmp3lame -b:a 192k public/music-demo/fillaculla-sky.mp3
```
