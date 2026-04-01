const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        fullscreen: false, // Abre como janela normal
        kiosk: false,      // NÃO travar o PC
        autoHideMenuBar: false, // Permite menu se necessário
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Remove o topo nativo caso queira parecer um "App" moderno puro sem menus chatos
    mainWindow.setMenu(null);
    mainWindow.maximize(); // Maximizar na abertura

    // Carrega a URL principal do sistema para que o usuário navegue livremente
    mainWindow.loadURL('https://staging.anttechsistemas.com.br/cliente/dashboard.php');
}

// Inicialização
app.whenReady().then(() => {
    createWindow();

    // Iniciar rotina de busca de atualizações no GitHub
    autoUpdater.checkForUpdatesAndNotify();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Evento disparado quando o download da nova versão termina (em background)
autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Atualização Disponível',
        message: 'Atenção. Uma nova versão do Aplicativo Anttech Desktop foi baixada com sucesso.\n\nO sistema será fechado e reiniciado automaticamente em 5 segundos para aplicar a atualização.',
        buttons: ['Ok']
    }).then(() => {
        // Reinicia a força o App instalando o novo EXE após 5 segundos
        setTimeout(() => {
            autoUpdater.quitAndInstall();
        }, 5000);
    });
});


app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// MÓDULO DE INTEGRAÇÃO DE IMPRESSORAS NATIVAS
// ==========================================

// Retorna todas as impressoras USB/Rede instaladas no PC pra página web
ipcMain.handle('obter-impressoras', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.on('imprimir-nfce-silencioso', (event, pdfUrl, printerName) => {
    const finalUrl = "https://staging.anttechsistemas.com.br" + pdfUrl;

    let printWindow = new BrowserWindow({ 
        show: false,
        webPreferences: {
            plugins: true 
        }
    });

    printWindow.loadURL(finalUrl);

    printWindow.webContents.on('did-finish-load', () => {
        // Opções dinâmicas de impressão
        let printOptions = {
            silent: true,
            printBackground: true
        };

        // Se o PHP tiver mandado o nome da impressora salva, aplica:
        if (printerName && printerName.trim() !== '') {
            printOptions.deviceName = printerName;
        }

        printWindow.webContents.print(printOptions, (success, failureReason) => {
            if (!success) {
                console.error("Falha ao imprimir a NFC-e silenciosamente:", failureReason);
            }
            printWindow.close();
        });
    });
});
