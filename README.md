# Shelly

## 日本語

Shelly は、スケッチから複雑な曲面を直感的に設計するための 3D モデリング支援ツールです。子どもたちが自由に建築物を描き、その発想を大きな 3D プリンタなどで実空間へ出力できる世界を目標に、専門的な 3D モデリング操作をスケッチ中心の操作へ置き換えることを目指しています。

参考:

- 作品ページ: https://www.honma.site/ja/works/shelly/

### 概要

ユーザーは三面図上に大まかな曲面形状をスケッチし、システムはその線を B スプライン曲線として近似します。近似した曲線の制御点を奥行き方向に複製することで B スプライン曲面を生成し、右上の 3D ビューで形状を確認できます。

生成後は、曲面上の特定の補助線を選択し、その線に新しいスケッチを重ねることで形状を編集できます。編集時には、選択した曲線とスケッチの差分を周辺の曲線へどう反映するかについて、複数の候補を提示します。

### 主な機能

- 三面図と 3D ビューを組み合わせた 2x2 レイアウト
- スケッチ線からの B スプライン曲線近似
- B スプライン曲線の制御点をもとにした曲面生成
- 曲面上の u/v 方向補助線の選択
- 選択した補助線へのスケッチ追従による曲面編集
- 周辺曲線への影響のかけ方を複数候補として提示
- ソリッド、横ストライプ、縦ストライプ、格子状の表示切り替え
- 角の厚み編集とグリッドパラメータ調整
- Undo / Redo
- STL エクスポート

### 操作の流れ

```mermaid
flowchart LR
  sketch[三面図にスケッチ] --> fit[最小二乗法で<br/>Bスプライン曲線へ近似]
  fit --> surface[制御点を奥行き方向に複製し<br/>Bスプライン曲面を生成]
  surface --> view[3Dビューで確認]
  view --> select[曲面上の補助線を選択]
  select --> edit[選択線に新しいスケッチを重ねる]
  edit --> suggest[編集候補を提示]
  suggest --> choose[色ボタンで候補を選択]
  choose --> update[曲面ジオメトリを更新]
```

### 編集候補の考え方

曲面編集では、選択した曲線に対するスケッチの変形をそのまま全体へ適用するのではなく、周辺の曲線へどう伝播させるかを候補として提示します。

```mermaid
flowchart TB
  selected[選択した曲線] --> diff[スケッチとの差分を計算]
  basis[Bスプライン基底関数] --> threshold[基底値がしきい値以上の曲線だけ追従]
  basis --> linear[影響中心から線形に弱めて追従]
  diff --> all[差ベクトルを全曲線へ加算]
  threshold --> preview[候補プレビュー]
  linear --> preview
  all --> preview
  preview --> commit[ボタンで確定]
```

実装上は `NurbsSurfaceController` がスケッチを 3D 平面へ投影し、`fitBSprain` で近似した曲線と既存曲面の制御点列を比較します。その後、基底関数の値、線形重み、差ベクトルを使って 3 種類の `SuggestionHelper` を生成し、選択された候補を `SetControlPointsCommand` として履歴に積みます。

### 技術構成

- TypeScript
- Vite
- Three.js
- NURBS / B-spline
- mathjs

### ディレクトリ構成

- `src/main.ts`: アプリケーションの起動処理、三面図と 3D ビューの初期化
- `src/scene/`: Three.js シーン、背景面、イベント処理
- `src/canvas/`: スケッチ用 Canvas レイヤ
- `src/curve/`: NURBS 曲線・曲面表現
- `src/model/`: 曲面モデルとジオメトリ生成
- `src/view/`: 補助線や候補表示
- `src/controller/`: スケッチ編集、候補生成、操作確定
- `src/history/`: Undo / Redo 用コマンド
- `src/utils/`: B スプライン基底関数、最小二乗近似、共通処理
- `public/`: 3D モデルや音声などの静的ファイル

### 実行方法

依存関係をインストールします。

```bash
npm install
```

開発サーバーを起動します。

```bash
npm run dev
```

ビルドします。

```bash
npm run build
```

### メモ

このリポジトリは、ゼミ内のプログラミング LT で発表したプロトタイプです。3D モデリング経験のない高校生による試用では、チュートリアル後の短い制作時間でも、雲をイメージした格子状の構造物のような複雑な形状を作ることができました。

## English

Shelly is a sketch-based 3D modeling support tool for designing complex curved surfaces. The project aims to replace specialized 3D modeling operations with sketch-centered interactions so that children can freely draw architectural ideas and eventually output them into physical space with large-scale 3D printers.

References:

- Work page: https://www.honma.site/en/works/shelly/

### Overview

Users sketch rough curved shapes on orthographic views, and Shelly approximates those strokes as B-spline curves. It then generates a B-spline surface by duplicating the fitted control points along the depth direction, allowing users to inspect the result in the 3D view.

After generation, users can select a helper curve on the surface and draw another sketch over it to edit the shape. When editing, the system presents multiple suggestions for how the difference between the selected curve and the new sketch should propagate to neighboring curves.

### Features

- 2x2 layout combining three orthographic sketch views and one 3D view
- B-spline curve fitting from sketch strokes
- Surface generation from duplicated B-spline control points
- Selection of u/v helper curves on the generated surface
- Surface editing by drawing over selected helper curves
- Multiple propagation suggestions for neighboring curves
- Solid, horizontal stripe, vertical stripe, and grid display modes
- Corner thickness editing and grid parameter adjustment
- Undo / Redo
- STL export

### Workflow

```mermaid
flowchart LR
  sketch[Sketch on orthographic views] --> fit[Fit strokes as<br/>B-spline curves]
  fit --> surface[Duplicate control points along depth<br/>to generate a B-spline surface]
  surface --> view[Inspect in 3D view]
  view --> select[Select a helper curve]
  select --> edit[Draw a new sketch over it]
  edit --> suggest[Generate editing suggestions]
  suggest --> choose[Choose with color buttons]
  choose --> update[Update surface geometry]
```

### Editing Suggestions

Shelly does not simply apply the selected curve deformation to the entire surface. Instead, it presents several ways to propagate the change to surrounding curves.

```mermaid
flowchart TB
  selected[Selected curve] --> diff[Calculate difference from sketch]
  basis[B-spline basis values] --> threshold[Update curves above a basis threshold]
  basis --> linear[Apply linearly weakened influence]
  diff --> all[Add difference vectors to all curves]
  threshold --> preview[Suggestion preview]
  linear --> preview
  all --> preview
  preview --> commit[Commit with a button]
```

In the implementation, `NurbsSurfaceController` projects the sketch onto a 3D plane and compares the fitted curve with the current surface control-point vectors. It then creates three `SuggestionHelper` previews using basis values, linear weights, and difference vectors. The selected suggestion is committed as a `SetControlPointsCommand`, which also supports undo and redo.

### Tech Stack

- TypeScript
- Vite
- Three.js
- NURBS / B-spline
- mathjs

### Project Structure

- `src/main.ts`: application bootstrap and initialization of the orthographic and 3D views
- `src/scene/`: Three.js scenes, background planes, and event handling
- `src/canvas/`: sketch canvas layers
- `src/curve/`: NURBS curve and surface representation
- `src/model/`: surface model and geometry generation
- `src/view/`: helper curves and suggestion previews
- `src/controller/`: sketch editing, suggestion generation, and commit handling
- `src/history/`: command-based undo and redo
- `src/utils/`: B-spline basis functions, least-squares fitting, and shared utilities
- `public/`: static assets such as 3D models and audio

### Usage

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

### Note

This repository contains a prototype presented in an internal programming lightning talk. In a pilot study, a high school student with no prior 3D modeling experience was able to create a complex grid-like structure inspired by clouds after a short tutorial and around 20 minutes of production time.
