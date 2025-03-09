document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleScan');
  const toggleButtonText = toggleButton.querySelector('span');
  const toggleButtonIcon = toggleButton.querySelector('i');
  const captureHistory = document.getElementById('captureHistory');
  const clearHistoryButton = document.getElementById('clearHistory');
  
  let isScanning = false;
  
  // Check the current state of scanning mode
  chrome.storage.local.get(['isScanning'], (result) => {
    isScanning = result.isScanning || false;
    updateToggleButton();
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