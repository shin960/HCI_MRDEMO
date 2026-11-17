"""外部で作ったテディータの GLB を、MR体験ページ用に整えるスクリプト。

    pip install pillow
    python tools/prepare_teddyta.py 元のファイル.glb

行うこと:
  - 高さが TARGET_HEIGHT (メートル) になるように縮尺を合わせる (ARでは実寸で表示されるため)
  - 底面を y=0 に、左右・前後の中心を原点に合わせる
  - 大きな PNG テクスチャを縮小して JPEG にし、ファイルを軽くする
形状・UV・マテリアルの設定には手を加えない。結果は models/teddyta.glb に書き出す。
"""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

TARGET_HEIGHT = 0.25      # 机に置いたときの高さ [m]
MAX_TEXTURE = 2048        # テクスチャの一辺の上限 [px]
JPEG_QUALITY = 90
OUT = Path(__file__).resolve().parent.parent / "models" / "teddyta.glb"


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, _ = struct.unpack("<4sII", data[:12])
    assert magic == b"glTF" and version == 2, "glTF 2.0 のバイナリ (.glb) ではない"
    jlen, _ = struct.unpack("<I4s", data[12:20])
    gltf = json.loads(data[20:20 + jlen])
    off = 20 + jlen
    blen, _ = struct.unpack("<I4s", data[off:off + 8])
    return gltf, data[off + 8:off + 8 + blen]


def write_glb(path, gltf, views):
    """views: bufferView ごとのバイト列。4バイト境界にそろえて詰め直す。"""
    blob = bytearray()
    for view, raw in zip(gltf["bufferViews"], views):
        while len(blob) % 4:
            blob.append(0)
        view["byteOffset"] = len(blob)
        view["byteLength"] = len(raw)
        view["buffer"] = 0
        blob += raw
    while len(blob) % 4:
        blob.append(0)
    gltf["buffers"] = [{"byteLength": len(blob)}]
    js = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(blob), b"BIN\x00"))
        f.write(blob)
    return total


def shrink_image(raw):
    img = Image.open(io.BytesIO(raw))
    before = img.size
    has_alpha = img.mode in ("RGBA", "LA") and img.getchannel("A").getextrema()[0] < 255
    if max(img.size) > MAX_TEXTURE:
        img.thumbnail((MAX_TEXTURE, MAX_TEXTURE), Image.LANCZOS)
    buf = io.BytesIO()
    if has_alpha:                       # 透明部分があるものは PNG のまま
        img.save(buf, format="PNG", optimize=True)
        mime = "image/png"
    else:
        img.convert("RGB").save(buf, format="JPEG", quality=JPEG_QUALITY, subsampling=0)
        mime = "image/jpeg"
    out = buf.getvalue()
    if len(out) >= len(raw):            # 小さくならないなら元のまま
        return raw, None, before, before
    return out, mime, before, img.size


def main(src):
    gltf, bin_chunk = read_glb(src)
    assert len(gltf.get("buffers", [])) == 1, "バッファが1つの GLB だけに対応"
    views = [bin_chunk[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
             for v in gltf["bufferViews"]]

    for image in gltf.get("images", []):
        if "bufferView" not in image:
            continue
        i = image["bufferView"]
        new, mime, before, after = shrink_image(views[i])
        print(f"テクスチャ {image.get('name', i)}: {before[0]}x{before[1]} {len(views[i])/1e6:.2f}MB"
              f" -> {after[0]}x{after[1]} {len(new)/1e6:.2f}MB")
        views[i] = new
        if mime:
            image["mimeType"] = mime

    # 全メッシュの範囲 (ノードに変換がかかっていない単純な構成を前提にする)
    lo, hi = [1e9] * 3, [-1e9] * 3
    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            acc = gltf["accessors"][prim["attributes"]["POSITION"]]
            lo = [min(a, b) for a, b in zip(lo, acc["min"])]
            hi = [max(a, b) for a, b in zip(hi, acc["max"])]
    roots = gltf["scenes"][gltf.get("scene", 0)]["nodes"]
    for n in roots:
        node = gltf["nodes"][n]
        assert not any(k in node for k in ("matrix", "scale", "translation", "rotation")), \
            "ルートノードに変換がある GLB には未対応"
    s = TARGET_HEIGHT / (hi[1] - lo[1])
    shift = [-(lo[0] + hi[0]) / 2 * s, -lo[1] * s, -(lo[2] + hi[2]) / 2 * s]
    gltf["nodes"].append({"name": "Teddyta", "children": roots, "scale": [s, s, s], "translation": shift})
    gltf["scenes"][gltf.get("scene", 0)]["nodes"] = [len(gltf["nodes"]) - 1]

    total = write_glb(OUT, gltf, views)
    size = [(h - l) * s * 100 for l, h in zip(lo, hi)]
    print(f"縮尺 {s:.4f} 倍 -> 幅{size[0]:.1f} x 高さ{size[1]:.1f} x 奥行{size[2]:.1f} cm")
    print(f"{OUT.name}: {total/1e6:.2f} MB (元は {Path(src).stat().st_size/1e6:.2f} MB)")


if __name__ == "__main__":
    main(sys.argv[1])
