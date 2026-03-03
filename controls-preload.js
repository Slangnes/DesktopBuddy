const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('controlsAPI', {
    // Get the initial state passed from buddy
    getState: () => ipcRenderer.invoke('controls-get-state'),

    // Send a setting change to the buddy
    updateSetting: (key, value) => ipcRenderer.send('controls-update-setting', key, value),

    // Actions
    startEyedropper: () => ipcRenderer.send('controls-start-eyedropper'),
    toggleMask: () => ipcRenderer.send('controls-toggle-mask'),
    clearMask: () => ipcRenderer.send('controls-clear-mask'),
    changeVideo: () => ipcRenderer.invoke('controls-change-video'),
    resetSize: () => ipcRenderer.send('controls-reset-size'),
    newBuddy: () => ipcRenderer.send('new-buddy'),
    exportBuddy: () => ipcRenderer.invoke('controls-export-buddy'),
    importBuddy: () => ipcRenderer.invoke('import-buddy'),
    closeBuddy: () => ipcRenderer.send('controls-close-buddy'),

    // Listen for events from buddy
    onColorPicked: (cb) => ipcRenderer.on('buddy-color-picked', (_, color) => cb(color)),
    onMaskState: (cb) => ipcRenderer.on('buddy-mask-state', (_, active) => cb(active)),
    onStateSync: (cb) => ipcRenderer.on('buddy-state-sync', (_, state) => cb(state))
});
