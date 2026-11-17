# スマホでMR体験（HCI講義 第12回 演習）

学生が自分のスマホで仮想物体を机に置き、ARの位置合わせ・遮蔽・認識の限界・大きさを確かめて記録するための Web アプリ。
ビルド不要の静的サイトで、GitHub Pages にそのまま置ける。外部サーバや CDN への通信はなく、学生の入力は各自の端末内にだけ保存される。

## 構成

```
index.html              ページ本体
css/style.css           見た目
js/config.js            文言・設問・モデルの設定（内容を変えるときはここだけ編集）
js/app.js               動作
vendor/model-viewer.min.js   3D表示とAR起動のライブラリ（Google <model-viewer> 4.4.0、同梱）
models/*.glb            仮想物体（10cm立方体、マグカップ、ロボット）
tools/make_models.py    上の3つのモデルを生成するスクリプト
.nojekyll               GitHub Pages でファイルをそのまま配信させるための空ファイル
```

## ローカルで動かす

`index.html` をダブルクリックで開くと動かない（ブラウザがモデルの読み込みを止める）。必ず簡易サーバ経由で開く。

```
cd mr-experience
python3 -m http.server 8000
```

ブラウザで http://localhost:8000/ を開く。

PC で確認できるのは、3D表示、モデルの切り替え、設問の入力と保存、提出テキストのコピーまで。
**AR の起動はスマホ実機と https が必要**なので、PC では「PCではARを起動できない」と表示される。これは正常。
スマホ実機での AR の確認は、下の手順で GitHub Pages に置いてから行うのが最も簡単。

## GitHub Pages に置く

1. GitHub でリポジトリを作る（公開リポジトリ。例: `mr-experience`）。
2. このフォルダの中身をすべてリポジトリの直下に push する（`.nojekyll` も忘れずに）。
3. リポジトリの Settings → Pages → Build and deployment で、Source を「Deploy from a branch」、Branch を `main` の `/ (root)` にして保存する。
4. 1〜2分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される。

パスはすべて相対指定なので、リポジトリ名やサブフォルダ（`/docs` など）が変わっても修正は要らない。

## 授業前の実機チェック

公開URLをスマホで開き、次を確かめる。iPhone と Android の両方で試せると安心。

- [ ] 「カメラを起動して机に置く」ボタンが出る
- [ ] ボタンを押すとカメラが起動し、机の上に物体が置ける
- [ ] 10cm立方体が、実物の定規と比べておおよそ10cmに見える
- [ ] ARを閉じてページに戻ったとき、入力済みの回答が残っている
- [ ] 「回答をコピーする」で manaba に貼り付けられる
- [ ] 教室の机・照明で平面が認識される（白い無地の机は認識しにくい）

AR の起動方式は端末によって変わる。

| 端末 | 方式 | 補足 |
|---|---|---|
| iPhone / iPad（Safari） | AR Quick Look | GLB から USDZ をその場で自動変換して起動する |
| Android（Chrome） | WebXR、使えなければ Scene Viewer | 「Google Play 開発者サービス（AR）」が必要。未導入だと導入を促される |
| 上記以外 | 非対応 | ページが代替の案内を表示する |

LINE など、アプリ内ブラウザで QR を開くと AR が起動しないことがある。学生には Safari / Chrome で開くよう伝える。

## 内容を変える

`js/config.js` を編集する。

- `fallbackVideoUrl`: AR 非対応の学生に見せるデモ映像の URL。入れるとページにリンクが出る。
- `observations` / `classifications` / `reflection`: 設問と選択肢。
- `models`: 置ける物体。別の GLB を `models/` に置いて `file` を書き換えれば差し替えられる。
  実寸で表示されるので、GLB はメートル単位・底面が y=0 で作る。
- `arModes`: AR の起動方式の優先順。Android で動作が不安定なら `"scene-viewer webxr quick-look"` に変えると Google 製ビューアが優先される。

設問の `id` を変えると、学生の端末に残っている古い回答とは対応しなくなる（害はない）。

## ライセンス

`vendor/model-viewer.min.js` は Google の `<model-viewer>`（Apache License 2.0）。ライセンス文は `vendor/LICENSE-model-viewer.txt`。
3Dモデルは `tools/make_models.py` で生成した自作のもの。
