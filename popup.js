document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleScan');
  const captureHistory = document.getElementById('captureHistory');
  const clearHistoryButton = document.getElementById('clearHistory');
  
  let isScanning = false;
  
  // Verificar o estado atual do modo de escaneamento
  chrome.storage.local.get(['isScanning'], (result) => {
    isScanning = result.isScanning || false;
    updateToggleButton();
  });
  
  // Carregar histórico de capturas
  loadCaptureHistory();
  
  // Alternar modo de escaneamento
  toggleButton.addEventListener('click', () => {
    isScanning = !isScanning;
    
    // Salvar estado
    chrome.storage.local.set({ isScanning });
    
    // Atualizar aparência do botão
    updateToggleButton();
    
    // Enviar mensagem para a página atual
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScan', isScanning });
      }
    });
  });
  
  // Limpar histórico
  clearHistoryButton.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico de capturas?')) {
      chrome.storage.local.set({ captures: [] }, () => {
        loadCaptureHistory();
      });
    }
  });
  
  // Atualizar aparência do botão de acordo com o estado
  function updateToggleButton() {
    if (isScanning) {
      toggleButton.textContent = 'Desativar Modo de Escaneamento';
      toggleButton.classList.add('active');
    } else {
      toggleButton.textContent = 'Ativar Modo de Escaneamento';
      toggleButton.classList.remove('active');
    }
  }
  
  // Carregar e exibir histórico de capturas
  function loadCaptureHistory() {
    chrome.storage.local.get(['captures'], (result) => {
      const captures = result.captures || [];
      
      if (captures.length === 0) {
        captureHistory.innerHTML = '<div class="empty-history">Nenhuma captura recente</div>';
        return;
      }
      
      captureHistory.innerHTML = '';
      
      // Exibir as 10 capturas mais recentes
      captures.slice(0, 10).forEach((capture, index) => {
        const captureItem = document.createElement('div');
        captureItem.className = 'capture-item';
        
        const date = new Date(capture.timestamp);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        captureItem.innerHTML = `
          <img src="${capture.thumbnail}" alt="Captura ${index + 1}" class="capture-thumbnail">
          <div class="capture-info">
            <div class="capture-time">${formattedDate}</div>
          </div>
          <div class="capture-actions">
            <button class="action-button copy-button" data-index="${index}">Copiar</button>
            <button class="action-button save-button" data-index="${index}">Salvar</button>
          </div>
        `;
        
        captureHistory.appendChild(captureItem);
      });
      
      // Adicionar event listeners para os botões de ação
      document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          copyImageToClipboard(captures[index].dataUrl);
        });
      });
      
      document.querySelectorAll('.save-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          saveImageLocally(captures[index].dataUrl);
        });
      });
    });
  }
  
  // Copiar imagem para a área de transferência
  function copyImageToClipboard(dataUrl) {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]).then(() => {
          showNotification('Imagem copiada para a área de transferência!');
        }).catch(err => {
          console.error('Erro ao copiar para a área de transferência:', err);
          showNotification('Erro ao copiar imagem', true);
        });
      });
  }
  
  // Salvar imagem localmente
  function saveImageLocally(dataUrl) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    chrome.downloads.download({
      url: dataUrl,
      filename: `component-capture-${timestamp}.png`,
      saveAs: true
    });
  }
  
  // Exibir notificação temporária
  function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2000);
  }
  
  // Ouvir por novas capturas
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'newCapture') {
      loadCaptureHistory();
    }
  });
}); 