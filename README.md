# MPython IDE

AI辅助的MicroPython开发环境，基于Electron构建。

## 功能特点

- 🤖 **OpenClaw AI助手** - 左侧面板集成AI对话功能
- 📋 **硬件连接图** - 右上角显示硬件接线图，支持拖拽加载
- 🖥️ **REPL终端** - 右下角串口终端，支持命令输入和输出显示
- 🔌 **自动串口检测** - 自动识别连接的掌控板

## 界面布局

```
┌─────────────────────────┬────────────────────────────────┐
│                         │  📋 硬件连接图                 │
│  🤖 OpenClaw AI助手     │                                │
│                         │  (显示硬件图片)                │
│                         ├────────────────────────────────┤
│                         │  🖥️ REPL 终端                 │
│                         │  >>> print("Hello")           │
└─────────────────────────┴────────────────────────────────┘
```

## 安装

### 前置要求

- Node.js 18+ 
- npm
- Windows 10/11

### 安装步骤

1. 克隆或下载项目
2. 进入目录
3. 安装依赖
4. 运行

```bash
cd mpython-ide
npm install
npm start
```

## 使用说明

### 1. OpenClaw AI助手

- 点击左上角"设置"按钮配置OpenClaw地址
- 默认地址: http://localhost:18789
- 在AI助手中可以对话生成代码

### 2. 硬件连接图

- 点击"加载图片"选择硬件图片
- 或直接拖拽图片到窗口
- 支持PNG、JPG、SVG等格式

### 3. REPL终端

- 选择串口号和波特率
- 点击"连接"建立连接
- 输入命令后回车发送
- Ctrl+C可中断当前程序

### 快捷键

| 按键 | 功能 |
|------|------|
| Ctrl+O | 打开文件 |
| Ctrl+S | 保存文件 |
| Ctrl+C | 中断程序 |
| F5 | 刷新串口 |

## 项目结构

```
mpython-ide/
├── package.json          # 项目配置
├── src/
│   ├── main.js          # 主进程
│   ├── preload.js       # 预加载脚本
│   └── renderer/
│       ├── index.html   # 主页面
│       ├── styles.css   # 样式
│       └── renderer.js  # 渲染进程逻辑
└── assets/              # 资源文件
```

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **SerialPort** - 串口通信
- **WebView** - OpenClaw集成

## 开发

```bash
# 开发模式
npm run dev

# 构建Windows安装包
npm run build
```

## 许可证

MIT