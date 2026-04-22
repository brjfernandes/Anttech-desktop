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
    console.log('[NFC-e] Temp file:', tempFile);

    const dlHandler = (e, item) => {
        console.log('[NFC-e] will-download disparou. URL do item:', item.getURL());
        item.setSavePath(tempFile);

        item.once('done', async (e, state) => {
            console.log('[NFC-e] Download finalizado. State:', state);
            if (state !== 'completed') {
                console.error('[NFC-e] Falha no download do PDF:', state);
                return;
            }
            try {
                const pdfToPrinter = require('pdf-to-printer');
                console.log('[NFC-e] pdf-to-printer carregado. Enviando para impressora...');
                const opcoes = {
                    // noscale = imprime no tamanho original do PDF sem escalar.
                    // "fit" escalava para cima aumentando a fonte e cortando a direita.
                    printOptions: '"noscale"',
                    ...(printerName && printerName.trim() !== '' ? { printer: printerName } : {})
                };
                await pdfToPrinter.print(tempFile, opcoes);
                console.log('[NFC-e] Impressão enviada com sucesso.');
            } catch (err) {
                console.error('[NFC-e] Erro ao imprimir NFC-e:', err.message);
                console.error('[NFC-e] Stack:', err.stack);
            } finally {
                setTimeout(() => fs.unlink(tempFile, () => {}), 10000);
            }
        });
    };

    // Usa a sessão do mainWindow (garante cookies autenticados)
    const ses = mainWindow.webContents.session;
    ses.once('will-download', dlHandler);
    console.log('[NFC-e] Chamando downloadURL...');
    mainWindow.webContents.downloadURL(finalUrl);
});
