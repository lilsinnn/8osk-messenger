const { contextBridge } = require('electron');

// We expose nothing for now, as the P2P chat runs primarily in the web context
// using standard WebRTC and WebSocket/MQTT protocols. 
// If OS-level native file saving or notifications are needed later, expose them here.

contextBridge.exposeInMainWorld('electronAPI', {
    // e.g., platform: process.platform
});
