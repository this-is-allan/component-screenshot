document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleScan');
  const toggleButtonText = toggleButton.querySelector('span');
  const toggleButtonIcon = toggleButton.querySelector('i');
  const captureHistory = document.getElementById('captureHistory');
  const clearHistoryButton = document.getElementById('clearHistory');
  
  // Elementos da seção de IA
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const componentTypeSelect = document.getElementById('componentType');
  const generateComponentButton = document.getElementById('generateComponent');
  const generatedCodeContainer = document.getElementById('generatedCode');
  const codeContent = document.getElementById('codeContent');
  const copyCodeButton = document.getElementById('copyCode');
  
  let isScanning = false;
  let selectedCapture = null;
  
  // Check the current state of scanning mode
  chrome.storage.local.get(['isScanning', 'apiKey'], (result) => {
    isScanning = result.isScanning || false;
    updateToggleButton();
    
    // Preencher a chave da API se estiver salva
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      generateComponentButton.disabled = false;
    }
  });
  
  // Load capture history
  loadCaptureHistory();
  
  // Toggle scanning mode
  toggleButton.addEventListener('click', () => {
    isScanning = !isScanning;
    
    // Add click effect
    toggleButton.classList.add('clicked');
    setTimeout(() => {
      toggleButton.classList.remove('clicked');
    }, 200);
    
    // Save state
    chrome.storage.local.set({ isScanning });
    
    // Update button appearance
    updateToggleButton();
    
    // Send message to current page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScan', isScanning });
        
        // Show notification
        if (isScanning) {
          showNotification('<i class="fas fa-check-circle"></i> Scanning mode enabled');
        } else {
          showNotification('<i class="fas fa-info-circle"></i> Scanning mode disabled');
        }
      }
    });
  });
  
  // Clear history
  clearHistoryButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all capture history?')) {
      chrome.storage.local.set({ captures: [] }, () => {
        loadCaptureHistory();
        showNotification('<i class="fas fa-trash"></i> History cleared successfully');
      });
    }
  });
  
  // Salvar a chave da API
  saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (apiKey) {
      chrome.storage.local.set({ apiKey }, () => {
        showNotification('<i class="fas fa-key"></i> API key saved successfully');
        generateComponentButton.disabled = false;
      });
    } else {
      showNotification('<i class="fas fa-exclamation-circle"></i> Please enter a valid API key', true);
    }
  });
  
  // Gerar componente React
  generateComponentButton.addEventListener('click', () => {
    if (!selectedCapture) {
      showNotification('<i class="fas fa-exclamation-circle"></i> Please select an image first', true);
      return;
    }
    
    chrome.storage.local.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;
      
      if (!apiKey) {
        showNotification('<i class="fas fa-exclamation-circle"></i> API key is required', true);
        return;
      }
      
      // Mostrar estado de carregamento
      generateComponentButton.disabled = true;
      generateComponentButton.innerHTML = '<div class="loading-spinner"></div> Generating...';
      
      // Mostrar o container de código
      generatedCodeContainer.classList.remove('hidden');
      codeContent.textContent = 'Generating component...';
      
      // Obter o tipo de componente selecionado
      const componentType = componentTypeSelect.value;
      
      // Enviar a imagem para a API da OpenAI
      generateReactComponent(selectedCapture.dataUrl, apiKey, componentType)
        .then(code => {
          codeContent.textContent = code;
          showNotification('<i class="fas fa-check-circle"></i> Component generated successfully!');
        })
        .catch(error => {
          codeContent.textContent = `Error: ${error.message}`;
          showNotification('<i class="fas fa-exclamation-circle"></i> Error generating component', true);
        })
        .finally(() => {
          generateComponentButton.disabled = false;
          generateComponentButton.innerHTML = '<i class="fas fa-magic"></i> Generate Component';
        });
    });
  });
  
  // Copiar código gerado
  copyCodeButton.addEventListener('click', () => {
    const code = codeContent.textContent;
    
    navigator.clipboard.writeText(code)
      .then(() => {
        showNotification('<i class="fas fa-check-circle"></i> Code copied to clipboard!');
      })
      .catch(err => {
        console.error('Error copying code:', err);
        showNotification('<i class="fas fa-exclamation-circle"></i> Error copying code', true);
      });
  });
  
  // Update button appearance according to state
  function updateToggleButton() {
    if (isScanning) {
      toggleButtonText.textContent = 'Disable Scanning';
      toggleButtonIcon.className = 'fas fa-stop';
      toggleButton.classList.add('active');
    } else {
      toggleButtonText.textContent = 'Enable Scanning';
      toggleButtonIcon.className = 'fas fa-camera';
      toggleButton.classList.remove('active');
    }
  }
  
  // Load and display capture history
  function loadCaptureHistory() {
    chrome.storage.local.get(['captures'], (result) => {
      const captures = result.captures || [];
      
      if (captures.length === 0) {
        captureHistory.innerHTML = `
          <div class="empty-history">
            <i class="fas fa-camera-retro"></i>
            <p>No recent captures</p>
          </div>
        `;
        return;
      }
      
      captureHistory.innerHTML = '';
      
      // Display the 10 most recent captures
      captures.slice(0, 10).forEach((capture, index) => {
        const captureItem = document.createElement('div');
        captureItem.className = 'capture-item';
        
        const date = new Date(capture.timestamp);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        captureItem.innerHTML = `
          <img src="${capture.thumbnail}" alt="Capture ${index + 1}" class="capture-thumbnail">
          <div class="capture-info">
            <div class="capture-time"><i class="far fa-clock"></i> ${formattedDate}</div>
          </div>
          <div class="capture-actions">
            <button class="action-button copy-button" data-index="${index}" title="Copy to clipboard">
              <i class="far fa-copy"></i> Copy
            </button>
            <button class="action-button save-button" data-index="${index}" title="Save to computer">
              <i class="fas fa-download"></i> Save
            </button>
            <button class="action-button select-button" data-index="${index}" title="Select for AI">
              <i class="fas fa-magic"></i> Select
            </button>
          </div>
        `;
        
        captureHistory.appendChild(captureItem);
        
        // Add entry effect
        setTimeout(() => {
          captureItem.classList.add('show');
        }, index * 50);
      });
      
      // Add event listeners for action buttons
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
      
      // Adicionar evento para selecionar imagem para IA
      document.querySelectorAll('.select-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('.select-button').dataset.index);
          
          // Remover seleção anterior
          document.querySelectorAll('.capture-item').forEach(item => {
            item.classList.remove('selected');
          });
          
          // Adicionar seleção atual
          e.target.closest('.capture-item').classList.add('selected');
          
          // Armazenar a captura selecionada
          selectedCapture = captures[index];
          
          // Habilitar o botão de geração se tiver uma chave de API
          chrome.storage.local.get(['apiKey'], (result) => {
            if (result.apiKey) {
              generateComponentButton.disabled = false;
            }
          });
          
          showNotification('<i class="fas fa-check-circle"></i> Image selected for AI generation');
        });
      });
    });
  }
  
  // Copy image to clipboard
  function copyImageToClipboard(dataUrl) {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]).then(() => {
          showNotification('<i class="fas fa-check-circle"></i> Image copied to clipboard!');
        }).catch(err => {
          console.error('Error copying to clipboard:', err);
          showNotification('<i class="fas fa-exclamation-circle"></i> Error copying image', true);
        });
      });
  }
  
  // Save image locally
  function saveImageLocally(dataUrl) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    chrome.downloads.download({
      url: dataUrl,
      filename: `component-capture-${timestamp}.png`,
      saveAs: true
    });
    
    showNotification('<i class="fas fa-download"></i> Saving image...');
  }
  
  // Gerar componente React usando a API da OpenAI
  async function generateReactComponent(imageDataUrl, apiKey, componentType) {
    try {
      // Converter dataURL para Blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      // Criar FormData para enviar a imagem
      const formData = new FormData();
      formData.append('image', blob, 'screenshot.png');
      
      // Determinar o prompt com base no tipo de componente
      let prompt = "Create a React component that looks exactly like this UI element. Use functional components and hooks.";
      
      if (componentType === 'react-tailwind') {
        prompt = "Create a React component that looks exactly like this UI element. Use functional components, hooks, and Tailwind CSS for styling.";
      } else if (componentType === 'react-styled') {
        prompt = "Create a React component that looks exactly like this UI element. Use functional components, hooks, and styled-components for styling.";
      }
      
      // Configurar a requisição para a API da OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 2000
        })
      });
      
      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        throw new Error(errorData.error?.message || 'Error calling OpenAI API');
      }
      
      const data = await openaiResponse.json();
      
      // Extrair o código da resposta
      const content = data.choices[0].message.content;
      
      // Extrair o bloco de código da resposta
      const codeBlockRegex = /```(?:jsx|tsx|javascript|js|react)?([\s\S]*?)```/;
      const match = content.match(codeBlockRegex);
      
      if (match && match[1]) {
        return match[1].trim();
      }
      
      // Se não encontrar um bloco de código, retornar o conteúdo completo
      return content;
    } catch (error) {
      console.error('Error generating component:', error);
      throw error;
    }
  }
  
  // Display temporary notification
  function showNotification(message, isError = false) {
    // Remove existing notifications
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
  
  // Listen for new captures
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'newCapture') {
      loadCaptureHistory();
      showNotification('<i class="fas fa-camera"></i> New capture added!');
    }
  });
}); 