const { app, BrowserWindow, ipcMain, dialog, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const windows = new Map(); // windowId -> { window, id, controlsWindow, appState, controlsState }
let nextWindowId = 1;

// State file path
const stateFile = path.join(app.getPath('userData'), 'buddy-state.json');

// Load saved state (array of buddy configs)
function loadAllState() {
    try {
        if (fs.existsSync(stateFile)) {
            const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            // Migrate old single-buddy format
            if (data && !Array.isArray(data)) {
                return [data];
            }
            return data;
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
    return null;
}

// Save all window states
function saveAllState() {
    try {
        const states = [];
        for (const [id, entry] of windows) {
            if (entry.window && !entry.window.isDestroyed()) {
                const bounds = entry.window.getBounds();
                states.push({
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                    ...(entry.appState || {})
                });
            }
        }
        fs.writeFileSync(stateFile, JSON.stringify(states, null, 2));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

function getWindowByWebContents(webContents) {
    for (const [id, entry] of windows) {
        if (entry.window && !entry.window.isDestroyed() && entry.window.webContents === webContents) {
            return { id, entry };
        }
    }
    return null;
}

function getEntryByControlsWebContents(webContents) {
    for (const [id, entry] of windows) {
        if (entry.controlsWindow && !entry.controlsWindow.isDestroyed() && entry.controlsWindow.webContents === webContents) {
            return { id, entry };
        }
    }
    return null;
}

function openControlsWindow(buddyId) {
    const entry = windows.get(buddyId);
    if (!entry || !entry.window || entry.window.isDestroyed()) return;

    // If already open, focus it
    if (entry.controlsWindow && !entry.controlsWindow.isDestroyed()) {
        entry.controlsWindow.focus();
        return;
    }

    const buddyBounds = entry.window.getBounds();
    const controlsWin = new BrowserWindow({
        width: 260,
        height: 420,
        x: buddyBounds.x + buddyBounds.width + 10,
        y: buddyBounds.y,
        frame: false,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        backgroundColor: '#1e1e1e',
        webPreferences: {
            preload: path.join(__dirname, 'controls-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    controlsWin.loadFile('controls.html');
    controlsWin.setAlwaysOnTop(true, 'floating');

    entry.controlsWindow = controlsWin;

    controlsWin.on('closed', () => {
        entry.controlsWindow = null;
    });
}

function createWindow(savedState = null) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const id = nextWindowId++;

    const windowConfig = {
        width: savedState?.width || 200,
        height: savedState?.height || 200,
        x: savedState?.x ?? (width - 250 - (windows.size * 50)),
        y: savedState?.y ?? (height - 250),
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        skipTaskbar: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    };

    const win = new BrowserWindow(windowConfig);
    windows.set(id, { window: win, appState: savedState });

    win.loadFile('index.html');
    win.setAlwaysOnTop(true, 'floating');
    win.setIgnoreMouseEvents(false);

    // Block native resize borders (prevents drag-to-grow bug)
    // Programmatic setSize() calls bypass this event
    win.on('will-resize', (e) => {
        e.preventDefault();
    });

    win.on('closed', () => {
        windows.delete(id);
    });

    return id;
}

app.whenReady().then(() => {
    const savedStates = loadAllState();
    if (savedStates && savedStates.length > 0) {
        for (const state of savedStates) {
            createWindow(state);
        }
    } else {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle video file selection
ipcMain.handle('select-video', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
            { name: 'Video Files', extensions: ['webm', 'mp4', 'gif', 'webp'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Handle window position (manual drag)
ipcMain.handle('get-position', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) return win.getPosition();
    return [0, 0];
});

ipcMain.on('move-window', (event, x, y) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setPosition(Math.round(x), Math.round(y));
});

// Set window icon from a data URL (buddy thumbnail)
ipcMain.on('set-window-icon', (event, dataUrl) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        try {
            const img = nativeImage.createFromDataURL(dataUrl);
            win.setIcon(img);
        } catch (e) {
            // ignore invalid image data
        }
    }
});

// Handle window resize
ipcMain.on('resize-window', (event, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setSize(Math.round(width), Math.round(height));
    }
});

// Update app state for a window (called from renderer)
ipcMain.on('update-app-state', (event, appState) => {
    const match = getWindowByWebContents(event.sender);
    if (match) {
        match.entry.appState = appState;
    }
});

// Handle close single window
ipcMain.on('close-app', (event, appState) => {
    const match = getWindowByWebContents(event.sender);
    if (match) {
        match.entry.appState = appState;
    }
    // Save all before closing
    saveAllState();
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.destroy();
    }
});

// Spawn new buddy window
ipcMain.on('new-buddy', () => {
    createWindow();
});

// Load app state for this window
ipcMain.handle('load-state', (event) => {
    const match = getWindowByWebContents(event.sender);
    if (match && match.entry.appState) {
        return match.entry.appState;
    }
    return null;
});

// Toggle click-through mode
ipcMain.on('toggle-clickthrough', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setIgnoreMouseEvents(enabled, { forward: true });
    }
});

// Export buddy as .buddy file (JSON + video copied into a folder)
ipcMain.handle('export-buddy', async (event, appState) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!appState?.videoPath) return false;

    const result = await dialog.showSaveDialog(win, {
        defaultPath: 'my-buddy.buddy',
        filters: [{ name: 'Desktop Buddy', extensions: ['buddy'] }]
    });

    if (result.canceled || !result.filePath) return false;

    try {
        const exportDir = result.filePath;
        // .buddy file is a directory containing video + config
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // Copy video file
        const videoExt = path.extname(appState.videoPath);
        const videoName = 'video' + videoExt;
        const destVideo = path.join(exportDir, videoName);
        fs.copyFileSync(appState.videoPath, destVideo);

        // Write config
        const config = {
            videoFile: videoName,
            chromaColor: appState.chromaColor,
            chromaTolerance: appState.chromaTolerance,
            opacity: appState.opacity,
            maskData: appState.maskData
        };
        fs.writeFileSync(path.join(exportDir, 'buddy.json'), JSON.stringify(config, null, 2));

        return true;
    } catch (e) {
        console.error('Export failed:', e);
        return false;
    }
});

// Import a .buddy file
ipcMain.handle('import-buddy', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        filters: [{ name: 'Desktop Buddy', extensions: ['buddy'] }]
    });

    if (result.canceled || !result.filePaths.length) return null;

    try {
        const buddyDir = result.filePaths[0];
        const configPath = path.join(buddyDir, 'buddy.json');
        if (!fs.existsSync(configPath)) return null;

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const videoPath = path.join(buddyDir, config.videoFile);

        if (!fs.existsSync(videoPath)) return null;

        // Spawn a new window with this config
        const state = {
            videoPath: videoPath,
            chromaEnabled: !!config.chromaColor,
            chromaColor: config.chromaColor,
            chromaTolerance: config.chromaTolerance,
            opacity: config.opacity,
            maskData: config.maskData
        };

        createWindow(state);
        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return null;
    }
});

// Save all state before quitting
app.on('before-quit', () => {
    saveAllState();
});

// --- Controls window IPC ---

// Buddy requests to open controls
ipcMain.on('open-controls', (event, controlsState) => {
    const match = getWindowByWebContents(event.sender);
    if (match) {
        match.entry.controlsState = controlsState;
        openControlsWindow(match.id);
    }
});

// Controls window requests its initial state
ipcMain.handle('controls-get-state', (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match) {
        return match.entry.controlsState || {};
    }
    return {};
});

// Controls sends a setting update → relay to buddy
ipcMain.on('controls-update-setting', (event, key, value) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        match.entry.window.webContents.send('setting-update', key, value);
    }
});

// Controls requests eyedropper mode → relay to buddy
ipcMain.on('controls-start-eyedropper', (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        match.entry.window.webContents.send('start-eyedropper');
    }
});

// Buddy picked a color → relay to controls
ipcMain.on('buddy-color-picked', (event, color) => {
    const match = getWindowByWebContents(event.sender);
    if (match && match.entry.controlsWindow && !match.entry.controlsWindow.isDestroyed()) {
        match.entry.controlsWindow.webContents.send('buddy-color-picked', color);
    }
});

// Controls toggles mask → relay to buddy
ipcMain.on('controls-toggle-mask', (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        match.entry.window.webContents.send('toggle-mask');
    }
});

// Buddy reports mask state → relay to controls
ipcMain.on('buddy-mask-state', (event, active) => {
    const match = getWindowByWebContents(event.sender);
    if (match && match.entry.controlsWindow && !match.entry.controlsWindow.isDestroyed()) {
        match.entry.controlsWindow.webContents.send('buddy-mask-state', active);
    }
});

// Controls clears mask → relay to buddy
ipcMain.on('controls-clear-mask', (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        match.entry.window.webContents.send('clear-mask');
    }
});

// Controls requests video change → open dialog for buddy
ipcMain.handle('controls-change-video', async (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        const result = await dialog.showOpenDialog(match.entry.window, {
            properties: ['openFile'],
            filters: [{ name: 'Video Files', extensions: ['webm', 'mp4', 'gif', 'webp'] }]
        });
        if (!result.canceled && result.filePaths.length > 0) {
            match.entry.window.webContents.send('load-new-video', result.filePaths[0]);
            return true;
        }
    }
    return false;
});

// Controls requests size reset → relay to buddy
ipcMain.on('controls-reset-size', (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        match.entry.window.webContents.send('reset-size');
    }
});

// Controls requests export → relay through buddy
ipcMain.handle('controls-export-buddy', async (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        match.entry.window.webContents.send('do-export');
        return true;
    }
    return false;
});

// Controls requests close buddy
ipcMain.on('controls-close-buddy', (event) => {
    const match = getEntryByControlsWebContents(event.sender);
    if (match && match.entry.window && !match.entry.window.isDestroyed()) {
        // Close controls first
        if (match.entry.controlsWindow && !match.entry.controlsWindow.isDestroyed()) {
            match.entry.controlsWindow.destroy();
        }
        // Tell buddy to save state and close
        match.entry.window.webContents.send('close-requested');
    }
});
