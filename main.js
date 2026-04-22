const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

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

    // Carrega a URL principal de Produção para que o usuário navegue livremente
    mainWindow.loadURL('https://anttechsistemas.com.br/login.html');
}

// Inicialização
app.whenReady().then(() => {
    createWindow();

    // Iniciar rotina de busca de atualizações no GitHub
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Log de todos os eventos do updater para diagnóstico
    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Verificando atualizações...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] Nova versão encontrada:', info.version);
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('[AutoUpdater] Nenhuma atualização disponível. Versão atual:', app.getVersion());
    });

    autoUpdater.on('download-progress', (progress) => {
        console.log(`[AutoUpdater] Baixando: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] Erro ao verificar/baixar atualização:', err.message);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Download concluído da versão:', info.version);
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Atualização Disponível',
            message: `Uma nova versão (${info.version}) do Anttech Sistemas foi baixada com sucesso.`,
            detail: 'Deseja instalar agora ou na próxima vez que abrir o sistema?',
            buttons: ['Instalar Agora', 'Instalar Depois'],
            defaultId: 0,
            cancelId: 1
        }).then((resultado) => {
            if (resultado.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    // Dispara a verificação
    autoUpdater.checkForUpdates().catch((err) => {
        console.error('[AutoUpdater] Falha ao iniciar verificação:', err.message);
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
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

// Retorna a versão atual do aplicativo Desktop
ipcMain.handle('obter-versao-app', () => {
    return app.getVersion();
});

ipcMain.on('imprimir-nfce-silencioso', (event, pdfUrl, printerName) => {
    const finalUrl = "https://anttechsistemas.com.br" + pdfUrl;
    const tempFile = path.join(os.tmpdir(), `nfce_${Date.now()}.pdf`);

    console.log('[NFC-e] Iniciando auto-print:', finalUrl);
    console.log('[NFC-e] Impressora:', printerName || '(padrão)');

    const dlHandler = (e, item) => {
        item.setSavePath(tempFile);

        item.once('done', (e, state) => {
            if (state !== 'completed') {
                console.error('[NFC-e] Falha no download do PDF:', state);
                return;
            }
            try {
                // Localizar SumatraPDF
                const isPacked = app.isPackaged;
                let sumatraPath;
                if (isPacked) {
                    sumatraPath = path.join(process.resourcesPath, 'SumatraPDF-3.4.6-32.exe');
                } else {
                    sumatraPath = path.join(__dirname, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe');
                }

                // Ler dimensões reais do PDF (MediaBox)

                const { execFile } = require('child_process');

                const printSettings = 'fit';
                const args = ['-print-settings', printSettings];

                if (printerName && printerName.trim() !== '') {
                    args.push('-print-to', printerName);
                } else {
                    args.push('-print-to-default');
                }

                args.push('-silent', tempFile);

                console.log('[NFC-e] Comando:', sumatraPath, args.join(' '));

                execFile(sumatraPath, args, (err) => {
                    if (err) {
                        console.error('[NFC-e] Erro SumatraPDF:', err.message);
                    } else {
                        console.log('[NFC-e] Impressão enviada com sucesso.');
                    }
                    setTimeout(() => fs.unlink(tempFile, () => {}), 10000);
                });
            } catch (err) {
                console.error('[NFC-e] Erro ao imprimir:', err.message);
                setTimeout(() => fs.unlink(tempFile, () => {}), 10000);
            }
        });
    };

    const ses = mainWindow.webContents.session;
    ses.once('will-download', dlHandler);
    mainWindow.webContents.downloadURL(finalUrl);
});

