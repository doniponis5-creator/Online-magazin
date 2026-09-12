# -*- coding: utf-8 -*-
"""LG F4X5ES5SB — внешняя модель по официальным фото, не заводской CAD.
blender --background --python build_model.py -- --quick
Быстрый режим: четыре превью. Полный: два ракурса по 192 сэмпла.
Барабан упрощён, только видимая часть. Мотор, вода, скролл не добавляются.
"""
import math
import os
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ASSET_DIR = Path(__file__).resolve().parent
REPO = ASSET_DIR.parents[1]
BLEND_OUT = ASSET_DIR / 'lg-f4x5es5sb.blend'
RENDER_DIR = REPO / 'review' / 'task-04'
QUICK = '--quick' in sys.argv
CHECK_ONLY = '--check-only' in sys.argv
W, H, D, FEET = .600, .838, .565, .012
FRONT = D / 2
DOOR_Z, DOOR_R = FEET + H * .538, .263
PANEL_H = .100
AXIS_Y = (math.pi / 2, 0, 0)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48 if QUICK else 192
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 6
scene.render.resolution_x = 1000 if QUICK else 1600
scene.render.resolution_y = scene.render.resolution_x
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = -.45
scene.render.threads_mode = 'FIXED'
scene.render.threads = min(12, os.cpu_count() or 4)

def mat(name, base, rough=.3, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

silver = mat('Satin stainless steel', (.64, .66, .68), .34, .80)
nodes, links = silver.node_tree.nodes, silver.node_tree.links
coord = nodes.new('ShaderNodeTexCoord')
scale = nodes.new('ShaderNodeVectorMath')
scale.operation = 'MULTIPLY'
scale.inputs[1].default_value = (8, 8, 2200)
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 1
noise.inputs['Detail'].default_value = 2
bump = nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = .15
bump.inputs['Distance'].default_value = .00012
links.new(coord.outputs['Object'], scale.inputs[0])
links.new(scale.outputs[0], noise.inputs['Vector'])
links.new(noise.outputs['Fac'], bump.inputs['Height'])
links.new(bump.outputs['Normal'], nodes['Principled BSDF'].inputs['Normal'])
roughness = nodes.new('ShaderNodeMath')
roughness.operation = 'MULTIPLY_ADD'
roughness.inputs[1].default_value = .18
roughness.inputs[2].default_value = .23
links.new(noise.outputs['Fac'], roughness.inputs[0])
links.new(roughness.outputs[0], nodes['Principled BSDF'].inputs['Roughness'])
chrome = mat('Brushed chrome', (.62, .65, .68), .23, 1)
black = mat('Gloss black fascia', (.003, .004, .005), .19, 0)
door_black = mat('Smooth piano black door', (.002, .003, .004), .14, 0)
for dark_material in (black, door_black):
    dark_material.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = .23
rubber = mat('Rubber gasket', (.015, .018, .021), .48)
seam = mat('Recess black', (.002, .003, .004), .55)
seam.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0
steel = mat('Drum stainless', (.30, .33, .36), .27, .95)
ink = mat('Control legends', (.48, .50, .52), .5)
dim_ink = mat('Secondary control legends', (.19, .21, .23), .5)
led = mat('Display digits', (.70, .83, .90), .4)
led.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (.60, .78, .90, 1)
led.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .65
glass = mat('Smoked transparent door glass', (.56, .59, .62), .012)
glass.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 1
glass.node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value = 1.46

def weighted(o):
    m = o.modifiers.new('Preserve flat face normals', 'WEIGHTED_NORMAL')
    m.keep_sharp = True
    m.weight = 50

def box(name, size, loc, material, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b = o.modifiers.new('Manufactured edge', 'BEVEL')
        b.width, b.segments, b.harden_normals = bevel, 3, True
        weighted(o)
    return o

def cylinder(name, radius, depth, loc, material, rotation=AXIS_Y, vertices=128):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    # Торцы плоские, сглаживается только боковая поверхность.
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return o

def lathe(name, profile, material, center_z=DOOR_Z, segments=192, closed=False):
    # Профиль (радиус, Y) вокруг оси Y без булевых артефактов на лицевой рамке.
    verts = [(r*math.cos(2*math.pi*j/segments), y, center_z+r*math.sin(2*math.pi*j/segments))
             for r,y in profile for j in range(segments)]
    faces = []
    for i in range(len(profile) if closed else len(profile)-1):
        ni = (i+1) % len(profile)
        for j in range(segments):
            nj = (j+1) % segments
            faces.append((i*segments+j, i*segments+nj, ni*segments+nj, ni*segments+j))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    mesh.materials.append(material)
    for p in mesh.polygons:
        p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=.000001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return o

def cut(o, cutter):
    b = o.modifiers.new('Real circular opening', 'BOOLEAN')
    b.operation, b.solver, b.object = 'DIFFERENCE', 'EXACT', cutter
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def rounded_panel(name, width, height, depth, radius, loc, material):
    # Радиус углов не ограничен толщиной панели, в отличие от bevel у куба.
    perimeter = []
    for cx,cz,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
        for step in range(9):
            a=math.radians(start+step*90/8)
            perimeter.append((cx*(width/2-radius)+radius*math.cos(a),
                              cz*(height/2-radius)+radius*math.sin(a)))
    count=len(perimeter)
    vertices=[(x,y,z) for y in (-depth/2,depth/2) for x,z in perimeter]
    faces=[tuple(range(count)),tuple(range(count*2-1,count-1,-1))]
    for i in range(count):
        j=(i+1)%count
        faces.append((i,count+i,count+j,j))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.location=loc
    mesh.materials.append(material)
    return obj

font_path = Path('C:/Windows/Fonts/segoeui.ttf')
font = bpy.data.fonts.load(str(font_path)) if font_path.exists() else None

def text_front(name, content, screen_x, z, size, material=ink, y=FRONT+.011):
    c = bpy.data.curves.new(name, 'FONT')
    c.body, c.size, c.align_x, c.resolution_u = content, size, 'LEFT', 4
    if font:
        c.font = font
    o = bpy.data.objects.new(name, c)
    scene.collection.objects.link(o)
    # При камере со стороны +Y экранное право соответствует мировому -X.
    o.rotation_euler = (math.pi/2, 0, math.pi)
    o.location = (-screen_x, y, z)
    c.materials.append(material)
    return o

# Полый корпус: стенки отдельно, передняя панель имеет настоящее отверстие.
for sign in (-1, 1):
    side=box('Side left' if sign>0 else 'Side right', (.012,D,H), (sign*(W/2-.006),0,FEET+H/2), silver, 0)
    for i in range(5):
        groove=rounded_panel('Side stamping cutter',.036,.704,.018,.018,
                             (sign*(W/2+.007),-.190+i*.090,FEET+.427),seam)
        groove.rotation_euler[2]=math.pi/2
        cut(side,groove)
    # Boolean переносит материал резака на внутренние грани — они тоже металл.
    for polygon in side.data.polygons:
        polygon.material_index = 0
    edge=side.modifiers.new('Soft stamped edges','BEVEL')
    edge.width,edge.segments,edge.harden_normals=.001,3,True
    weighted(side)
box('Top', (W,D,.014), (0,0,FEET+H-.007), silver, .004)
box('Rear', (W-.022,.008,H-.020), (0,-FRONT+.004,FEET+H/2), silver)
box('Base', (W-.024,D-.020,.012), (0,0,FEET+.006), seam)
front_h = H-PANEL_H-.008
front_plate = box('BodyFrontWithOpening', (W-.008,.014,front_h), (0,FRONT-.007,FEET+front_h/2), silver, 0)
cut(front_plate, cylinder('Opening cutter', .191,.12,(0,FRONT,DOOR_Z),seam))
b = front_plate.modifiers.new('Panel edge', 'BEVEL')
b.width,b.segments,b.harden_normals = .002,3,True
weighted(front_plate)

# Панель с лотком в левой трети, центральным переключателем и сенсорным управлением.
panel_z = FEET+H-.006-PANEL_H/2
box('TopPanel', (W-.008,.012,PANEL_H), (0,FRONT-.001,panel_z), black,.0015)
knob_z = panel_z+.005
cylinder('Knob surround', .039,.009,(0,FRONT+.006,knob_z),seam)
cylinder('Knob bevel', .035,.014,(0,FRONT+.016,knob_z),chrome)
knob_material = chrome.copy()
knob_material.name = 'Radially brushed knob'
knob_nodes = knob_material.node_tree.nodes
knob_tangent = knob_nodes.new('ShaderNodeTangent')
knob_tangent.direction_type, knob_tangent.axis = 'RADIAL', 'Z'
knob_shader = knob_nodes['Principled BSDF']
knob_shader.inputs['Anisotropic'].default_value = .8
knob_shader.inputs['Roughness'].default_value = .30
knob_material.node_tree.links.new(knob_tangent.outputs['Tangent'], knob_shader.inputs['Tangent'])
cylinder('Knob brushed face', .032,.0015,(0,FRONT+.024,knob_z),knob_material)
box('Knob indicator', (.002,.001,.005),(.015,FRONT+.026,knob_z+.027),ink,.0004)
box('Drawer boundary', (.211,.002,PANEL_H-.004),(.189,FRONT+.006,panel_z),seam,.0008)
box('Detergent drawer fascia',(.209,.002,PANEL_H-.006),(.189,FRONT+.0075,panel_z),black,.0008)
drawer_z = panel_z-.025
rounded_panel('Drawer grip recess',.139,.031,.001,.005,(.182,FRONT+.009,drawer_z),seam)
rounded_panel('Drawer inset handle',.125,.018,.001,.002,(.182,FRONT+.0095,drawer_z+.004),black)
text_front('Capacity mark','11 kg',-.138,drawer_z+.023,.007)
text_front('Brand mark','LG',-.263,panel_z+.025,.014)

# Объёмные LED-сегменты не зависят от UV-развёртки или внешнего display.png.
box('DisplayBack',(.162,.003,.060),(-.192,FRONT+.007,panel_z+.002),black,.001)
segments = {'1':'bc','2':'abged','6':'afgedc'}

def digit(value,x,z):
    w,h=.0075,.014
    points={'a':(0,h/2,True),'g':(0,0,True),'d':(0,-h/2,True),
            'f':(w/2,h/4,False),'b':(-w/2,h/4,False),'e':(w/2,-h/4,False),'c':(-w/2,-h/4,False)}
    for key in segments[value]:
        dx,dz,horizontal=points[key]
        size=(w-.0015,.0005,.00075) if horizontal else (.00075,.0005,h/2-.0015)
        box('LED segment '+value+key,size,(x+dx,FRONT+.010,z+dz),led,.0002)
for value,x in [('1',-.139),('2',-.154),('6',-.165)]:
    digit(value,x,panel_z+.010)
for dz in (-.0027,.0027):
    box('LED colon',(.001,.0005,.001),(-.146,FRONT+.010,panel_z+.010+dz),led,.0002)
for i,label in enumerate(['1400','800','400']):
    text_front('Spin setting',label,.204,panel_z+.024-i*.009,.0037,dim_ink)
for i,label in enumerate(['TurboWash','Интенсивная','Полоскание','Таймер']):
    text_front('Touch control',label,.228,panel_z+.024-i*.012,.0036,ink)
for i,label in enumerate(['Температура','Отжим','Опции']):
    text_front('Touch label',label,.135+i*.031,panel_z-.022,.0037,ink)
for x,labels in [(-.084,['Хлопок','Хлопок +','Смешанная','Повседневная','Шерсть','Спортивная']),
                 (.047,['AI Wash','TurboWash 39','Быстро 14','Гипоаллергенная','Деликатная','Моя программа'])]:
    for i,label in enumerate(labels):
        text_front('Program',label,x,panel_z+.034-i*.009,.0045,ink)
text_front('Power symbol','○',-.064,panel_z-.035,.010)
text_front('Start symbol','▷Ⅱ',.054,panel_z-.035,.010)

# Широкая гладкая чёрная рамка с тонкой внешней металлической кромкой.
lathe('Door outer hairline rim',[(.260,FRONT+.012),(.263,FRONT+.015),(.263,FRONT+.019),(.260,FRONT+.022)],chrome)
ring = lathe('DoorRingBlack',[(.259,FRONT+.013),(.260,FRONT+.017),(.258,FRONT+.021),
      (.254,FRONT+.022),(.249,FRONT+.022),(.181,FRONT+.022),
      (.174,FRONT+.018),(.168,FRONT+.008),(.169,FRONT-.001),(.176,FRONT-.003),(.250,FRONT+.005)],door_black,closed=True)
for polygon in ring.data.polygons:
    if abs(polygon.normal.y) > .9999:
        polygon.use_smooth = False
lathe('Dark glass retaining bead',[(.169,FRONT+.008),(.172,FRONT+.009),(.174,FRONT+.006),(.172,FRONT+.001),(.169,FRONT+.002)],rubber,closed=True)
lathe('Rubber bellows',[(.189,FRONT-.010),(.184,FRONT-.020),(.177,FRONT-.025),(.176,FRONT-.047),(.164,FRONT-.052),(.157,FRONT-.080)],rubber)
# Замкнутая тонкая линза с настоящим светопропусканием и толщиной 3 мм.
lathe('DoorGlass',[(0,FRONT+.005),(.040,FRONT+.005),(.090,FRONT+.004),(.135,FRONT+.001),
      (.160,FRONT-.008),(.169,FRONT-.017),(.169,FRONT-.020),(.160,FRONT-.011),
      (.135,FRONT-.002),(.090,FRONT+.001),(.040,FRONT+.002),(0,FRONT+.002)],glass,closed=True)
lathe('Drum inner wall',[(.155,FRONT-.075),(.159,FRONT-.090),(.164,FRONT-.200),(.153,FRONT-.245),(.123,FRONT-.255)],steel)
# Трёхлепестковая штамповка задней стенки задаётся объёмной сеткой.
rear_verts, rear_faces = [], []
rear_steps, rear_rings = 144, 24
for row in range(rear_rings+1):
    radius = max(.0001, .153*row/rear_rings)
    for col in range(rear_steps):
        a = 2*math.pi*col/rear_steps
        lobe = .030*math.exp(-((radius-.09)/.043)**2) * (.5+.5*math.cos(3*a-math.pi/2))
        rear_verts.append((radius*math.cos(a),FRONT-.247+lobe,DOOR_Z+radius*math.sin(a)))
for row in range(rear_rings):
    for col in range(rear_steps):
        n = (col+1)%rear_steps
        rear_faces.append((row*rear_steps+col,row*rear_steps+n,(row+1)*rear_steps+n,(row+1)*rear_steps+col))
rear_mesh = bpy.data.meshes.new('Stamped drum rear')
rear_mesh.from_pydata(rear_verts,[],rear_faces)
rear_mesh.update()
rear_object = bpy.data.objects.new('Stamped drum rear',rear_mesh)
scene.collection.objects.link(rear_object)
rear_mesh.materials.append(steel)
for polygon in rear_mesh.polygons:
    polygon.use_smooth = True
cylinder('Drum center hub',.024,.004,(0,FRONT-.239,DOOR_Z),rubber)
for i in range(3):
    angle=math.pi/2+i*2*math.pi/3
    lifter=box('Drum lifter',(.030,.145,.020),(.143*math.cos(angle),FRONT-.170,DOOR_Z+.143*math.sin(angle)),steel,.009)
    lifter.rotation_euler[1]=math.pi/2-angle
# Упрощённые углубления перфорации для видимой стенки барабана.
for row in range(4):
    for col in range(48):
        a=2*math.pi*(col+.5*(row%2))/48
        r=.159+.001*row
        dot=cylinder('Drum perforation',.0014,.0003,(r*math.cos(a),FRONT-.110-row*.029,DOOR_Z+r*math.sin(a)),seam,vertices=8)
        dot.rotation_euler=Vector((-math.cos(a),0,-math.sin(a))).to_track_quat('Z','Y').to_euler()
# Ручка скрыта в боковой кромке; на фасаде нет серебряной скобы.
box('Door edge grip',(.008,.012,.070),(-.252,FRONT+.002,DOOR_Z),door_black,.004)
flap_z=FEET+.070
rounded_panel('Service flap seam',.151,.109,.001,.010,(-.195,FRONT+.0005,flap_z),seam)
rounded_panel('Service flap',.148,.106,.001,.009,(-.195,FRONT+.001,flap_z),silver)
box('Service flap notch',(.019,.0003,.0008),(-.195,FRONT+.0017,flap_z+.045),chrome,.0002)
for sx in (-1,1):
    for sy in (-1,1):
        cylinder('Adjustable foot',.014,FEET,(sx*.275,sy*.245,FEET/2),rubber,rotation=(0,0,0),vertices=32)

# Нейтральная студия; брендовые цветные блики не подменяют цвет металла.
world=bpy.data.worlds.new('Neutral studio')
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.81,.85,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.10

def look_at(o,target):
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def area(name,loc,energy,width,height,target=(0,0,.45)):
    bpy.ops.object.light_add(type='AREA',location=loc)
    o=bpy.context.object
    o.name=name
    o.data.energy,o.data.shape,o.data.size,o.data.size_y=energy,'RECTANGLE',width,height
    look_at(o,target)
area('Key softbox',(1.25,1.45,1.65),130,.70,1.7)
area('Right reflection strip',(-1.0,1.15,1.10),65,.28,1.8)
area('Top edge',(0,-.3,1.9),140,1.0,.45)
area('Front fill off reflection axis',(0,2.5,2.3),18,1.4,1.0)

def camera(name,loc,target,scale):
    d=bpy.data.cameras.new(name)
    o=bpy.data.objects.new(name,d)
    scene.collection.objects.link(o)
    o.location=loc
    d.type,d.ortho_scale='ORTHO',scale
    look_at(o,target)
    return o
front_camera=camera('CamFront',(0,3.12,.425),(0,0,.425),1.00)
quarter_camera=camera('CamQuarter',(1.55,2.80,1.03),(0,0,.425),1.10)
door_camera=camera('CamDoorDetail',(.06,2.8,DOOR_Z+.04),(0,FRONT,DOOR_Z),.60)
panel_camera=camera('CamPanelDetail',(0,3.0,panel_z),(0,FRONT,panel_z),.65)

# Проверка видимости геометрии перед рендером.
bpy.context.view_layer.update()
hit,location,normal,index,obj,matrix=scene.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((0,2,DOOR_Z)),Vector((0,-1,0)))
assert hit and obj.name=='DoorGlass', 'Центр закрыт: '+(obj.name if obj else 'нет объекта')
assert location.y>FRONT, 'Стекло находится за передней панелью'
assert all(o.dimensions.x>0 and o.dimensions.z>0 for o in scene.objects if o.name.startswith('LED segment'))
evaluated_front = front_plate.evaluated_get(bpy.context.evaluated_depsgraph_get())
local_origin = evaluated_front.matrix_world.inverted() @ Vector((0,2,DOOR_Z))
assert not evaluated_front.ray_cast(local_origin, Vector((0,-1,0)))[0], 'В панели нет сквозного отверстия'
for groove_index in range(5):
    groove_hit = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector((2,-.190+groove_index*.090,FEET+.427)),Vector((-1,0,0)))
    assert groove_hit[0] and groove_hit[4].name=='Side left' and .297 < groove_hit[1].x < .299, 'Не сформирована неглубокая боковая штамповка'
print('CHECK: glass visible; front opening clear; LED area valid; side groove is recessed',flush=True)
scene.camera=front_camera
RENDER_DIR.mkdir(parents=True,exist_ok=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUT), compress=True)
if not CHECK_ONLY:
    views=[(front_camera,'_v7-front.png'),(quarter_camera,'_v7-quarter.png'),(door_camera,'_v7-door.png'),(panel_camera,'_v7-panel.png')] if QUICK else [(front_camera,'01-front.png'),(quarter_camera,'02-three-quarter.png')]
    for cam,filename in views:
        scene.camera=cam
        scene.render.resolution_y=300 if cam==panel_camera else scene.render.resolution_x
        scene.render.filepath=str(RENDER_DIR/filename)
        bpy.ops.render.render(write_still=True)
        print('RENDERED',filename,flush=True)
print('DONE',flush=True)
