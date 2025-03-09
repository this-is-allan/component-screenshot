(() => {
  let isScanning = false;
  let currentHighlightedElement = null;
  let overlay = null;
  
  // Inicializar o estado
  chrome.storage.local.get(['isScanning'], (result) => {
    if (result.isScanning) {
      startScanning();
    }
  });
  
  // Ouvir mensagens do popup ou background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleScan') {
      if (message.isScanning) {
        startScanning();
      } else {
        stopScanning();
      }
    }
    return true;
  });
  
  // Iniciar modo de escaneamento
  function startScanning() {
    if (isScanning) return;
    
    isScanning = true;
    
    // Adicionar event listeners
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true);
    
    // Mostrar overlay com instruções
    showOverlay();
    
    // Adicionar classe ao body para indicar modo de escaneamento
    document.body.classList.add('component-scanner-active');
  }
  
  // Parar modo de escaneamento
  function stopScanning() {
    if (!isScanning) return;
    
    isScanning = false;
    
    // Remover event listeners
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', handleClick, true);
    
    // Remover highlight do elemento atual
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
      currentHighlightedElement = null;
    }
    
    // Remover overlay
    hideOverlay();
    
    // Remover classe do body
    document.body.classList.remove('component-scanner-active');
  }
  
  // Manipular evento mouseover
  function handleMouseOver(event) {
    if (!isScanning) return;
    
    // Ignorar elementos do overlay
    if (isPartOfOverlay(event.target)) return;
    
    // Remover highlight do elemento anterior
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
    }
    
    // Adicionar highlight ao elemento atual
    currentHighlightedElement = event.target;
    currentHighlightedElement.classList.add('component-scanner-highlight');
  }
  
  // Manipular evento mouseout
  function handleMouseOut(event) {
    if (!isScanning || !currentHighlightedElement) return;
    
    // Remover highlight apenas se o mouseout for do elemento destacado
    if (event.target === currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
      currentHighlightedElement = null;
    }
  }
  
  // Manipular evento click
  function handleClick(event) {
    if (!isScanning || !currentHighlightedElement) return;
    
    // Ignorar elementos do overlay
    if (isPartOfOverlay(event.target)) return;
    
    // Prevenir comportamento padrão do clique
    event.preventDefault();
    event.stopPropagation();
    
    // Capturar o elemento
    captureElement(currentHighlightedElement);
    
    return false;
  }
  
  // Verificar se o elemento é parte do overlay
  function isPartOfOverlay(element) {
    return overlay && (overlay === element || overlay.contains(element));
  }
  
  // Mostrar overlay com instruções
  function showOverlay() {
    // Criar overlay se não existir
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'component-scanner-overlay';
      
      const message = document.createElement('div');
      message.className = 'component-scanner-message';
      
      message.innerHTML = `
        <h3>Modo de Escaneamento Ativo</h3>
        <p>Passe o mouse sobre um elemento e clique para capturar.</p>
        <p>Pressione ESC para sair do modo de escaneamento.</p>
      `;
      
      overlay.appendChild(message);
      
      // Adicionar evento de clique para fechar
      overlay.addEventListener('click', () => {
        stopScanning();
        chrome.storage.local.set({ isScanning: false });
      });
      
      // Adicionar evento de tecla ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isScanning) {
          stopScanning();
          chrome.storage.local.set({ isScanning: false });
        }
      });
    }
    
    // Adicionar overlay ao DOM
    document.body.appendChild(overlay);
    
    // Remover overlay após 3 segundos
    setTimeout(() => {
      hideOverlay();
    }, 3000);
  }
  
  // Esconder overlay
  function hideOverlay() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
  
  // Capturar elemento
  function captureElement(element) {
    // Obter posição e dimensões do elemento
    const rect = element.getBoundingClientRect();
    
    // Verificar se o elemento está visível
    if (rect.width === 0 || rect.height === 0) {
      showCaptureMessage('Não foi possível capturar este elemento (dimensões zero).');
      return;
    }
    
    // Usar html2canvas para capturar o elemento
    html2canvas(element, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: window.devicePixelRatio
    }).then(canvas => {
      // Converter canvas para dataURL
      const dataUrl = canvas.toDataURL('image/png');
      
      // Criar thumbnail (versão reduzida para o histórico)
      const thumbnailCanvas = document.createElement('canvas');
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      
      // Definir dimensões do thumbnail
      const maxThumbnailSize = 200;
      let thumbnailWidth = canvas.width;
      let thumbnailHeight = canvas.height;
      
      if (thumbnailWidth > thumbnailHeight) {
        if (thumbnailWidth > maxThumbnailSize) {
          thumbnailHeight = (thumbnailHeight * maxThumbnailSize) / thumbnailWidth;
          thumbnailWidth = maxThumbnailSize;
        }
      } else {
        if (thumbnailHeight > maxThumbnailSize) {
          thumbnailWidth = (thumbnailWidth * maxThumbnailSize) / thumbnailHeight;
          thumbnailHeight = maxThumbnailSize;
        }
      }
      
      thumbnailCanvas.width = thumbnailWidth;
      thumbnailCanvas.height = thumbnailHeight;
      
      // Desenhar imagem redimensionada
      thumbnailCtx.drawImage(canvas, 0, 0, thumbnailWidth, thumbnailHeight);
      
      // Obter dataURL do thumbnail
      const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/png');
      
      // Salvar captura no histórico
      chrome.storage.local.get(['captures'], (result) => {
        const captures = result.captures || [];
        
        // Adicionar nova captura ao início do array
        captures.unshift({
          dataUrl,
          thumbnail: thumbnailDataUrl,
          timestamp: Date.now(),
          url: window.location.href,
          title: document.title
        });
        
        // Limitar a 50 capturas
        if (captures.length > 50) {
          captures.pop();
        }
        
        // Salvar capturas atualizadas
        chrome.storage.local.set({ captures }, () => {
          // Notificar popup sobre nova captura
          chrome.runtime.sendMessage({ action: 'newCapture' });
          
          // Copiar para a área de transferência
          copyImageToClipboard(dataUrl);
          
          // Mostrar mensagem de sucesso
          showCaptureMessage('Componente capturado com sucesso!');
        });
      });
    }).catch(error => {
      console.error('Erro ao capturar elemento:', error);
      showCaptureMessage('Erro ao capturar o componente.', true);
    });
  }
  
  // Copiar imagem para a área de transferência
  function copyImageToClipboard(dataUrl) {
    // Criar um elemento de imagem temporário
    const img = new Image();
    img.src = dataUrl;
    
    // Quando a imagem carregar, copiar para a área de transferência
    img.onload = () => {
      // Criar um canvas temporário
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Desenhar a imagem no canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Converter para blob e copiar
      canvas.toBlob(blob => {
        try {
          // Tentar usar a Clipboard API moderna
          navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]).catch(err => {
            console.error('Erro ao copiar para a área de transferência:', err);
          });
        } catch (e) {
          console.error('Clipboard API não suportada:', e);
        }
      });
    };
  }
  
  // Mostrar mensagem de captura
  function showCaptureMessage(message, isError = false) {
    // Criar elemento de mensagem
    const messageElement = document.createElement('div');
    messageElement.className = `component-scanner-overlay`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'component-scanner-message';
    messageContent.innerHTML = `
      <h3>${isError ? 'Erro' : 'Sucesso'}</h3>
      <p>${message}</p>
    `;
    
    messageElement.appendChild(messageContent);
    
    // Adicionar ao DOM
    document.body.appendChild(messageElement);
    
    // Remover após 2 segundos
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 2000);
  }
})(); 