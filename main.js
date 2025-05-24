const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;
let manualWindow;

function createWindow() {
  // Create the main browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // Allows renderer process to use Node.js (for simplicity here)
      contextIsolation: false, // For simplicity; consider true + preload script for production
      devTools: true // Enable DevTools by default for development
    },
    icon: path.join(__dirname, 'icon.png') // Optional: if you have an icon.png
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools (optional, good for debugging)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
    if (manualWindow) {
        manualWindow.close();
    }
  });
}

function createManualWindow() {
    if (manualWindow) {
        manualWindow.focus();
        return;
    }
    manualWindow = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'Manual do Usuário',
        webPreferences: {
            nodeIntegration: false, // Manual is just HTML, no Node needed
            contextIsolation: true
        },
        parent: mainWindow, // Optional: make it a child of the main window
        modal: false       // Optional: if true, blocks interaction with parent
    });
    manualWindow.loadFile('MANUAL DO USUÁRIO.html');
    manualWindow.setMenuBarVisibility(false); // Hide default menu for manual

    manualWindow.on('closed', () => {
        manualWindow = null;
    });
}

// Menu template
const menuTemplate = [
  {
    label: 'Arquivo',
    submenu: [
      { role: 'quit', label: 'Sair' }
    ]
  },
  {
    label: 'Editar',
    submenu: [
      { role: 'undo', label: 'Desfazer' },
      { role: 'redo', label: 'Refazer' },
      { type: 'separator' },
      { role: 'cut', label: 'Recortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Colar' },
      { role: 'selectAll', label: 'Selecionar Tudo' }
    ]
  },
  {
    label: 'Visualizar',
    submenu: [
      { role: 'reload', label: 'Recarregar' },
      { role: 'forceReload', label: 'Forçar Recarregar' },
      { role: 'toggleDevTools', label: 'Alternar Ferramentas de Desenvolvedor' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Restaurar Zoom' },
      { role: 'zoomIn', label: 'Aumentar Zoom' },
      { role: 'zoomOut', label: 'Diminuir Zoom' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Tela Cheia' }
    ]
  },
  {
    label: 'Ajuda',
    submenu: [
      {
        label: 'Manual do Usuário',
        click: () => {
          createManualWindow();
        }
      },
      {
        label: 'Sobre',
        click: async () => {
          const { shell } = require('electron');
          // You can open a link to your project's GitHub or a simple "About" dialog
          // For a simple dialog:
          const os = require('os');
          const dialog = require('electron').dialog;
          dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre o Sistema de Montagem de Planos',
              message: 'Sistema de Montagem de Planos',
              detail: `Versão: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nPlataforma: ${os.type()} ${os.arch()} ${os.release()}`
          });
        }
      }
    ]
  }
];


// This method will be called when Electron has finished initialization
// and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});