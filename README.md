# Antigravity Particles

一款创意品牌落地页，使用 Three.js GPU 粒子动画，灵感来自 Google Antigravity 美学。基于 Vue 3 + Vite 构建。

## 技术栈

- **Vue 3**（Composition API，`<script setup>`）
- **Vite 8** — 快速开发服务器和生产构建
- **Three.js**（`r184`）— 通过 `DataTexture` 和 `WebGLRenderTarget` ping-pong 实现 GPU 粒子系统
- **GSAP** — 悬停驱动的过渡动画
- **vue3-typer** — 打字机文字效果（带光标）
- **Google Sans Flex** — 可变品牌字体（Regular 字重）

## 组件

### DownloadCard

水母风格的粒子动画卡片。GPU 粒子形成同心环层，以呼吸节奏收缩舒张。主要特性：

- **GPGPU 模拟** — 256×256 `DataTexture`，存储每个粒子的位置（xy）、缩放（z）和速度（w）
- **环位移** — 粒子在同心环上运动，收缩时边缘加权内扣
- **胶囊精灵** — 通过片段着色器中的 `sdCapsule` SDF 将粒子渲染为圆角胶囊形状
- **呼吸动画** — 收缩/舒张幅度调制环位移，呈现自然的水母运动
- **鼠标交互** — 环平滑追踪光标位置
- **自适应抗锯齿** — 最小粒子尺寸确保胶囊末端清晰圆润
- **Google Sans Flex 字体排版**，搭配 Material Symbols Outlined 图标

### MorphCard

形状变形粒子卡片，悬停时粒子在随机散落与轮廓形状之间过渡。左右并排两张卡片：`braces.png`（花括号）和 `cube.png`（立方体）。

- **边缘检测** — 逐像素计算图片边缘轮廓，生成目标位置
- **最近邻映射** — 每个粒子分配距离最近的边缘像素作为悬停目标
- **GPGPU 过渡** — 基于距离的吸引，逐渐减速，保留少量残留粒子以实现有机感
- **空闲状态** — 粒子通过 simplex 噪声随机漂移
- **重置逻辑** — 低概率粒子重置，防止多次悬停后粒子全部吸附到边缘

### IconWave

一行 Material Symbols 图标，呈正弦波上下摆动。波频和基于滚动的水平偏移营造出俏皮动感的页面头部效果。

### Typewriter

使用 `vue3-typer`，通过 `IntersectionObserver` 在打字机组件的可见度达到 30% 时触发打字效果。单次打字，结束后光标闪烁，不循环。

## 项目结构

```
antigravity-particles/
├── index.html                  # 入口 HTML
├── vite.config.js              # Vite 配置（Vue 插件）
├── package.json
├── public/
│   ├── fonts/
│   │   └── GoogleSansFlex-Regular.woff2
│   ├── braces.png              # MorphCard 形状源（左）
│   └── cube.png                # MorphCard 形状源（右）
└── src/
    ├── main.js                 # 应用入口，全局样式导入
    ├── App.vue                 # 根布局编排
    ├── style.css               # 全局样式、字体声明、隐藏滚动条
    ├── components/
    │   ├── DownloadCard.vue    # 水母 GPU 粒子动画 + 布局
    │   ├── MorphCard.vue      # 形状变形 GPU 粒子动画
    │   └── IconWave.vue       # 正弦波图标动画
    └── composables/
        └── useNoiseGLSL.js     # 共享 Simplex 噪声 GLSL 函数
```

## 开始使用

```bash
# 安装依赖
pnpm install

# 启动开发服务器（Vite）
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

## GPU 粒子管线

所有粒子系统采用相同的 GPGPU 计算模式：

1. **模拟阶段（simFrag）** — 片段着色器读取当前粒子 DataTexture，将更新后的位置/缩放写入渲染目标（ping-pong 缓冲）
2. **渲染阶段（rdrFrag / rdrVert）** — 使用自定义顶点/片段着色器的 PointsMaterial 读取模拟输出并绘制点精灵

### 模拟（simFrag）

- 从 `uState`（DataTexture）读取粒子状态
- 根据目标位置（环轨道或边缘轮廓）计算每个粒子的加速度
- 应用阻尼、重置逻辑和噪声漂移
- 将更新后的状态输出到 `vPosition`（渲染目标）

### 渲染（rdrFrag / rdrVert）

- 顶点着色器从模拟输出中读取粒子位置/缩放
- 片段着色器使用 `sdCapsule` 有符号距离函数将每个粒子渲染为圆角胶囊
- 边缘抗锯齿处理，确保粒子细腻平滑

## 许可证

MIT
