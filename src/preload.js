const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 串口操作
  getPorts: () => ipcRenderer.send('get-ports'),
  onPortsList: (callback) => ipcRenderer.on('serial-ports', (event, ports) => callback(ports)),
  onPortError: (callback) => ipcRenderer.on('serial-error', (event, err) => callback(err)),

  connect: (port, baudRate) => ipcRenderer.send('connect-serial', port, baudRate || 115200),
  disconnect: () => ipcRenderer.send('disconnect-serial'),
  onConnected: (callback) => ipcRenderer.on('serial-connected', (event, port) => callback(port)),
  onDisconnected: (callback) => ipcRenderer.on('serial-closed', callback),

  // 发送原始数据（用于所有按键）
  sendRaw: (data) => ipcRenderer.send('send-raw-serial', data),

  // 设备数据（实时流式）
  onData: (callback) => ipcRenderer.on('serial-data', (event, data) => callback(data)),

  // 文件操作
  openFile: () => ipcRenderer.send('menu-action', 'open-file'),
  saveFile: () => ipcRenderer.send('menu-action', 'save-file'),
  onFileContent: (callback) => ipcRenderer.on('file-content', (event, data) => callback(data)),
  onFileError: (callback) => ipcRenderer.on('file-error', (event, err) => callback(err)),

  // 其他
  onRefreshPorts: (callback) => ipcRenderer.on('refresh-ports', () => callback()),
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action))
});
