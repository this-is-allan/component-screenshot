// Listener para quando a extensão é instalada ou atualizada
chrome.runtime.onInstalled.addListener(() => {
  // Inicializar o estado da extensão
  chrome.storage.local.set({
    isScanning: false,
    captures: []
  });
  
  console.log('ComponentCapture: Extensão instalada/atualizada com sucesso!');
});

// Listener para mensagens de outros scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Repassar mensagens relevantes para o popup se estiver aberto
  if (message.action === 'newCapture') {
    chrome.runtime.sendMessage({ action: 'newCapture' });
  }
  
  return true;
});

// Listener para cliques no ícone da extensão
chrome.action.onClicked.addListener((tab) => {
  // Se o usuário clicar no ícone da extensão sem abrir o popup,
  // podemos alternar o modo de escaneamento diretamente
  chrome.storage.local.get(['isScanning'], (result) => {
    const newState = !result.isScanning;
    
    chrome.storage.local.set({ isScanning: newState });
    
    // Enviar mensagem para a página atual
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleScan', 
      isScanning: newState 
    });
  });
}); 