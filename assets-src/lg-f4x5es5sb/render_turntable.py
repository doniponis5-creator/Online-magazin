# -*- coding: utf-8 -*-
"""
TASK_05: последовательность поворота LG F4X5ES5SB (¾ → фронт → ¾).
Загружает ГОТОВУЮ сцену lg-f4x5es5sb.blend (v7) и НЕ меняет её объекты:
вращается камера по дуге вокруг вертикальной оси машины. Радиус, высота,
оптика (ортхо-scale) и точка наведения сохраняются на всей дуге.

Запуск:
  blender --background --python-exit-code 1 --python render_turntable.py -- \
      [--check] [--series] [--frames N] [--size N] [--samples N]

  --check   : три контрольных кадра (−30°, 0°, +30°) в review/task-05/check/
  --series  : полная последовательность в assets-src/lg-f4x5es5sb/turntable/
  --size    : сторона кадра в пикселях (по умолчанию 1200 для серии)
  --samples : сэмплы Cycles (по умолчанию 128 для серии)
Готовые кадры серии не перезаписываются — запуск можно возобновлять.
"""

import bpy
import math
import os
import sys
from mathutils import Vector
from pathlib import Path

SRC = Path(__file__).resolve().parent
BLEND = SRC / 'lg-f4x5es5sb.blend'
REPO = SRC.parents[1]
CHECK_DIR = REPO / 'review' / 'task-05' / 'check'
SERIES_DIR = SRC / 'turntable'

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CHECK = '--check' in ARGV
SERIES = '--series' in ARGV
FRAMES = 60
SIZE = 1200
SAMPLES = 128
for i, a in enumerate(ARGV):
    if a == '--frames' and i + 1 < len(ARGV):
        FRAMES = int(ARGV[i + 1])
    if a == '--size' and i + 1 < len(ARGV):
        SIZE = int(ARGV[i + 1])
    if a == '--samples' and i + 1 < len(ARGV):
        SAMPLES = int(ARGV[i + 1])

# ---------- параметры дуги (соответствуют принятому фронтальному ракурсу v7) ----------
RADIUS = 3.12            # радиус дуги камеры (фронтальная камера v7: y=3.12)
CAM_Z = 0.425            # высота наведения/камеры (фронт v7)
TARGET = Vector((0, 0, 0.425))
ORTHO_SCALE = 1.00       # фронтальная камера v7
ANGLE_FROM = math.radians(-30)
ANGLE_TO = math.radians(30)

# ---------- загрузка сцены ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=str(BLEND))
scene = bpy.context.scene

#.RemoveAll: никаких изменений объектов/материалов — только камера и рендер
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'

# дуговая камера: радиус/высота/оптика константы, меняется только угол
cam_data = bpy.data.cameras.new('TurnCam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = ORTHO_SCALE
cam = bpy.data.objects.new('TurnCam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def place(deg):
    a = math.radians(deg)
    cam.location = (RADIUS * math.sin(a), RADIUS * math.cos(a), CAM_Z)
    d = TARGET - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render_to(path, size):
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path.name, flush=True)


if CHECK:
    CHECK_DIR.mkdir(parents=True, exist_ok=True)
    for name, deg in (('frame-A-minus30', -30), ('frame-B-front', 0), ('frame-C-plus30', 30)):
        place(deg)
        render_to(CHECK_DIR / (name + '.png'), 1000)
    print('CHECK DONE', flush=True)

if SERIES:
    SERIES_DIR.mkdir(parents=True, exist_ok=True)
    for i in range(FRAMES):
        out = SERIES_DIR / ('f{:03d}.png'.format(i))
        if out.exists() and os.path.getsize(out) > 0:
            print('SKIP exists', out.name, flush=True)
            continue
        deg = -30 + (60.0 * i / (FRAMES - 1))
        place(deg)
        # мастер-размер: из него собираются webp-серии mobile/desktop
        render_to(out, SIZE)
    print('SERIES DONE', FRAMES, flush=True)

if not CHECK and not SERIES:
    print('nothing to do: pass --check or --series', flush=True)
