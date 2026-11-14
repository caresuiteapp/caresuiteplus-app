"""Render the CareSuite Vitalwerte inline artwork with Blender 4.3 and Pillow.

From the repository root:
  blender -b -t 6 --python scripts/render-vital-measurement-artwork.py
  blender -b -t 6 --python scripts/render-vital-measurement-artwork.py -- pulse temperature

The illustrations depict instruments and measurement concepts. Their screens
carry symbols and units, never fictitious patient readings.
"""

import argparse
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/vital-measurement-artwork'
CATALOG = ROOT / 'src/lib/pflege/vitalCatalog.ts'

BLUE, TEAL, LILAC, RED, AMBER, INK, WHITE, SILVER = (
    '#2679e9', '#00a996', '#8663e5', '#e94d73', '#ee9638', '#17304f', '#e5f3ff', '#a8c6e2'
)
LIGHT_BLUE, LIGHT_TEAL, LIGHT_RED, DEEP = '#76d8ff', '#81f0d7', '#ff9ab1', '#0c1b34'
MEMO = {}


def srgb(channel):
    return channel / 12.92 if channel < .04045 else ((channel + .055) / 1.055) ** 2.4


def material(hex_color, roughness=.32, metal=.12, emissive=0):
    key = (hex_color, roughness, metal, emissive)
    if key not in MEMO:
        rgb = tuple(srgb(int(hex_color[i:i + 2], 16) / 255) for i in (1, 3, 5))
        m = bpy.data.materials.new(hex_color)
        m.diffuse_color = (*rgb, 1)
        m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*rgb, 1)
        b.inputs['Roughness'].default_value = roughness
        b.inputs['Metallic'].default_value = metal
        b.inputs['Coat Weight'].default_value = .22
        b.inputs['Emission Color'].default_value = (*rgb, 1)
        b.inputs['Emission Strength'].default_value = emissive
        MEMO[key] = m
    return MEMO[key]


def finish(obj, color, smooth=False, glow=0):
    obj.data.materials.append(material(color, emissive=glow))
    if smooth and isinstance(obj.data, bpy.types.Mesh):
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj


def box(point, size, color, bevel=.09, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_euler = rotation
    if bevel:
        mod = obj.modifiers.new('Soft edges', 'BEVEL')
        mod.width = min(bevel, min(size) * .42)
        mod.segments = 4
        mod.affect = 'EDGES'
        obj.modifiers.new('Weighted highlights', 'WEIGHTED_NORMAL')
    return finish(obj, color)


def orb(point, size, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, location=point)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, color, True)


def barrel(point, radius, depth, color, along='z', bevel=.042):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=depth, location=point)
    obj = bpy.context.object
    if along == 'y':
        obj.rotation_euler.x = math.pi / 2
    elif along == 'x':
        obj.rotation_euler.y = math.pi / 2
    mod = obj.modifiers.new('Rounded rim', 'BEVEL')
    mod.width = min(bevel, depth * .35)
    mod.segments = 3
    obj.modifiers.new('Weighted highlights', 'WEIGHTED_NORMAL')
    return finish(obj, color, True)


def line(points, color, radius=.041, closed=False, glow=0):
    curve = bpy.data.curves.new('Tubular mark', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.use_fill_caps = True
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, coord in zip(spline.points, points):
        p.co = (*coord, 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new('Tubular mark', curve)
    bpy.context.collection.objects.link(obj)
    return finish(obj, color, glow=glow)


def loop(center, radius, color, tube=.048, plane='front', start=0, stop=math.tau):
    x, y, z = center
    rx, ry = radius
    angles = [start + (stop - start) * step / 48 for step in range(49)]
    points = [(x+rx*math.cos(a), y, z+ry*math.sin(a)) if plane == 'front' else
              (x+rx*math.cos(a), y+ry*math.sin(a), z) for a in angles]
    return line(points, color, tube)


def arrow(start, end, color, radius=.055):
    a, b = Vector(start), Vector(end)
    direction = (b - a).normalized()
    side = Vector((direction.z, 0, -direction.x))
    if side.length < .05:
        side = Vector((1, 0, 0))
    head = .20
    line([a, b], color, radius)
    line([b - direction * head + side.normalized() * head * .65, b,
          b - direction * head - side.normalized() * head * .65], color, radius)


def mark(text, x, y, z, size, color=WHITE, top=False):
    data = bpy.data.curves.new('Instrument notation', 'FONT')
    data.body = text
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    data.size = size
    data.extrude = .013
    data.bevel_depth = .004
    obj = bpy.data.objects.new(text, data)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, y, z)
    if not top:
        obj.rotation_euler = Euler((math.pi / 2, 0, 0))
    return finish(obj, color, glow=.19 if color == WHITE else 0)


def monitor(color, label=None, wave=None, style='standard'):
    """Blank readout instrument: the shape of the trace is the icon."""
    size = 2.72 if style != 'strip' else 3.0
    height = 2.03 if style != 'strip' else 1.63
    z = .13 + height * .5
    box((0, .03, z), (size, .78, height), WHITE, .22)
    box((0, -.39, z), (size-.30, .15, height-.29), INK, .15)
    box((0, -.485, z+.03), (size-.47, .09, height-.48), DEEP, .11)
    box((0, .03, .12), (size*.75, .85, .15), color, .07)
    if wave:
        wave_draw(wave, y=-.55, center=z-.10, scale=1 if style!='strip' else .96, color=color)
    if label:
        mark(label, -.11, -.56, z+(.50 if wave else .07), .29 if wave else .64, WHITE)
    for i, col in enumerate([color, LIGHT_TEAL]):
        orb((size*.5-.34-i*.18, -.568, z-(height-.5)*.5+.12), (.058,.038,.058), col)
    return z


WAVES = {
    'pulse': [(-1,-.04),(-.72,-.04),(-.55,.10),(-.39,-.16),(-.20,.46),(-.05,-.32),(.12,-.05),(.44,-.05),(.60,.09),(.78,-.04),(1,-.04)],
    'arterial': [(-1,-.28),(-.76,-.17),(-.52,.41),(-.40,.29),(-.23,.08),(-.10,.16),(.20,-.19),(.42,-.10),(.63,.33),(.82,.10),(1,-.14)],
    'mean': [(-1,-.10),(-.80,.17),(-.68,.31),(-.48,-.19),(-.25,-.37),(-.07,-.02),(.15,.28),(.38,.08),(.68,-.24),(1,-.10)],
    'crest': [(-1,-.29),(-.78,-.16),(-.50,.34),(-.28,.47),(-.09,.36),(.16,.15),(.52,-.30),(1,-.30)],
    'plateau': [(-1,-.31),(-.75,-.31),(-.45,.34),(.29,.34),(.58,-.31),(1,-.31)],
    'capno': [(-1,-.28),(-.74,-.28),(-.54,-.16),(-.37,.21),(.39,.35),(.53,.34),(.67,-.28),(1,-.28)],
    'cycles': [(-1,-.20),(-.76,.25),(-.51,-.20),(-.26,.25),(-.01,-.20),(.25,.25),(.49,-.20),(.77,.25),(1,-.20)],
    'agitation': [(-1,-.20),(-.74,.24),(-.46,-.26),(-.20,.19),(.13,-.05),(.36,.03),(.64,.02),(1,.02)]
}


def wave_draw(key, y, center, scale=1, x=0, color=LIGHT_BLUE):
    line([(x+a*scale, y, center+b*scale) for a, b in WAVES[key]], color, .046*scale, glow=.28)


def dial(x, y, z, radius, color, pointer=True):
    barrel((x, y, z), radius, .48, WHITE, 'y')
    barrel((x, y-.254, z), radius*.84, .12, color, 'y')
    barrel((x, y-.33, z), radius*.69, .08, INK, 'y')
    loop((x, y-.387, z), (radius*.51,radius*.51), WHITE, .038, start=.21, stop=2.90)
    if pointer:
        line([(x,y-.41,z),(x+radius*.34,y-.41,z+radius*.29)], LIGHT_TEAL, .042)
        orb((x,y-.433,z), (.075,.045,.075), WHITE)


def vial(x, y, color, height=2.00, label=None, liquid=LIGHT_BLUE):
    barrel((x,y,height*.47), .40, height*.81, WHITE)
    barrel((x,y,height*.83), .43, height*.29, color)
    box((x,y-.381,height*.47), (.62,.10,height*.43), INK if label else liquid, .065)
    box((x,y-.438,height*.33), (.51,.065,height*.1), liquid, .032)
    if label:
        mark(label,x,y-.50,height*.5,.24 if len(label)<4 else .18)


def node_edge(a,b,color):
    a,b=Vector(a),Vector(b)
    pos=(a+b)/2
    bpy.ops.mesh.primitive_cylinder_add(vertices=18,radius=.094,depth=(b-a).length,location=pos)
    obj=bpy.context.object
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    finish(obj,color,True)


def molecule(points, edges, colors, radii=None):
    for i,j in edges:
        node_edge(points[i],points[j],SILVER)
    for i,(p,col) in enumerate(zip(points,colors)):
        radius=radii[i] if radii else .29
        orb(p,(radius,)*3,col)


def body(x=0, y=.02, size=1.0, color=LILAC):
    orb((x,y,1.92*size),(.30*size,.24*size,.34*size), color)
    orb((x,y,1.19*size),(.48*size,.25*size,.48*size), color)
    for side in [-1,1]:
        line([(x+.28*side*size,y,1.49*size),
              (x+.62*side*size,y,.99*size)], color,.119*size)
        line([(x+.20*side*size,y,.91*size),
              (x+.32*side*size,y,.32*size)], color,.139*size)


def heart(color=RED):
    """Solid, rounded sculpt of a heart silhouette."""
    n=80
    positions=[]
    for i in range(n):
        a=math.tau*i/n
        x=16*math.sin(a)**3
        y=13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a)
        positions.append((x*.061,y*.065+1.29))
    verts=[(x,d,z) for d in [-.26,.31] for x,z in positions]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh=bpy.data.meshes.new('Heart body'); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new('Heart body',mesh); bpy.context.collection.objects.link(obj)
    bev=obj.modifiers.new('Soft edges','BEVEL');bev.width=.12;bev.segments=5
    obj.modifiers.new('Weighted reflections','WEIGHTED_NORMAL')
    finish(obj,color)


def lungs(color=TEAL):
    for side in (-1,1):
        o=orb((side*.53,.08,1.16),(.51,.43,.85),color)
        o.rotation_euler.y=side*.22
        line([(0,-.19,2.30),(0,-.22,1.71),(side*.54,-.34,1.39),
              (side*.69,-.36,1.11)],LIGHT_TEAL,.077)
        line([(side*.56,-.33,1.38),(side*.32,-.37,.99)],LIGHT_TEAL,.051)


def brain():
    for side in (-1,1):
        for x,z,r in ((.39,1.66,.53),(.58,1.27,.48),(.43,.97,.39),(.20,1.40,.41)):
            orb((side*x,.10,z),(r,.51,r*.89),LILAC)
        line([(side*.23,-.43,1.86),(side*.47,-.44,1.70),
              (side*.31,-.47,1.50),(side*.57,-.46,1.30),(side*.36,-.45,1.10)],'#d9c7ff',.052)
    line([(0,-.43,1.85),(0,-.51,1.43),(0,-.45,1.04)],INK,.043)


def drop(x,y,z,color,size=1):
    ell=orb((x,y,z-.2*size),(.5*size,.31*size,.56*size),color)
    ell.rotation_euler.y=.06
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=.48*size,radius2=.015*size,
                                  depth=.73*size,location=(x,y,z+.27*size))
    tip=bpy.context.object
    b=tip.modifiers.new('Rounded tip','BEVEL');b.width=.10*size;b.segments=5
    finish(tip,color,True)


def icon(key):
    if key == 'blood_pressure':
        barrel((-.60,.11,1.00),.76,1.40,INK,'x',.065)
        barrel((-.05,.11,1.00),.78,.23,BLUE,'x')
        loop((-.89,-.45,1.10),(.59,.47),SILVER,.065)
        line([(0,.17,1.01),(.43,.05,.40),(1.09,-.21,.39),(1.14,-.35,.85)],INK,.087)
        dial(.91,-.23,1.16,.59,BLUE)
    elif key == 'pulse':
        heart()
        wave_draw('pulse',-.43,1.34,.86,color=WHITE)
    elif key == 'respiratory_rate':
        lungs()
        for i in (0,1):
            loop((-1.06,-.15,1.23),(.33+.16*i,.32+.15*i),LIGHT_TEAL,.035,start=2.33,stop=4.01)
            loop((1.08,-.15,1.23),(.33+.16*i,.32+.15*i),LIGHT_TEAL,.035,start=-.90,stop=.89)
    elif key == 'oxygen':
        box((0,.12,.53),(2.34,1.35,.66),BLUE,.26)
        box((-.08,-.22,.90),(1.75,.83,.40),INK,.18)
        box((-.06,.10,1.21),(2.13,.90,.42),WHITE,.19)
        box((-.08,.00,1.46),(1.44,.58,.10),DEEP,.12)
        mark('SpO₂',-.09,0,1.53,.33,top=True)
        orb((1.01,-.29,.95),(.23,.22,.23),LIGHT_BLUE)
    elif key == 'temperature':
        origin=(0,.00,1.16)
        box(origin,(2.68,.57,.62),WHITE,.20,rotation=(0,-.30,0))
        box((-.27,-.334,1.12),(.89,.14,.43),INK,.09,rotation=(0,-.30,0))
        mark('°C',-.25,-.43,1.12,.27)
        box((1.12,.015,1.53),(.63,.55,.57),AMBER,.19,rotation=(0,-.30,0))
        line([(-1.64,.08,.65),(-1.23,.04,.77)],RED,.075)
    elif key == 'weight':
        box((0,.05,.49),(2.64,2.16,.61),LILAC,.22)
        box((0,.03,.83),(2.40,1.96,.15),WHITE,.15)
        for x in (-.63,.63):
            box((x,-.27,.95),(.68,.72,.13),SILVER,.14)
        barrel((0,.54,.94),.35,.13,INK)
        loop((0,.54,1.015),(.25,.25),WHITE,.025,plane='top',start=.2,stop=2.9)
        line([(0,.54,1.03),(.13,.65,1.03)],LILAC,.036)
    elif key == 'height':
        box((-.52,.00,.12),(1.20,1.05,.24),LILAC,.13)
        box((-.53,.26,1.37),(.29,.33,2.66),WHITE,.09)
        for i in range(10):
            x1=-.54 if i%3==0 else -.50
            line([(x1,.076,.38+i*.21),(-.40,.076,.38+i*.21)],INK,.021)
        box((-.07,.10,2.09),(1.19,.46,.18),LILAC,.06)
        arrow((.76,-.10,.43),(.76,-.10,2.12),LILAC,.037)
    elif key == 'bmi':
        body(x=.36,size=1.03)
        box((-.63,.15,1.18),(.25,.23,1.84),WHITE,.065)
        for i in range(6):
            line([(-.73,-.01,.48+i*.26),(-.56,-.01,.48+i*.26)],INK,.023)
        box((.23,-.42,.67),(1.06,.19,.45),INK,.06)
        mark('BMI',.23,-.54,.67,.28)
    elif key == 'body_surface_area':
        body(y=.21,color='#6466e9')
        line([(-.93,-.26,.28),(-.93,-.26,2.42),(.93,-.26,2.42),(.93,-.26,.28)],LIGHT_BLUE,.063,closed=True)
        box((0,-.43,.46),(1.09,.24,.43),INK,.07)
        mark('m²',0,-.565,.46,.27)
    elif key == 'head_circumference':
        orb((0,.16,1.25),(.80,.70,.91),LILAC)
        orb((-.50,-.39,1.13),(.21,.22,.30),LILAC)
        orb((.49,-.38,.92),(.30,.31,.35),LILAC)
        loop((0,.08,1.41),(.88,.76),AMBER,.092,plane='top')
        for i in range(9):
            a=3.22+i*.31
            x,y=.882*math.cos(a),.08+.759*math.sin(a)
            line([(x,y,1.38),(x,y,1.51)],WHITE,.018)
        box((.72,-.36,1.34),(.39,.22,.23),INK,.09)
    elif key == 'blood_glucose':
        box((-.32,0,1.09),(1.53,.53,1.87),WHITE,.28)
        box((-.33,-.31,1.27),(1.15,.11,.78),INK,.12)
        mark('BZ',-.34,-.379,1.27,.43)
        box((-.32,0,2.15),(.40,.22,.44),SILVER,.07)
        drop(.73,-.20,1.42,RED,.80)
    elif key == 'blood_ketones':
        drop(-.63,.11,1.20,'#d953ad',.93)
        molecule([(.22,-.05,.66),(1.01,-.02,.99),(.58,-.08,1.70),(.82,-.04,2.10)],
                 [(0,1),(0,2),(2,3)],[LILAC,LIGHT_BLUE,WHITE,LILAC],[.30,.33,.29,.20])
    elif key == 'pain_score':
        dial(.06,.11,1.27,.98,AMBER)
        line([(-.91,-.55,1.56),(-.57,-.55,1.56),(-.72,-.55,1.16),(-.36,-.55,1.16),
              (-.74,-.55,.69),(-.63,-.55,1.04),(-.94,-.55,1.04),(-.91,-.55,1.56)],AMBER,.061,glow=.22)
    elif key == 'capillary_refill':
        box((-.57,.1,1.03),(.76,.66,1.80),'#f4a28f',.31)
        box((-.58,-.23,1.54),(.49,.17,.67),LIGHT_RED,.17)
        dial(.61,-.09,.96,.58,TEAL)
        box((.62,-.09,1.63),(.35,.33,.25),WHITE,.08)
        box((.64,-.09,1.77),(.24,.23,.12),TEAL,.06)
    elif key == 'urine_output':
        vial(-.13,.1,TEAL,1.98,liquid=AMBER)
        loop((.43,.04,1.12),(.54,.60),LIGHT_TEAL,.087,start=-1.35,stop=1.35)
        for i in range(3):
            line([(-.20,-.45,.83+i*.17),(.02,-.45,.83+i*.17)],INK,.028)
        drop(.67,-.18,.69,AMBER,.45)
    elif key == 'fluid_balance':
        vial(-.75,.09,TEAL,1.64,liquid=LIGHT_BLUE)
        vial(.75,.08,BLUE,1.64,liquid=LIGHT_TEAL)
        arrow((-.78,-.61,1.04),(.69,-.61,1.04),TEAL,.065)
        arrow((.69,-.61,.60),(-.78,-.61,.60),BLUE,.065)
    elif key == 'gcs':
        brain()
        for i,ch in enumerate('EVM'):
            x=(i-1)*.62
            box((x,-.26,.38),(.52,.35,.53),INK,.08)
            mark(ch,x,-.456,.38,.32)
    elif key == 'rass':
        monitor(LILAC,'RASS','agitation')
        box((1.42,-.22,1.08),(.16,.20,1.70),LILAC,.05)
        for i in range(5):
            box((1.61,-.24,.48+i*.30),(.22,.08,.068),SILVER,.02)
        orb((1.39,-.38,1.20),(.18,.11,.18),LIGHT_TEAL)
    elif key == 'pupils':
        for x,r in [(-.68,.23),(.68,.33)]:
            orb((x,.13,1.09),(.62,.30,.44),WHITE)
            orb((x,-.153,1.09),(r,.13,r),TEAL)
            orb((x,-.26,1.09),(r*.52,.070,r*.52),INK)
            orb((x-.06,-.31,1.16),(.072,.031,.073),WHITE)
        for x in (-.39,0,.39):
            line([(x*.48,-.16,1.99),(x,-.23,1.67)],LIGHT_BLUE,.040)
    elif key == 'arterial_pressure':
        monitor(RED,'ART','arterial')
        line([(-1.36,-.04,.43),(-1.63,-.20,.37),(-1.80,-.45,.53),(-1.62,-.68,.74),(-1.40,-.73,.78)],RED,.093)
        barrel((-1.52,-.73,.78),.147,.33,WHITE,'x')
    elif key == 'map':
        z=monitor(BLUE,'MAP','mean','strip')
        for i in range(6):
            x=-.93+i*.34
            line([(x,-.58,z-.14),(x+.18,-.58,z-.14)],WHITE,.027)
    elif key == 'cvp':
        vial(-.65,.08,BLUE,2.34,'ZVD',LIGHT_BLUE)
        line([(-.65,.08,2.35),(.08,.08,2.35),(.75,-.15,1.68),(.76,-.30,.97)],BLUE,.091)
        box((.75,-.30,.63),(.50,.46,.60),WHITE,.13)
        loop((.75,-.556,.64),(.14,.17),LIGHT_BLUE,.05)
    elif key == 'cardiac_output':
        heart('#d53456')
        arrow((-.56,-.49,.78),(.77,-.49,1.76),LIGHT_BLUE,.095)
        arrow((-.83,-.49,.72),(.66,-.49,1.29),WHITE,.051)
    elif key == 'cardiac_index':
        heart(RED)
        line([(-.91,-.43,.72),(-.91,-.43,1.99)],WHITE,.041)
        line([(.89,-.43,.72),(.89,-.43,1.99)],WHITE,.041)
        arrow((-.76,-.47,1.35),(.74,-.47,1.35),LIGHT_BLUE,.071)
        box((0,-.42,.55),(.83,.19,.42),INK,.08)
        mark('HI',0,-.53,.55,.29)
    elif key == 'svv':
        monitor(RED,'SVV')
        for i,h in enumerate([.27,.56,.38,.69,.28]):
            x=-.64+i*.31
            box((x,-.59,.67+h*.5),(.15,.10,h),RED if i%2 else LIGHT_RED,.047)
    elif key == 'icp':
        brain()
        dial(.43,-.52,.65,.49,LILAC)
        mark('ICP',-.58,-.44,.53,.30,INK)
    elif key == 'cpp':
        brain()
        arrow((-.84,-.63,.65),(.13,-.63,1.63),RED,.054)
        arrow((.15,-.57,1.39),(.84,-.57,.58),LIGHT_BLUE,.054)
        box((0,-.45,.41),(1.02,.22,.42),INK,.08)
        mark('CPP',0,-.58,.41,.26)
    elif key == 'etco2':
        monitor(TEAL,'etCO₂','capno')
        box((1.08,-.50,.71),(.39,.26,.39),LIGHT_TEAL,.10)
        orb((1.09,-.658,.72),(.09,.055,.09),INK)
    elif key == 'oxygen_flow':
        vial(.20,.07,TEAL,2.40,'O₂')
        line([(.20,0,.39),(-.45,-.03,.27),(-.94,-.36,.56),(-.89,-.48,1.17)],BLUE,.12)
        arrow((1.01,-.30,.46),(1.01,-.30,1.89),LIGHT_TEAL,.062)
    elif key == 'fio2':
        monitor(BLUE,'FiO₂')
        box((-.61,-.587,.72),(.83,.09,.23),TEAL,.06)
        box((.21,-.587,.72),(.81,.09,.23),LIGHT_BLUE,.06)
        box((-.21,-.67,.72),(.074,.08,.26),WHITE,.022)
    elif key == 'peep':
        barrel((0,.13,.30),.71,.54,TEAL)
        box((0,.10,1.96),(1.31,1.05,.34),WHITE,.12)
        points=[(.39*math.cos(i*.23),.1+.39*math.sin(i*.23),.60+i*.014) for i in range(86)]
        line(points,BLUE,.072)
        arrow((1.03,-.19,.52),(1.03,-.19,1.74),LIGHT_BLUE,.055)
        mark('PEEP',0,-.48,1.96,.24,INK)
    elif key == 'tidal_volume':
        lungs()
        arrow((-.09,-.57,.68),(-.89,-.57,.68),WHITE,.066)
        arrow((.09,-.57,.68),(.89,-.57,.68),WHITE,.066)
    elif key == 'minute_ventilation':
        lungs('#12768a')
        dial(.59,-.43,.94,.58,TEAL)
        box((.60,-.43,1.60),(.29,.29,.25),WHITE,.07)
    elif key == 'peak_airway_pressure':
        z=monitor(TEAL,'Ppeak','crest')
        orb((-.28,-.60,z+.37),(.11,.047,.11),AMBER)
    elif key == 'plateau_pressure':
        z=monitor(TEAL,'Pplat','plateau')
        line([(-.45,-.592,z+.24),(.28,-.592,z+.24)],LIGHT_TEAL,.075,glow=.28)
    elif key == 'ventilator_rate':
        monitor(TEAL,'AF','cycles')
        for pos in (-.66,0,.66):
            box((pos,.04,.12),(.42,.47,.15),LIGHT_TEAL,.07)
    elif key == 'ph':
        vial(-.48,.12,LILAC,2.16,'pH',LIGHT_TEAL)
        box((.58,-.20,1.28),(.51,.23,1.70),WHITE,.08,rotation=(0,.21,0))
        for i,col in enumerate([AMBER,RED,LILAC,TEAL]):
            box((.48+i*.055,-.34,.78+i*.27),(.35,.11,.23),col,.061,rotation=(0,.21,0))
    elif key == 'pco2':
        vial(-.69,.18,LILAC,1.93,'pCO₂',LIGHT_RED)
        pts=[(.03,-.25,.78),(.62,-.28,1.23),(1.20,-.24,1.68)]
        molecule(pts,[(0,1),(1,2)],[RED,INK,RED])
    elif key == 'po2':
        vial(-.56,.10,BLUE,2.09,'pO₂',LIGHT_BLUE)
        molecule([(.42,-.20,.81),(1.02,-.23,1.29)],[(0,1)],[LIGHT_BLUE,BLUE],[.39,.48])
    elif key == 'bicarbonate':
        vial(-.58,.13,LILAC,2.09,'HCO₃',LIGHT_TEAL)
        pts=[(.57,-.08,1.19),(.38,-.13,.64),(1.16,-.20,1.09),(.70,-.16,1.81)]
        molecule(pts,[(0,1),(0,2),(0,3)],[INK,TEAL,LIGHT_TEAL,WHITE],[.24,.26,.28,.29])
    elif key == 'base_excess':
        vial(-.61,.11,LILAC,2.00,'BE',LIGHT_BLUE)
        dial(.70,-.18,1.34,.63,LILAC,False)
        mark('±',.70,-.60,1.35,.69)
    elif key == 'lactate':
        vial(-.53,.07,LILAC,2.10,'LAC',LIGHT_RED)
        pts=[(.17,-.18,.65),(.52,-.20,1.04),(.90,-.16,1.39),(1.17,-.10,1.79),(.91,-.11,.88)]
        molecule(pts,[(0,1),(1,2),(2,3),(2,4)],[RED,WHITE,INK,TEAL,RED],[.24,.28,.28,.29,.23])
    else:
        raise ValueError(f'Missing motif: {key}')


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z','Y').to_euler()


def prepare(size, samples):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 48
    scene.render.film_transparent = True
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.45,.55,.72,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .36
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .30
    target = (0, 0, 1)
    bpy.ops.object.camera_add(location=(3.12,-8.10,5.80))
    camera=bpy.context.object
    camera.data.type='ORTHO'
    aim(camera,target)
    scene.camera = camera
    for name, loc, power, size, color in [
        ('Warm key',(-3.5,-4.5,7),500,4.5,(.95,.96,1)),
        ('Cool fill',(4.7,-2.2,4.2),370,4.0,(.70,.87,1)),
        ('White rim',(-.3,4.1,4.5),570,3.7,(.77,.94,1)),
    ]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
        obj=bpy.data.objects.new(name,d);obj.location=loc
        bpy.context.collection.objects.link(obj);aim(obj,target)
    return scene, camera


def frame(camera, objects):
    bpy.context.view_layer.update()
    rot=camera.rotation_euler.to_matrix()
    inv=rot.transposed()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    projected=[]
    for original in objects:
        obj=original.evaluated_get(depsgraph)
        mesh=obj.to_mesh()
        matrix=inv @ obj.matrix_world.to_3x3()
        location=inv @ obj.location
        projected.extend(matrix @ vertex.co + location for vertex in mesh.vertices)
        obj.to_mesh_clear()
    pmin=[min(p[i] for p in projected) for i in (0,1)]
    pmax=[max(p[i] for p in projected) for i in (0,1)]
    center=[(a+b)*.5 for a,b in zip(pmin,pmax)]
    camera.data.ortho_scale=max(b-a for a,b in zip(pmin,pmax))*1.22
    forward=(inv@camera.location).z
    camera.location=rot@Vector((*center,forward))


def pack_png(path):
    """Keep transparent, anti-aliased edges without mobile download overhead."""
    with Image.open(path) as rgba:
        packed=rgba.convert('RGBA').quantize(colors=256,method=Image.Quantize.FASTOCTREE,
                                              dither=Image.Dither.NONE)
    # Discard render paths/timestamps and other metadata from the final assets.
    packed.info.clear()
    packed.save(path,optimize=True)


def main():
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument('keys',nargs='*')
    parser.add_argument('--size',type=int,default=256)
    parser.add_argument('--samples',type=int,default=40)
    parser.add_argument('--output',type=Path,default=OUT)
    args=parser.parse_args(argv)
    keys=re.findall(r"^  \{ key: '([^']+)', category:",CATALOG.read_text(),re.MULTILINE)
    if not keys or len(set(keys))!=len(keys) or any(key not in keys for key in args.keys):
        parser.error('Unknown or duplicate Vitalwerte keys.')
    args.output.mkdir(parents=True,exist_ok=True)
    scene,camera=prepare(args.size,args.samples)
    rig=set(bpy.context.scene.objects)
    objects=[]
    for key in args.keys or keys:
        for obj in objects:
            bpy.data.objects.remove(obj,do_unlink=True)
        icon(key)
        objects=[ob for ob in bpy.context.scene.objects if ob not in rig]
        frame(camera,objects)
        path=args.output/f'{key}.png'
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        pack_png(path)
        print(f'VITAL_ARTWORK {key}',flush=True)


if __name__=='__main__':
    main()
