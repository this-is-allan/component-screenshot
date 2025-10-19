document.addEventListener('DOMContentLoaded', () => {
  // Tab elements
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  const toggleButton = document.getElementById('toggleScan');
  const toggleButtonGenerator = document.getElementById('toggleScanGenerator');
  const captureHistory = document.getElementById('captureHistory');
  const clearHistoryButton = document.getElementById('clearHistory');

  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const formatButtons = document.querySelectorAll('.format-btn');
  const mediaQueryToggle = document.getElementById('mediaQueryToggle');
  const generateComponentButton = document.getElementById('generateComponent');
  const generatedCodeContainer = document.getElementById('generatedCode');
  const codeContent = document.getElementById('codeContent');
  const copyCodeButton = document.getElementById('copyCode');

  let isScanning = false;
  let selectedCapture = null;
  let selectedComponentFormat = 'html'; // Default selection
  let selectedStyleFormat = 'tailwind'; // Default selection
  let mediaQueryEnabled = false; // Default selection

  // Tab switching logic
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');

      // Save active tab to storage
      chrome.storage.local.set({ activeTab: targetTab });
    });
  });

  // Restore active tab from storage
  chrome.storage.local.get(['activeTab'], (result) => {
    if (result.activeTab) {
      const targetButton = document.querySelector(`[data-tab="${result.activeTab}"]`);
      if (targetButton) {
        targetButton.click();
      }
    }
  });

  chrome.storage.local.get(['isScanning', 'apiKey', 'showCaptureSuccess', 'lastCaptureTime', 'enableClickWidget', 'autoCapture'], (result) => {
    isScanning = result.isScanning || false;
    updateToggleButton();

    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      updateGenerateButtonState();
    }

    // Set settings defaults
    const clickWidgetToggle = document.getElementById('clickWidgetToggle');
    const autoCaptureToggle = document.getElementById('autoCaptureToggle');

    if (clickWidgetToggle) {
      clickWidgetToggle.checked = result.enableClickWidget !== false;
    }

    if (autoCaptureToggle) {
      autoCaptureToggle.checked = result.autoCapture === true;
    }

    // Check if we should show capture success message
    if (result.showCaptureSuccess && result.lastCaptureTime) {
      const timeSinceCapture = Date.now() - result.lastCaptureTime;
      // Only show if capture was within the last 10 seconds
      if (timeSinceCapture < 10000) {
        showNotification('<i class="fas fa-check-circle"></i> Element captured successfully! Check the history below.');

        // Clear the flag
        chrome.storage.local.set({ showCaptureSuccess: false });
      }
    }
  });

  // Format button selection logic
  formatButtons.forEach(button => {
    button.addEventListener('click', () => {
      const category = button.getAttribute('data-category');
      const format = button.getAttribute('data-format');
      
      // Remove active class from buttons in the same category
      const categoryButtons = document.querySelectorAll(`[data-category="${category}"]`);
      categoryButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Update selected format based on category
      if (category === 'component') {
        selectedComponentFormat = format;
        chrome.storage.local.set({ selectedComponentFormat });
      } else if (category === 'style') {
        selectedStyleFormat = format;
        chrome.storage.local.set({ selectedStyleFormat });
      }
    });
  });

  // Media query toggle logic
  mediaQueryToggle.addEventListener('change', () => {
    mediaQueryEnabled = mediaQueryToggle.checked;
    chrome.storage.local.set({ mediaQueryEnabled });
  });

  // Restore selections from storage
  chrome.storage.local.get(['selectedComponentFormat', 'selectedStyleFormat', 'mediaQueryEnabled'], (result) => {
    if (result.selectedComponentFormat) {
      selectedComponentFormat = result.selectedComponentFormat;
      const activeButton = document.querySelector(`[data-category="component"][data-format="${selectedComponentFormat}"]`);
      if (activeButton) {
        document.querySelectorAll('[data-category="component"]').forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
      }
    }

    if (result.selectedStyleFormat) {
      selectedStyleFormat = result.selectedStyleFormat;
      const activeButton = document.querySelector(`[data-category="style"][data-format="${selectedStyleFormat}"]`);
      if (activeButton) {
        document.querySelectorAll('[data-category="style"]').forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
      }
    }

    if (result.mediaQueryEnabled !== undefined) {
      mediaQueryEnabled = result.mediaQueryEnabled;
      mediaQueryToggle.checked = mediaQueryEnabled;
    }
  });

  loadCaptureHistory();

  // Listen for messages from content script (e.g., when scanning stops after capture)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggleScan' && message.isScanning === false) {
      isScanning = false;
      updateToggleButton();
      updateToggleButtonGenerator();
    }

    if (message.action === 'newCapture') {
      loadCaptureHistory();
    }
  });

  // Function to handle scan toggle
  function handleScanToggle() {
    isScanning = !isScanning;
    chrome.storage.local.set({ isScanning });
    updateToggleButton();
    updateToggleButtonGenerator();

    try {
      chrome.runtime.sendMessage({ action: 'toggleScan', isScanning }, response => {
        if (chrome.runtime.lastError) {
          console.log('Error notifying background:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.log('Error sending message to background:', error);
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScan', isScanning }, response => {
            if (chrome.runtime.lastError) {
              console.log('Error sending message to tab:', chrome.runtime.lastError.message);
              chrome.runtime.sendMessage({
                action: 'toggleScan',
                isScanning,
                forceInjection: true
              });
            } else {
              showNotification(
                isScanning
                  ? '<i class="fas fa-check-circle"></i> Scanning enabled'
                  : '<i class="fas fa-info-circle"></i> Scanning disabled'
              );
            }
          });
        } catch (error) {
          console.log('Error sending message to tab:', error);
        }
      }
    });

    // Fechar o popup quando iniciar o escaneamento
    if (isScanning) {
      setTimeout(() => {
        window.close();
      }, 100);
    }
  }

  if (toggleButton) {
    toggleButton.addEventListener('click', handleScanToggle);
  }
  toggleButtonGenerator.addEventListener('click', handleScanToggle);

  clearHistoryButton.addEventListener('click', () => {
    if (confirm('Clear all captures?')) {
      chrome.storage.local.set({ captures: [] }, () => {
        selectedCapture = null;
        loadCaptureHistory();
        updateGenerateButtonState();
        showNotification('<i class="fas fa-trash"></i> History cleared');
      });
    }
  });

  saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();

    if (apiKey) {
      chrome.storage.local.set({ apiKey }, () => {
        showNotification('<i class="fas fa-check"></i> API key saved');
        updateGenerateButtonState();
      });
    } else {
      showNotification('<i class="fas fa-exclamation-circle"></i> Enter a valid API key', true);
    }
  });

  // Settings toggle listeners
  const clickWidgetToggle = document.getElementById('clickWidgetToggle');
  const autoCaptureToggle = document.getElementById('autoCaptureToggle');

  if (clickWidgetToggle) {
    clickWidgetToggle.addEventListener('change', () => {
      const enabled = clickWidgetToggle.checked;
      chrome.storage.local.set({ enableClickWidget: enabled });

      // Send message to content script to toggle click widget
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleClickWidget',
            enabled: enabled
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Error toggling click widget:', chrome.runtime.lastError.message);
            }
          });
        }
      });

      showNotification(`<i class="fas fa-${enabled ? 'check' : 'times'}"></i> Click widget ${enabled ? 'enabled' : 'disabled'}`);
    });
  }

  if (autoCaptureToggle) {
    autoCaptureToggle.addEventListener('change', () => {
      const enabled = autoCaptureToggle.checked;
      chrome.storage.local.set({ autoCapture: enabled });

      showNotification(`<i class="fas fa-${enabled ? 'check' : 'times'}"></i> Auto-capture ${enabled ? 'enabled' : 'disabled'}`);
    });
  }

  async function performCodeGeneration(capture, button) {
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;

    if (!apiKey) {
      showNotification('<i class="fas fa-exclamation-circle"></i> API key required', true);
      return;
    }

    const originalButtonHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<div class="loading-spinner"></div> Generating...';

    generatedCodeContainer.classList.remove('hidden');
    codeContent.textContent = 'Generating code...';

    const componentFormat = selectedComponentFormat;
    const styleFormat = selectedStyleFormat;
    const includeMediaQuery = mediaQueryEnabled;

    try {
      const code = await generateCode(capture.dataUrl, apiKey, componentFormat, styleFormat, includeMediaQuery);
      codeContent.textContent = code;
      showNotification('<i class="fas fa-check-circle"></i> Code generated!');

      // Save generated code to the capture
      chrome.storage.local.get(['captures'], (storageResult) => {
        const captures = storageResult.captures || [];
        const captureIndex = captures.findIndex(c => c.timestamp === capture.timestamp);
        if (captureIndex !== -1) {
          captures[captureIndex].generatedCode = code;
          captures[captureIndex].componentFormat = componentFormat;
          captures[captureIndex].styleFormat = styleFormat;
          captures[captureIndex].mediaQueryEnabled = includeMediaQuery;
          chrome.storage.local.set({ captures }, () => {
            loadCaptureHistory();
          });
        }
      });

      // Scroll to the generated code
      generatedCodeContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      codeContent.textContent = `Error: ${error.message}`;
      showNotification('<i class="fas fa-exclamation-circle"></i> Generation failed', true);
    } finally {
      button.disabled = false;
      button.innerHTML = originalButtonHTML;
    }
  }

  generateComponentButton.addEventListener('click', async () => {
    if (!selectedCapture) {
      showNotification('<i class="fas fa-exclamation-circle"></i> Please select a capture from history', true);
      return;
    }
    await performCodeGeneration(selectedCapture, generateComponentButton);
  });

  copyCodeButton.addEventListener('click', () => {
    const code = codeContent.textContent;

    navigator.clipboard.writeText(code)
      .then(() => {
        showNotification('<i class="fas fa-check"></i> Code copied!');
      })
      .catch(err => {
        console.error('Error copying code:', err);
        showNotification('<i class="fas fa-exclamation-circle"></i> Copy failed', true);
      });
  });

  function updateToggleButton() {
    if (!toggleButton) return;
    const label = toggleButton.querySelector('.scan-toggle-label');
    const hint = toggleButton.querySelector('.scan-toggle-hint');
    const icon = toggleButton.querySelector('.scan-toggle-icon i');

    if (isScanning) {
      label.textContent = 'Stop Scanning';
      hint.textContent = 'Click to disable scan mode';
      icon.className = 'fas fa-stop';
      toggleButton.classList.add('active');
    } else {
      label.textContent = 'Start Scanning';
      hint.textContent = 'Hover over elements to capture';
      icon.className = 'fas fa-camera';
      toggleButton.classList.remove('active');
    }
  }

  function updateToggleButtonGenerator() {
    if (!toggleButtonGenerator) return;
    const label = toggleButtonGenerator.querySelector('.scan-toggle-label');
    const hint = toggleButtonGenerator.querySelector('.scan-toggle-hint');
    const icon = toggleButtonGenerator.querySelector('.scan-toggle-icon i');

    if (isScanning) {
      label.textContent = 'Stop Scanning';
      hint.textContent = 'Click to disable scan mode';
      icon.className = 'fas fa-stop';
      toggleButtonGenerator.classList.add('active');
    } else {
      label.textContent = 'Start Scanning';
      hint.textContent = 'Hover over elements to capture';
      icon.className = 'fas fa-camera';
      toggleButtonGenerator.classList.remove('active');
    }
  }

  function loadCaptureHistory() {
    chrome.storage.local.get(['captures'], (result) => {
      const captures = result.captures || [];

      if (captures.length === 0) {
        captureHistory.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <i class="fas fa-camera-retro"></i>
            </div>
            <p class="empty-state-text">No captures yet</p>
            <p class="empty-state-hint">Start scanning to capture elements</p>
          </div>
        `;
        return;
      }

      captureHistory.innerHTML = '';

      captures.slice(0, 10).forEach((capture, index) => {
        const card = document.createElement('div');
        card.className = 'capture-card';
        if (selectedCapture && selectedCapture.timestamp === capture.timestamp) {
          card.classList.add('selected');
        }

        const date = new Date(capture.timestamp);
        const timeStr = formatTime(date);

        const hasCode = capture.generatedCode ? true : false;
        card.innerHTML = `
          <img src="${capture.thumbnail}" alt="Capture" class="capture-image">
          <div class="capture-overlay">
            <span class="capture-time">
              <i class="far fa-clock"></i>
              ${timeStr}
            </span>
            <div class="capture-actions">
              ${hasCode ? `<button class="capture-action view-code-action" title="View Code">
                <i class="fas fa-code"></i>
              </button>` : ''}
              <button class="capture-action copy-action" title="Copy">
                <i class="far fa-copy"></i>
              </button>
              <button class="capture-action save-action" title="Download">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>
          ${hasCode ? '<div class="code-badge"><i class="fas fa-check-circle"></i></div>' : ''}
        `;

        card.addEventListener('click', (e) => {
          if (e.target.closest('.capture-action')) {
            return;
          }

          document.querySelectorAll('.capture-card').forEach(c => { c.classList.remove('selected'); });
          card.classList.add('selected');
          selectedCapture = capture;
          updateGenerateButtonState();
          showNotification('<i class="fas fa-check"></i> Capture selected');
        });

        const viewCodeBtn = card.querySelector('.view-code-action');
        if (viewCodeBtn) {
          viewCodeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            codeContent.textContent = capture.generatedCode;
            generatedCodeContainer.classList.remove('hidden');
            showNotification('<i class="fas fa-code"></i> Code loaded');
            // Switch to generator tab to show code
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            const generatorTab = document.querySelector('[data-tab="generator"]');
            const generatorContent = document.getElementById('generator-tab');
            generatorTab.classList.add('active');
            generatorContent.classList.add('active');
            // Scroll to code
            setTimeout(() => {
              generatedCodeContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          });
        }

        const copyBtn = card.querySelector('.copy-action');
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          copyImageToClipboard(capture.dataUrl);
        });

        const saveBtn = card.querySelector('.save-action');
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          saveImageLocally(capture.dataUrl);
        });

        captureHistory.appendChild(card);
      });
    });
  }

  function updateGenerateButtonState() {
    chrome.storage.local.get(['apiKey'], (result) => {
      generateComponentButton.disabled = !result.apiKey || !selectedCapture;
    });
  }


  function formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  function copyImageToClipboard(dataUrl) {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]).then(() => {
          showNotification('<i class="fas fa-check"></i> Image copied!');
        }).catch(err => {
          console.error('Error copying:', err);
          showNotification('<i class="fas fa-exclamation-circle"></i> Copy failed', true);
        });
      });
  }

  function saveImageLocally(dataUrl) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    chrome.downloads.download({
      url: dataUrl,
      filename: `capture-${timestamp}.png`,
      saveAs: true
    });

    showNotification('<i class="fas fa-download"></i> Downloading...');
  }

  async function generateCode(imageDataUrl, apiKey, componentFormat, styleFormat, includeMediaQuery) {
    try {
      let prompt = "";
      
      // Build prompt based on component format
      if (componentFormat === 'html') {
        prompt = "Create HTML and CSS code that looks exactly like this UI element.";
        
        // Add styling instructions based on style format
        if (styleFormat === 'inline') {
          prompt += " Use inline CSS styles directly on HTML elements.";
        } else if (styleFormat === 'external') {
          prompt += " Use external CSS with a separate stylesheet. Include both HTML file and CSS file.";
        } else if (styleFormat === 'local') {
          prompt += " Use local CSS with a <style> tag in the <head> section.";
        } else if (styleFormat === 'tailwind') {
          prompt += " Use Tailwind CSS v4 utility classes for styling.";
        }
        
        prompt += " Provide clean, semantic HTML with proper structure.";
        
      } else if (componentFormat === 'jsx') {
        prompt = "Create a React JSX component that looks exactly like this UI element. Use functional components and hooks.";
        
        // Add styling instructions based on style format
        if (styleFormat === 'inline') {
          prompt += " Use inline styles with the style prop.";
        } else if (styleFormat === 'external') {
          prompt += " Use external CSS with a separate stylesheet. Include both JSX component and CSS file.";
        } else if (styleFormat === 'local') {
          prompt += " Use CSS modules or local CSS classes.";
        } else if (styleFormat === 'tailwind') {
          prompt += " Use Tailwind CSS v4 utility classes for styling.";
        }
      }
      
      // Add media query instruction if enabled
      if (includeMediaQuery) {
        prompt += " Include responsive design beyond 768px and 1024px breakpoints using media queries.";
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  image_url: { url: imageDataUrl }
                }
              ]
            }
          ],
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Updated regex to support HTML, CSS, and React code blocks
      const codeBlockRegex = /```(?:html|css|jsx|tsx|javascript|js|react)?([\s\S]*?)```/;
      const match = content.match(codeBlockRegex);

      if (match?.[1]) {
        return match[1].trim();
      }

      return content;
    } catch (error) {
      console.error('Error generating code:', error);
      throw error;
    }
  }

  function showNotification(message, isError = false) {
    document.querySelectorAll('.notification').forEach(n => { n?.remove(); });

    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.innerHTML = message;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'newCapture') {
      loadCaptureHistory();
      showNotification('<i class="fas fa-camera"></i> New capture added!');
      if (sendResponse) sendResponse({ status: 'received' });
    }
    return true;
  });
});
