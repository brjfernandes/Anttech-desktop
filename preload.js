const { contextBridge, ipcRenderer } = require('electron');

/**
 * A ponte entre o Sistema Totem em seu Servidor/Website
 * e as funcionalidades do Sistema Operacional rodando o Electron.
 */
contextBridge.exposeInMainWorld('ElectronBridge', {
    // Escuta e despacha a ordem de imprimir PDF silenciando popup
    imprimirNFCeSilencioso: (pdfUrl, printerName) => {
        ipcRenderer.send('imprimir-nfce-silencioso', pdfUrl, printerName);
    },
    // Solicita a lista de impressoras locais
    obterImpressoras: () => ipcRenderer.invoke('obter-impressoras'),
    // Retorna a versão do aplicativo Desktop
    versaoApp: () => ipcRenderer.invoke('obter-versao-app')
});
