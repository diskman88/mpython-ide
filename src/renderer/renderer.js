// MPython IDE - Renderer Process
document.addEventListener('DOMContentLoaded', () => {
  const portSelect = document.getElementById('port-select');
  const baudSelect = document.getElementById('baud-select');
  const connectBtn = document.getElementById('connect-btn');
  const terminalContainer = document.getElementById('terminal-container');
  const settingsModal = document.getElementById('settings-modal');
  const openclawUrlInput = document.getElementById('openclaw-url-input');
  const loadDiagramBtn = document.getElementById('load-diagram-btn');
  const diagramImage = document.getElementById('diagram-image');
  const diagramPlaceholder = document.querySelector('.diagram-placeholder');
  const sensorOverlay = document.getElementById('sensor-overlay');
  const diagramContainer = document.getElementById('diagram-container');

  let isConnected = false;
  let openclawUrl = 'http://localhost:18789';
  let term = null;
  let currentFilePath = null;
  let codeEditor = null;  // Monaco editor instance
  let editorContainer = null;

  init();

  function init() {
    setupEventListeners();
    setupElectronCallbacks();
    loadSettings();
    initTerminal();
    initEditor();
    // 初始刷新串口列表
    refreshPorts();
    // 每3秒自动刷新一次串口列表
    setInterval(refreshPorts, 3000);
    // 监听来自 AI (iframe) 的消息
    window.addEventListener('message', handleAIMessage);
  }

  // 处理来自 AI 的消息
  function handleAIMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;
    
    if (data.type === 'openFile' && data.content !== undefined) {
      if (codeEditor) {
        codeEditor.setValue(data.content);
        currentFilePath = data.fileName || 'untitled.py';
        term.writeln('\r\n\x1b[36m[AI] 已加载文件: ' + currentFilePath + '\x1b[0m');
      }
    }
  }

  function initEditor() {
    editorContainer = document.getElementById('code-editor-container');

    // 配置 Monaco Loader
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], function () {
      // 创建 Monaco Editor
      codeEditor = monaco.editor.create(editorContainer, {
        value: `import time

while True:
    print("hello, world")
    time.sleep(0.5)
`,
        language: 'python',
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, monospace',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'off',
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        acceptSuggestionOnEnter: 'on',
        formatOnPaste: true,
        formatOnType: true
      });
    });
  }

  // 一键执行：加载代码 → 连接 → 上传
  function runDemo() {
    const demoCode = `import time

while True:
    print("hello, world")
    time.sleep(0.5)
`;
    if (codeEditor) {
      codeEditor.setValue(demoCode);
    }

    const port = portSelect.value;
    if (!port) {
      term.writeln('\r\n\x1b[31m请先选择串口\x1b[0m');
      return;
    }

    if (!isConnected) {
      window.electronAPI.connect(port, parseInt(baudSelect.value));
      const checkConnected = setInterval(() => {
        if (isConnected) {
          clearInterval(checkConnected);
          setTimeout(uploadFile, 300);
        }
      }, 100);
    } else {
      uploadFile();
    }
  }

  function initTerminal() {
    // 使用全局的 Terminal (通过 script 标签加载)
    const Terminal = window.Terminal;

    term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#569cd6',
        selectionBackground: '#264f78'
      },
      scrollback: 10000
    });

    term.open(terminalContainer);
    term.focus();

    // 处理键盘输入 - 参考 micropython-ctl 的方式
    // xterm 会处理所有按键，包括 Tab、方向键、Ctrl+C等
    term.onData((data) => {
      if (isConnected) {
        // 直接发送所有数据，包括控制字符
        window.electronAPI.sendRaw(data);
      }
    });

    // 监听键盘事件，确保Ctrl+C不被浏览器拦截
    term.textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault(); // 阻止浏览器默认行为
      }
    });
  }

  function setupEventListeners() {
    connectBtn.addEventListener('click', toggleConnection);

    // 点击串口选择时自动刷新列表
    portSelect.addEventListener('mousedown', () => {
      refreshPorts();
    });

    // Tab 切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // 切换按钮状态
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // 切换面板
        if (tab === 'editor') {
          document.getElementById('editor-panel').classList.remove('hidden');
          document.getElementById('diagram-panel').classList.add('hidden');
          document.querySelector('.editor-controls').classList.remove('hidden');
          document.querySelector('.diagram-controls').classList.add('hidden');
        } else {
          document.getElementById('editor-panel').classList.add('hidden');
          document.getElementById('diagram-panel').classList.remove('hidden');
          document.querySelector('.editor-controls').classList.add('hidden');
          document.querySelector('.diagram-controls').classList.remove('hidden');
        }
      });
    });

    document.getElementById('openclow-url-btn').addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('cancel-settings-btn').addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
    document.querySelector('.close-btn').addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    loadDiagramBtn.addEventListener('click', loadDiagram);
    diagramContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    diagramContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length > 0) {
        loadImageFile(e.dataTransfer.files[0]);
      }
    });

    // 文件操作
    document.getElementById('open-file-btn').addEventListener('click', openFile);
    document.getElementById('save-file-btn').addEventListener('click', saveFile);
    document.getElementById('upload-file-btn').addEventListener('click', uploadFile);
    document.getElementById('run-demo-btn').addEventListener('click', runDemo);

    // 分隔条拖动
    setupSplitter();
  }

  function setupSplitter() {
    const splitter = document.getElementById('splitter');
    const rightPanels = document.querySelector('.right-panels');
    let isDragging = false;

    splitter.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const containerRect = rightPanels.getBoundingClientRect();
      const y = e.clientY - containerRect.top;
      const totalHeight = containerRect.height;
      const percentage = (y / totalHeight) * 100;

      // 限制范围 20%-80%
      if (percentage > 20 && percentage < 80) {
        const topPanel = document.querySelector('.top-panel');
        const bottomPanel = document.querySelector('.bottom-panel');
        topPanel.style.flex = `0 0 ${percentage}%`;
        bottomPanel.style.flex = `0 0 ${100 - percentage}%`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  function setupElectronCallbacks() {
    window.electronAPI.onPortsList((ports) => {
      const currentValue = portSelect.value; // 保存当前选中的值
      portSelect.innerHTML = '<option value="">-- 选择串口 --</option>';
      ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.description || '未知设备'}`;
        portSelect.appendChild(option);
      });
      // 恢复之前选中的值（如果该串口仍然存在）
      if (currentValue && ports.some(p => p.path === currentValue)) {
        portSelect.value = currentValue;
      }
    });

    window.electronAPI.onPortError((err) => {
      term.writeln('\r\n\x1b[31m错误: ' + err + '\x1b[0m');
    });

    window.electronAPI.onConnected((port) => {
      isConnected = true;
      connectBtn.textContent = '断开';
      connectBtn.classList.add('btn-danger');
      term.writeln('\r\n\x1b[32m=== 已连接到 ' + port + ' ===\x1b[0m');
      term.focus();
    });

    window.electronAPI.onDisconnected(() => {
      isConnected = false;
      connectBtn.textContent = '连接';
      connectBtn.classList.remove('btn-danger');
      term.writeln('\r\n\x1b[33m=== 已断开连接 ===\x1b[0m');
    });

    // 设备数据 - 直接写入终端
    window.electronAPI.onData((data) => {
      term.write(data);
    });

    window.electronAPI.onRefreshPorts(() => {
      refreshPorts();
    });
  }

  function refreshPorts() {
    window.electronAPI.getPorts();
  }

  function toggleConnection() {
    if (isConnected) {
      window.electronAPI.disconnect();
    } else {
      const port = portSelect.value;
      if (!port) {
        term.writeln('\r\n\x1b[31m请先选择串口\x1b[0m');
        return;
      }
      const baudRate = parseInt(baudSelect.value);
      window.electronAPI.connect(port, baudRate);
    }
  }

  function saveSettings() {
    openclawUrl = openclawUrlInput.value.trim();
    localStorage.setItem('openclawUrl', openclawUrl);
    document.getElementById('openclaw-frame').src = openclawUrl;
    settingsModal.classList.add('hidden');
  }

  function loadSettings() {
    const saved = localStorage.getItem('openclawUrl');
    if (saved) {
      openclawUrl = saved;
      openclawUrlInput.value = openclawUrl;
      document.getElementById('openclaw-frame').src = openclawUrl;
    }
  }

  function loadDiagram() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        loadImageFile(e.target.files[0]);
      }
    };
    input.click();
  }

  function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      diagramImage.src = e.target.result;
      diagramImage.classList.remove('hidden');
      diagramPlaceholder.classList.add('hidden');
      sensorOverlay.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  // 文件操作
  function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py,.txt,.js';
    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (codeEditor) {
            codeEditor.setValue(e.target.result);
          }
          currentFilePath = file.name;
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  function saveFile() {
    if (!currentFilePath) {
      currentFilePath = 'untitled.py';
    }
    const code = codeEditor ? codeEditor.getValue() : '';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilePath;
    a.click();
    URL.revokeObjectURL(url);
  }

  function uploadFile() {
    if (!isConnected) {
      term.writeln('\r\n\x1b[31m请先连接到设备\x1b[0m');
      return;
    }
    const code = codeEditor ? codeEditor.getValue() : '';
    if (!code.trim()) {
      term.writeln('\r\n\x1b[33m没有代码可上传\x1b[0m');
      return;
    }
    // 使用粘贴模式 (paste mode) 上传代码
    term.writeln('\r\n\x1b[32m开始上传代码...\x1b[0m');

    // 发送 Ctrl+E 进入粘贴模式
    window.electronAPI.sendRaw('\x05');

    setTimeout(() => {
      window.electronAPI.sendRaw(code);
      setTimeout(() => {
        window.electronAPI.sendRaw('\x04');
        term.writeln('\x1b[32m代码上传完成\x1b[0m');
      }, 100);
    }, 100);
  }
});
