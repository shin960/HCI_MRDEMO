"""MR体験ページ用の3Dモデル(GLB)を生成するスクリプト。

    pip install trimesh pillow numpy
    python tools/make_models.py

models/ に cube10cm.glb, mug.glb, robot.glb を書き出す。
単位はメートル、Y軸が上、底面が y=0 (机に接する面) になるように作っている。
モデルを差し替えたいときは、このスクリプトを直すか、任意の GLB を models/ に置いて
js/app.js の MODELS を書き換える。
"""
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

OUT = Path(__file__).resolve().parent.parent / "models"

# 作図は Z-up で行い、最後に Y-up (glTF の規約) に回す
Z_UP_TO_Y_UP = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])


def colored(mesh, rgb, rough=0.6, metal=0.0):
    mat = PBRMaterial(
        baseColorFactor=[rgb[0], rgb[1], rgb[2], 255],
        roughnessFactor=rough,
        metallicFactor=metal,
    )
    mesh.visual = TextureVisuals(material=mat)
    return mesh


def export(meshes, name):
    scene = trimesh.Scene()
    for i, m in enumerate(meshes):
        m = m.copy()
        m.apply_transform(Z_UP_TO_Y_UP)
        scene.add_geometry(m, node_name=f"{name}_{i}", geom_name=f"{name}_{i}")
    path = OUT / f"{name}.glb"
    path.write_bytes(scene.export(file_type="glb"))
    lo, hi = scene.bounds
    size = (hi - lo) * 100
    print(f"{path.name}: {path.stat().st_size/1024:.0f} KB, "
          f"幅{size[0]:.1f} x 高さ{size[1]:.1f} x 奥行{size[2]:.1f} cm, 底面 y={lo[1]*100:.2f} cm")


# ---------------------------------------------------------------- 10cm 立方体
def cube_texture(px=1024):
    img = Image.new("RGB", (px, px), (250, 247, 240))
    d = ImageDraw.Draw(img)
    step = px / 10
    for i in range(11):
        w = 6 if i in (0, 5, 10) else 2
        col = (40, 90, 160) if i in (0, 5, 10) else (150, 170, 200)
        p = round(i * step)
        d.line([(p, 0), (p, px)], fill=col, width=w)
        d.line([(0, p), (px, p)], fill=col, width=w)
    d.rectangle([0, 0, px - 1, px - 1], outline=(200, 60, 50), width=18)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(px * 0.16))
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(px * 0.055))
    text = "10 cm"
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    cx, cy = px / 2, px / 2
    pad = px * 0.04
    d.rectangle([cx - tw / 2 - pad, cy - th / 2 - pad, cx + tw / 2 + pad, cy + th / 2 + pad],
                fill=(250, 247, 240))
    d.text((cx - tw / 2 - box[0], cy - th / 2 - box[1]), text, font=font, fill=(200, 60, 50))
    note = "1 grid = 1 cm"
    nb = d.textbbox((0, 0), note, font=small)
    nw = nb[2] - nb[0]
    d.rectangle([cx - nw / 2 - 10, px * 0.72 - 6, cx + nw / 2 + 10, px * 0.72 + (nb[3] - nb[1]) + 14],
                fill=(250, 247, 240))
    d.text((cx - nw / 2 - nb[0], px * 0.72 - nb[1]), note, font=small, fill=(40, 90, 160))
    return img


def make_cube(edge=0.10):
    h = edge / 2
    # 各面を (原点, u方向, v方向) で定義。法線 = u x v が外向きになるように並べる
    faces = [
        ([-h, -h, edge], [edge, 0, 0], [0, edge, 0]),   # 上 (+z)
        ([-h, h, 0], [edge, 0, 0], [0, -edge, 0]),      # 下 (-z)
        ([-h, -h, 0], [edge, 0, 0], [0, 0, edge]),      # 手前 (-y)
        ([h, h, 0], [-edge, 0, 0], [0, 0, edge]),       # 奥 (+y)
        ([h, -h, 0], [0, edge, 0], [0, 0, edge]),       # 右 (+x)
        ([-h, h, 0], [0, -edge, 0], [0, 0, edge]),      # 左 (-x)
    ]
    verts, uvs, tris = [], [], []
    for o, u, v in faces:
        o, u, v = map(np.array, (o, u, v))
        base = len(verts)
        verts += [o, o + u, o + u + v, o + v]
        uvs += [[0, 0], [1, 0], [1, 1], [0, 1]]
        tris += [[base, base + 1, base + 2], [base, base + 2, base + 3]]
    mesh = trimesh.Trimesh(vertices=np.array(verts, float), faces=np.array(tris), process=False)
    mat = PBRMaterial(baseColorTexture=cube_texture(), roughnessFactor=0.7, metallicFactor=0.0)
    mesh.visual = TextureVisuals(uv=np.array(uvs, float), material=mat)
    return [mesh]


# ---------------------------------------------------------------- マグカップ
def arc_tube(center, major, minor, a0, a1, seg=40, ring=16):
    """x-z 平面上の円弧に沿ったチューブ (取っ手用)。"""
    verts, faces = [], []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        c = np.array([center[0] + major * np.cos(a), center[1], center[2] + major * np.sin(a)])
        radial = np.array([np.cos(a), 0, np.sin(a)])
        side = np.array([0, 1, 0])
        for j in range(ring):
            b = 2 * np.pi * j / ring
            verts.append(c + minor * (np.cos(b) * radial + np.sin(b) * side))
    for i in range(seg):
        for j in range(ring):
            p0 = i * ring + j
            p1 = i * ring + (j + 1) % ring
            p2 = p0 + ring
            p3 = p1 + ring
            faces += [[p0, p2, p1], [p1, p2, p3]]
    m = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    m.fix_normals()
    return m


def make_mug(R=0.040, r=0.036, H=0.092, t=0.006):
    profile = np.array([[0, 0], [R - 0.003, 0], [R, 0.003], [R, H - 0.001], [R - 0.002, H],
                        [r, H - 0.001], [r, t], [0, t]])
    body = trimesh.creation.revolve(profile, sections=64)
    body.fix_normals()
    handle = arc_tube(center=(R - 0.002, 0, H * 0.5), major=0.027, minor=0.0055,
                      a0=-np.pi / 2, a1=np.pi / 2)
    coffee = trimesh.creation.cylinder(radius=r - 0.0002, height=0.002, sections=64)
    coffee.apply_translation([0, 0, H - 0.014])
    return [colored(body, (236, 108, 76), rough=0.35),
            colored(handle, (236, 108, 76), rough=0.35),
            colored(coffee, (70, 42, 26), rough=0.2)]


# ---------------------------------------------------------------- ロボット
def box(size, pos, rgb, **kw):
    m = trimesh.creation.box(extents=size)
    m.apply_translation(pos)
    return colored(m, rgb, **kw)


def cyl(radius, height, pos, rgb, **kw):
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=32)
    m.apply_translation(pos)
    return colored(m, rgb, **kw)


def ball(radius, pos, rgb, **kw):
    m = trimesh.creation.icosphere(subdivisions=3, radius=radius)
    m.apply_translation(pos)
    return colored(m, rgb, **kw)


def make_robot():
    teal, dark, light, red, yellow = (38, 150, 160), (45, 55, 70), (240, 240, 235), (220, 70, 60), (245, 190, 60)
    parts = []
    # 足 (底面 z=0)
    for sx in (-1, 1):
        parts.append(box([0.028, 0.040, 0.012], [sx * 0.020, -0.004, 0.006], dark))
        parts.append(cyl(0.009, 0.030, [sx * 0.020, 0, 0.027], dark))
    # 胴体
    parts.append(box([0.074, 0.050, 0.064], [0, 0, 0.074], teal, rough=0.45))
    parts.append(box([0.040, 0.004, 0.024], [0, -0.027, 0.078], light))          # 胸パネル
    parts.append(ball(0.0045, [-0.010, -0.030, 0.080], red))
    parts.append(ball(0.0045, [0.002, -0.030, 0.080], yellow))
    # 腕
    for sx in (-1, 1):
        parts.append(ball(0.011, [sx * 0.046, 0, 0.094], dark))
        parts.append(cyl(0.007, 0.044, [sx * 0.050, 0, 0.070], dark))
        parts.append(ball(0.010, [sx * 0.050, 0, 0.046], yellow))
    # 首と頭
    parts.append(cyl(0.010, 0.010, [0, 0, 0.111], dark))
    parts.append(box([0.062, 0.050, 0.046], [0, 0, 0.139], teal, rough=0.45))
    parts.append(box([0.050, 0.004, 0.024], [0, -0.027, 0.141], dark))           # 顔のバイザー
    for sx in (-1, 1):
        parts.append(ball(0.0065, [sx * 0.012, -0.029, 0.142], light, rough=0.2))
    # アンテナ
    parts.append(cyl(0.0025, 0.022, [0, 0, 0.173], dark))
    parts.append(ball(0.007, [0, 0, 0.188], red, rough=0.3))
    return parts


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    export(make_cube(), "cube10cm")
    export(make_mug(), "mug")
    export(make_robot(), "robot")
