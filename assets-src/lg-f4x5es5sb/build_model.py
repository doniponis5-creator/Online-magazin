# -*- coding: utf-8 -*-
"""
LG F4X5ES5SB — процедурная модель ТЩЛЬКО внешнего корпуса (TASK 04).
Запуск: blender --factory-startup --background --python build_model.py
Создаёт согласованный .blend и рендерит два ракурса (фронт и 3/4) в PNG.

Пропорции и детали — по официальным фото-референсам (references/):
серебристый корпус ~600×850×560 мм, широкая чёрная верхняя панель
с центральным металлическим переключателем, крупная тёмная дверца,
выдвижной лоток слева, сервисная крышка внизу справа.
Внутренний механизм, вода и скролл на этом этапе НЕ моделируются.
"""

import bpy
import math
import os
from mathutils import Vector

REPO = r"D:\Projects\Online-magazin"
BLEND_OUT = os.path.join(REPO, r"assets-src\lg-f4x5es5sb\lg-f4x5es5sb.blend")
RENDER_DIR = os.path.join(REPO, r"review\task-04")

# ---------- размеры (метры) ----------
W, H, D = 0.60, 0.85, 0.56          # корпус
FEET = 0.035                         # высота ножек
PANEL_H = 0.105                      # чёрная панель (верх фронта)
DOOR_R = 0.242                       # внешний радиус кольца дверцы
DOOR_Z = FEET + 0.435                # центр дверцы от пола
FRONT = D / 2                        # фронтальная грань корпуса

# ---------- сцена ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 192
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1200
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'

# ---------- материалы ----------
def make_mat(name, base, rough, metallic=0.0, aniso=0.0, emission=None, emis_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    try:
        bsdf.inputs['Anisotropic'].default_value = aniso
    except Exception:
        pass
    if emission:
        try:
            bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
            bsdf.inputs['Emission Strength'].default_value = emis_strength
        except Exception:
            pass
    return m

m_silver = make_mat('BodySilver', (0.88, 0.89, 0.92), 0.28, 1.0, 0.35)
m_silver_side = make_mat('BodySilverDark', (0.74, 0.76, 0.80), 0.36, 1.0, 0.3)
m_black = make_mat('PanelBlack', (0.015, 0.015, 0.02), 0.22, 0.25)
m_chrome = make_mat('Chrome', (0.90, 0.91, 0.94), 0.06, 1.0)
m_glass = make_mat('DoorGlass', (0.03, 0.04, 0.06), 0.04, 0.55)
m_drum_dark = make_mat('DrumDark', (0.03, 0.035, 0.045), 0.35)
m_plastic = make_mat('DarkPlastic', (0.05, 0.05, 0.06), 0.5)
m_seam = make_mat('Seam', (0.01, 0.01, 0.012), 0.6)
m_floor = make_mat('Floor', (0.86, 0.87, 0.89), 0.6)
m_display = make_mat('Display', (0.02, 0.03, 0.04), 0.15, 0.1,
                     emission=(0.75, 0.85, 1.0), emis_strength=2.2)

# ---------- помощники ----------
def add_box(name, size, loc, mat, bevel=0.008, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bev = o.modifiers.new('Bevel', 'BEVEL')
        bev.width = bevel
        bev.segments = 4
        bev.harden_normals = True
    o.data.materials.append(mat)
    return o

def add_cyl(name, r, depth, loc, mat, rot=(0, 0, 0), seg=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc,
                                        rotation=rot, vertices=seg)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    return o

def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# ---------- корпус ----------
body = add_box('Body', (W, D, H), (0, 0, FEET + H / 2), m_silver, bevel=0.013)

# ---------- верхняя чёрная панель (фронт, верх) ----------
pz_top = FEET + H - 0.012
pz_bot = pz_top - PANEL_H
add_box('TopPanel', (W - 0.02, 0.016, PANEL_H),
        (0, FRONT - 0.004, (pz_top + pz_bot) / 2), m_black, bevel=0.004)

add_box('PanelSeam', (W - 0.02, 0.006, 0.004),
        (0, FRONT - 0.004, pz_bot - 0.003), m_seam, bevel=0.001)

# переключатель (центр панели) — ось ВЫХОДИТ из панели (вдоль Y)
knob_z = (pz_top + pz_bot) / 2
add_cyl('Knob', 0.040, 0.016, (0.0, FRONT + 0.006, knob_z), m_chrome, rot=(math.pi / 2, 0, 0))
add_cyl('KnobRim', 0.047, 0.008, (0.0, FRONT + 0.001, knob_z), m_black, rot=(math.pi / 2, 0, 0))
# метка на переключателе
add_box('KnobTick', (0.005, 0.003, 0.016), (0.0, FRONT + 0.015, knob_z + 0.017), m_seam, bevel=0.0)

# дисплей (слева)
add_box('Display', (0.115, 0.004, 0.040), (-0.185, FRONT + 0.004, knob_z), m_display, bevel=0.002)
# кнопки (справа, ряд) — оси тоже вдоль Y
for i in range(4):
    add_cyl('Btn%d' % i, 0.008, 0.008,
            (0.13 + i * 0.038, FRONT + 0.006, knob_z), m_plastic, rot=(math.pi / 2, 0, 0))

# ---------- дверца ----------
# кольцо-тор: реальное отверстие, стекло видно сквозь него
bpy.ops.mesh.primitive_torus_add(
    major_radius=DOOR_R - 0.024, minor_radius=0.024,
    location=(0, FRONT + 0.018, DOOR_Z), rotation=(math.pi / 2, 0, 0),
    major_segments=64, minor_segments=24)
ring = bpy.context.active_object
ring.name = 'DoorRingTorus'
ring.data.materials.append(m_chrome)
# стекло утоплено ВНУТРИ кольца (за плоскостью тора), видно через отверстие
add_cyl('DoorGlass', DOOR_R - 0.030, 0.012, (0, FRONT - 0.002, DOOR_Z), m_glass,
        rot=(math.pi / 2, 0, 0))
# барабан в глубине — через стекло читается тёмный барабан
add_cyl('DrumBehind', DOOR_R - 0.045, 0.012, (0, FRONT - 0.045, DOOR_Z), m_drum_dark,
        rot=(math.pi / 2, 0, 0))
# тонкое внутреннее обрамление стекла (бортик барабана)
bpy.ops.mesh.primitive_torus_add(
    major_radius=DOOR_R - 0.030, minor_radius=0.007,
    location=(0, FRONT - 0.008, DOOR_Z), rotation=(math.pi / 2, 0, 0),
    major_segments=48, minor_segments=16)
bore = bpy.context.active_object
bore.name = 'DrumBore'
bore.data.materials.append(m_silver_side)
# ручка дверцы (справа на кольце)
add_box('DoorHandle', (0.022, 0.030, 0.125),
        (DOOR_R - 0.014, FRONT + 0.028, DOOR_Z + 0.022), m_chrome, bevel=0.009)

# ---------- выдвижной лоток — внутри чёрной панели, слева от переключателя ----------
dz = knob_z
add_box('Detergent', (0.115, 0.014, 0.062), (-0.215, FRONT + 0.002, dz), m_black, bevel=0.003)
add_box('DeterrentSeam', (0.122, 0.004, 0.068), (-0.215, FRONT - 0.002, dz), m_seam, bevel=0.001)
add_box('DetergentHandle', (0.075, 0.012, 0.011), (-0.215, FRONT + 0.008, dz - 0.020), m_silver_side, bevel=0.003)

# ---------- сервисная крышка (внизу справа) ----------
add_box('ServiceFlap', (0.205, 0.010, 0.150), (0.155, FRONT - 0.001, FEET + 0.16), m_silver_side, bevel=0.004)
add_box('ServiceSeam', (0.213, 0.004, 0.158), (0.155, FRONT - 0.005, FEET + 0.16), m_seam, bevel=0.002)

# ---------- ножки ----------
for sx in (-1, 1):
    for sy in (-1, 1):
        add_cyl('Foot%s%s' % (sx, sy), 0.017, FEET,
                (sx * (W / 2 - 0.05), sy * (D / 2 - 0.06), FEET / 2), m_plastic, seg=24)

# ---------- пол и фон ----------
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'Floor'
floor.data.materials.append(m_floor)

world = bpy.data.worlds.new('Studio')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.82, 0.84, 0.9, 1.0)
bg.inputs[1].default_value = 0.75

# ---------- свет ----------
def add_light(name, kind, size, energy, loc, color=(1, 1, 1), target=(0, 0, 0.5)):
    bpy.ops.object.light_add(type=kind, location=loc)
    l = bpy.context.active_object
    l.name = name
    l.data.energy = energy
    l.data.color = color
    if kind == 'AREA':
        l.data.size = size
        l.data.size_y = size * 0.75
    look_at(l, target)
    return l

add_light('Key', 'AREA', 2.8, 680, (0.9, 2.3, 2.7), (1.0, 0.98, 0.95))
add_light('Fill', 'AREA', 2.2, 210, (-2.6, 1.5, 1.7))
add_light('RimBlue', 'AREA', 1.2, 90, (2.6, -1.3, 1.9), (0.62, 0.74, 1.0))
add_light('AccentLime', 'AREA', 0.9, 40, (-2.2, -1.7, 0.5), (0.85, 1.0, 0.55))

# ---------- камеры ----------
def add_cam(name, loc, target, lens=62):
    cam_data = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    cam_data.lens = lens
    look_at(cam, target)
    return cam

cam_front = add_cam('CamFront', (0.0, 2.55, FEET + H * 0.52),
                    (0, 0, FEET + H * 0.49), lens=66)
cam_quarter = add_cam('CamQuarter', (1.52, 1.95, FEET + 0.58),
                      (0, 0, FEET + H * 0.42), lens=62)

# ---------- сохранение и рендеры ----------
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

os.makedirs(RENDER_DIR, exist_ok=True)

import sys
QUICK = '--quick' in sys.argv

if QUICK:
    # быстрый фронтальный кадр для сверки с официальным фото (низкие сэмплы)
    scene.cycles.samples = 32
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 750
    scene.camera = cam_front
    scene.render.filepath = os.path.join(RENDER_DIR, '_quick-front.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED _quick-front.png')
else:
    for cam, fname in ((cam_front, '01-front.png'), (cam_quarter, '02-three-quarter.png')):
        scene.camera = cam
        scene.render.filepath = os.path.join(RENDER_DIR, fname)
        bpy.ops.render.render(write_still=True)
        print('RENDERED', fname)
print('DONE')
