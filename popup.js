document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleScan');
  const toggleButtonText = toggleButton.querySelector('span');
  const toggleButtonIcon = toggleButton.querySelector('i');
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
    
    // Adicionar efeito de clique
    toggleButton.classList.add('clicked');
    setTimeout(() => {
      toggleButton.classList.remove('clicked');
    }, 200);
    
    // Salvar estado
    chrome.storage.local.set({ isScanning });
    
    // Atualizar aparência do botão
    updateToggleButton();
    
    // Enviar mensagem para a página atual
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScan', isScanning });
        
        // Mostrar notificação
        if (isScanning) {
          showNotification('<i class="fas fa-check-circle"></i> Modo de escaneamento ativado');
        } else {
          showNotification('<i class="fas fa-info-circle"></i> Modo de escaneamento desativado');
        }
      }
    });
  });
  
  // Limpar histórico
  clearHistoryButton.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico de capturas?')) {
      chrome.storage.local.set({ captures: [] }, () => {
        loadCaptureHistory();
        showNotification('<i class="fas fa-trash"></i> Histórico limpo com sucesso');
      });
    }
  });
  
  // Atualizar aparência do botão de acordo com o estado
  function updateToggleButton() {
    if (isScanning) {
      toggleButtonText.textContent = 'Desativar Escaneamento';
      toggleButtonIcon.className = 'fas fa-stop';
      toggleButton.classList.add('active');
    } else {
      toggleButtonText.textContent = 'Ativar Escaneamento';
      toggleButtonIcon.className = 'fas fa-camera';
      toggleButton.classList.remove('active');
    }
  }
  
  // Carregar e exibir histórico de capturas
  function loadCaptureHistory() {
    chrome.storage.local.get(['captures'], (result) => {
      const captures = result.captures || [];
      
      if (captures.length === 0) {
        captureHistory.innerHTML = `
          <div class="empty-history">
            <i class="fas fa-camera-retro"></i>
            <p>Nenhuma captura recente</p>
          </div>
        `;
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
            <div class="capture-time"><i class="far fa-clock"></i> ${formattedDate}</div>
          </div>
          <div class="capture-actions">
            <button class="action-button copy-button" data-index="${index}" title="Copiar para área de transferência">
              <i class="far fa-copy"></i> Copiar
            </button>
            <button class="action-button save-button" data-index="${index}" title="Salvar no computador">
              <i class="fas fa-download"></i> Salvar
            </button>
          </div>
        `;
        
        captureHistory.appendChild(captureItem);
        
        // Adicionar efeito de entrada
        setTimeout(() => {
          captureItem.classList.add('show');
        }, index * 50);
      });
      
      // Adicionar event listeners para os botões de ação
      document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('.copy-button').dataset.index);
          copyImageToClipboard(captures[index].dataUrl);
        });
      });
      
      document.querySelectorAll('.save-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('.save-button').dataset.index);
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
          showNotification('<i class="fas fa-check-circle"></i> Imagem copiada para a área de transferência!');
        }).catch(err => {
          console.error('Erro ao copiar para a área de transferência:', err);
          showNotification('<i class="fas fa-exclamation-circle"></i> Erro ao copiar imagem', true);
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
    
    showNotification('<i class="fas fa-download"></i> Salvando imagem...');
  }
  
  // Exibir notificação temporária
  function showNotification(message, isError = false) {
    // Remover notificações existentes
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.innerHTML = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2500);
  }
  
  // Ouvir por novas capturas
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'newCapture') {
      loadCaptureHistory();
      showNotification('<i class="fas fa-camera"></i> Nova captura adicionada!');
    }
  });
}); 