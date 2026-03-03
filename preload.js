const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectVideo: () => ipcRenderer.invoke('select-video'),
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
    closeApp: (state) => ipcRenderer.send('close-app', state),
    loadState: () => ipcRenderer.invoke('load-state'),
    toggleClickthrough: (enabled) => ipcRenderer.send('toggle-clickthrough', enabled),
    newBuddy: () => ipcRenderer.send('new-buddy'),
    exportBuddy: (state) => ipcRenderer.invoke('export-buddy', state),
    importBuddy: () => ipcRenderer.invoke('import-buddy'),

    // Window movement (manual drag)
    getPosition: () => ipcRenderer.invoke('get-position'),
    moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
    setWindowIcon: (dataUrl) => ipcRenderer.send('set-window-icon', dataUrl),

    // Tutorial
    shouldShowTutorial: () => ipcRenderer.invoke('should-show-tutorial'),
    tutorialSeen: () => ipcRenderer.send('tutorial-seen'),

    // Controls window
    openControls: (state) => ipcRenderer.send('open-controls', state),
    colorPicked: (color) => ipcRenderer.send('buddy-color-picked', color),
    maskState: (active) => ipcRenderer.send('buddy-mask-state', active),

    // Listen for commands from controls
    onSettingUpdate: (cb) => ipcRenderer.on('setting-update', (_, key, value) => cb(key, value)),
    onStartEyedropper: (cb) => ipcRenderer.on('start-eyedropper', () => cb()),
    onToggleMask: (cb) => ipcRenderer.on('toggle-mask', () => cb()),
    onClearMask: (cb) => ipcRenderer.on('clear-mask', () => cb()),
    onLoadNewVideo: (cb) => ipcRenderer.on('load-new-video', (_, path) => cb(path)),
    onResetSize: (cb) => ipcRenderer.on('reset-size', () => cb()),
    onDoExport: (cb) => ipcRenderer.on('do-export', () => cb()),
    onCloseRequested: (cb) => ipcRenderer.on('close-requested', () => cb())
});
