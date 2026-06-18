# Antigravity Particles

一个基于 Three.js 的 GPU 粒子系统网页，在浏览器中渲染出 Google Antigravity 风格的反重力粒子交互效果。

![页面预览](_reference/full_page.png)

## 功能

页面包含三个独立的粒子场景：

### 1. 下载卡片粒子（主场景）

黑色圆角卡片上有数千个粒子产生环状涟漪效果，跟随鼠标位置流动。粒子形状为细长胶囊，带有噪波驱动的呼吸式跳动动画。

- **渲染方式**：PerspectiveCamera + `mesh.scale(5, -5, 5)`
- **物理模拟**：基于环形距离场的噪声位移
- **核心算法**：Poisson Disk 采样 + GPGPU 物理模拟 + SDF 胶囊粒子渲染
- **交互方式**：鼠标移动会产生一个"引力环"，粒子跟随偏移

### 2. Morphing 卡片粒子

两张并排的深色卡片（"For developers" / "For organizations"），粒子默认呈散乱分布，鼠标悬停后汇集到指定图案上。

- **卡片 1（mc1）**：粒子汇集为 `individual.png` 中的人物剪影
- **卡片 2（mc2）**：粒子汇集为 `cube.png` 中的等轴测立方体
- **渲染方式**：OrthographicCamera + `[-1, 1]` 归一化坐标空间
- **核心算法**：图像采样 → Poisson Disk 选点 → 最近邻映射 → GPGPU 过渡动画
- **交互方式**：hover 时粒子从散乱位置平滑移动到形状目标位置

### 3. 图标波浪（装饰）

一组 Material Symbols 图标的波浪弹跳动画，模拟官网的视差效果。

## 技术原理

### GPU 粒子系统架构

所有粒子场景都使用 Three.js 的 GPGPU（通用 GPU 计算）模式：

1. **数据纹理（DataTexture）**：256 × 256 RGBA Float 纹理，存储每个粒子的位置（x, y）、缩放（z）和速度（w）
2. **SIM Pass**：用 Fragment Shader 更新粒子物理状态，渲染到 WebGLRenderTarget
3. **Render Pass**：从渲染目标读取最新位置，用 Points 绘制粒子
4. **Ping-Pong**：两个渲染目标交替读写，避免依赖同一帧的输出

### 形状提取与 Poisson Disk 采样

Morphing 卡片的形状汇聚流程：

1. **加载 PNG**：通过 `Image()` 加载 `individual.png` / `cube.png`，绘制到 500 × 500 Canvas
2. **提取 ImageData**：获取每个像素的亮度值
3. **距离函数**：`pixel³` 将暗像素映射为接近 0 的值（形状区域），亮像素映射为接近 1（背景）
4. **Poisson Disk 采样**：只在暗像素区域（值 < 0.15）生成均匀分布的点，最小间距 7.33px
5. **最近邻分配**：为每个散乱粒子找到最近的形状目标点（75% 随机跳过以提高性能）
6. **GPU 过渡**：SIM shader 中 `mix(refPos, targetPos, hover²)` 驱动粒子平滑移动

### 胶囊粒子渲染（下载卡片）

使用有符号距离函数（SDF）`sdRoundBox` 绘制胶囊形状：

```
float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(.25));
rounded = smoothstep(.1, 0., rounded);
```

粒子朝向根据其与鼠标位置的角度旋转，产生指向鼠标的统一方向。

## 文件结构

```
standalone/
├── index.html          # 主页面，包含所有粒子场景
├── individual.png      # 人物剪影形状图（morphing 卡片 1）
├── cube.png            # 等轴测立方体形状图（morphing 卡片 2）
├── README.md           # 本文件
```

## 使用方式

### 本地运行

```bash
cd antigravity-particles/standalone
python3 -m http.server 8000
```

打开浏览器访问 `http://localhost:8000`。

### 自定义形状

替换 `individual.png` 或 `cube.png` 为其他黑白线条图：

- 图片格式：RGBA PNG，建议 1024 × 1024
- 黑色区域（RGB < 100）为粒子汇聚形状
- 线条建议宽度 40px 以上，以确保采样到足够多的目标点
- 白色背景区域粒子将避开

## 技术栈

| 技术 | 用途 |
|---|---|
| Three.js 0.180 | 3D 渲染、GPGPU、数据纹理 |
| GSAP 3.12.5 | 鼠标 hover、push 交互动画 |
| WebGL2 / Float textures | GPU 物理模拟 |
| Poisson Disk 采样 | 粒子均匀分布 |
| Simplex 噪声（Ashima Arts） | 粒子流体运动 |

## 许可

仅供学习和参考。Google Antigravity 品牌和设计归 Google 所有。
