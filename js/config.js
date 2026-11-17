/*
 * MR体験ページの設定ファイル。
 * 文言・設問・モデルを変えたいときは、このファイルだけを編集すればよい。
 */
window.MR_CONFIG = {
  // ページ見出し
  title: "スマホでMR体験",
  lecture: "ヒューマンコンピュータインタラクション 第12回 演習",

  // ARに対応しない機種の学生向けの代替映像 (YouTubeなどのURL)。空文字なら案内文だけ表示する。
  fallbackVideoUrl: "",

  // ARの起動方式の優先順。左から順に、その端末で使える最初の方式が選ばれる。
  //   webxr        … Android の Chrome 内でそのままARを表示
  //   scene-viewer … Android の Google 製ARビューアを起動
  //   quick-look   … iPhone / iPad の AR Quick Look を起動
  arModes: "webxr scene-viewer quick-look",

  // 置ける仮想物体。file は models/ からの相対パス。
  models: [
    {
      id: "cube",
      name: "10cm立方体",
      file: "models/cube10cm.glb",
      note: "1辺がちょうど10cm、目盛りは1cm刻み。観察4（大きさ）ではこれを使う。",
    },
    {
      id: "mug",
      name: "マグカップ",
      file: "models/mug.glb",
      note: "高さ約9cm。机の上にあって自然に見えるかを確かめやすい。",
    },
    {
      id: "robot",
      name: "ロボット",
      file: "models/robot.glb",
      note: "高さ約19cm。周りを回り込んで、前後左右から見てみよう。",
    },
  ],

  // 手順2: 観察。choices から1つ選び、気づいたことを一言書く。
  observations: [
    {
      id: "registration",
      title: "位置合わせ",
      task: "物体を机に置いたら、スマホを持ったまま物体の周りを半周する。",
      question: "物体は置いた場所に留まっていたか?",
      choices: ["ずれなかった", "少しずれた・揺れた", "大きくずれた・滑った"],
    },
    {
      id: "occlusion",
      title: "遮蔽（前後関係）",
      task: "スマホと物体の間に自分の手を入れて、物体の手前にかざす。",
      question: "手と物体の前後関係は正しく描かれたか?",
      choices: ["手が物体を隠した", "物体が手の上に描かれた", "場所や動きによって変わった"],
    },
    {
      id: "recognition",
      title: "認識の限界",
      task: "無地の白い紙の上や、机の下などの暗い場所に物体を置こうとしてみる。",
      question: "模様のない面や暗い場所でも置けたか?",
      choices: ["問題なく置けた", "時間がかかった・不安定だった", "置けなかった"],
    },
    {
      id: "scale",
      title: "大きさ",
      task: "「10cm立方体」を置き、実物のペンや定規を横に並べて比べる。",
      question: "仮想物体の大きさは現実の10cmと合っていたか?",
      choices: ["ほぼ合っていた", "明らかに大きかった", "明らかに小さかった"],
    },
  ],

  // 手順3: 分類。今日の講義の用語で、この体験を分類する。
  classifications: [
    {
      id: "overlay",
      question: "視覚情報の重畳方式はどれか?",
      choices: ["光学シースルー", "ビデオシースルー", "投影方式"],
    },
    {
      id: "display",
      question: "表示装置の形態はどれか?",
      choices: ["HMD", "手持ちディスプレイ", "固定ディスプレイ"],
    },
    {
      id: "sensing",
      question: "実空間の認識に主に使われていたのはどれか?",
      choices: ["マーカ（2次元コード）", "自然特徴（マーカなしの画像認識）", "位置情報（GPS）"],
    },
    {
      id: "continuum",
      question: "バーチャリティ連続体の上では、どこに位置するか?",
      choices: ["実環境に近い側（AR）", "バーチャル環境に近い側（AV）", "完全なバーチャル環境（VR）"],
    },
  ],

  // 手順3の最後の自由記述
  reflection: {
    id: "reflection",
    question: "仮想物体が「本当にそこにある」と感じられなかった瞬間を1つ挙げ、その原因を考えて書こう。",
    placeholder: "例: 手をかざしたとき、物体が手の上に描かれて違和感があった。原因は…",
  },
};
