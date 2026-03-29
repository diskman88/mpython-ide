/**
 * MPython IDE - ACP Client for Electron Main Process
 * 
 * Connects to OpenClaw Gateway via ACP protocol WebSocket
 * and provides IDE tools to the AI session.
 */

const WebSocket = require('ws');
const http = require('http');

// Gateway config
const GATEWAY_URL = 'ws://localhost:18789';
const GATEWAY_TOKEN = '85fc2b385a6916acd726aba15498211d5660751ea985d880';
const SESSION_KEY = 'mpython-ide:agent';

// IDE Tools - these are called by the AI
let ideTools = {
  setCode: (code) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('oc-set-code', code);
      return { success: true, message: 'Code set in editor' };
    }
    return { success: false, error: 'Window not available' };
  },
  runCode: () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('oc-run-code');
      return { success: true, message: 'Code running' };
    }
    return { success: false, error: 'Window not available' };
  },
  connect: (port, baud) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('oc-connect', port, baud || 115200);
      return { success: true, message: `Connecting to ${port}` };
    }
    return { success: false, error: 'Window not available' };
  },
  disconnect: () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('oc-disconnect');
      return { success: true, message: 'Disconnected' };
    }
    return { success: false, error: 'Window not available' };
  },
  sendRaw: (cmd) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('oc-send-raw', cmd);
      return { success: true, message: `Sent: ${cmd}` };
    }
    return { success: false, error: 'Window not available' };
  },
  getStatus: () => {
    return { connected: isConnected, port: currentPort, baud: currentBaudRate };
  },
  getPorts: () => {
    return SerialPort ? [] : []; // Would need async
  }
};

let mainWindow = null;
let serialPort = null;
let isConnected = false;
let currentPort = null;
let currentBaudRate = 115200;

let ws = null;
let requestId = 0;
let pendingRequests = {};
let toolsRegistered = false;

// ============================================
// ACP WebSocket Client
// ============================================
function connectAcp(sessionWindow) {
  mainWindow = sessionWindow;
  
  ws = new WebSocket(GATEWAY_URL, {
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`
    }
  });

  ws.on('open', () => {
    console.log('[ACP] Connected to Gateway');
    
    // Join/create session with tool capabilities
    send({
      type: 'session.start',
      sessionKey: SESSION_KEY,
      capabilities: {
        tools: Object.keys(ideTools),
        streaming: true
      }
    });
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('[ACP] Received:', msg.type);
      
      switch (msg.type) {
        case 'session.started':
          console.log('[ACP] Session started');
          break;
          
        case 'session.error':
          console.error('[ACP] Session error:', msg.error);
          break;
          
        case 'tools.registered':
          console.log('[ACP] Tools registered:', msg.tools);
          toolsRegistered = true;
          break;
          
        case 'prompt':
          // User prompt from AI
          // msg.text contains the prompt
          handlePrompt(msg.text || '', msg.attachments || []);
          break;
          
        case 'tool.call':
          // AI calling a tool
          const { tool, args, callId } = msg;
          console.log(`[ACP] Tool call: ${tool}`, args);
          
          let result;
          try {
            if (typeof ideTools[tool] === 'function') {
              result = ideTools[tool](...(args || []));
            } else {
              result = { error: `Unknown tool: ${tool}` };
            }
          } catch (e) {
            result = { error: e.message };
          }
          
          send({
            type: 'tool.result',
            callId,
            result
          });
          break;
          
        case 'error':
          console.error('[ACP] Error:', msg.message);
          break;
      }
    } catch (e) {
      console.error('[ACP] Parse error:', e);
    }
  });

  ws.on('error', (err) => {
    console.error('[ACP] WebSocket error:', err);
  });

  ws.on('close', () => {
    console.log('[ACP] Disconnected');
    toolsRegistered = false;
    // Reconnect after 3 seconds
    setTimeout(() => connectAcp(mainWindow), 3000);
  });
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Handle user prompt - send to AI and get response
function handlePrompt(text, attachments) {
  send({
    type: 'prompt',
    text,
    attachments
  });
}

// Send message from IDE UI to AI
function sendMessage(text) {
  send({
    type: 'prompt',
    text
  });
}

// ============================================
// Export
// ============================================
module.exports = {
  connectAcp,
  sendMessage,
  isConnected: () => ws && ws.readyState === WebSocket.OPEN,
  isToolsRegistered: () => toolsRegistered
};
