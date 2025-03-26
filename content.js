(() => {
  let isScanning = false;
  let currentHighlightedElement = null;
  let overlay = null;
  
  // Initialize state
  chrome.storage.local.get(['isScanning'], (result) => {
    if (result.isScanning) {
      startScanning();
    }
  });
  
  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleScan') {
      if (message.isScanning) {
        startScanning();
      } else {
        stopScanning();
      }
    }
    
    // Responder ao ping do background script para verificar se o content script está carregado
    if (message.action === 'ping') {
      sendResponse({ status: 'content_script_loaded' });
    }
    
    return true;
  });
  
  // Start scanning mode
  function startScanning() {
    if (isScanning) return;
    
    isScanning = true;
    
    // Add event listeners
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true);
    
    // Show overlay with instructions
    showOverlay();
    
    // Add class to body to indicate scanning mode
    document.body.classList.add('component-scanner-active');
  }
  
  // Stop scanning mode
  function stopScanning() {
    if (!isScanning) return;
    
    isScanning = false;
    
    // Remove event listeners
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', handleClick, true);
    
    // Remove highlight from current element
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
      currentHighlightedElement = null;
    }
    
    // Remove overlay
    hideOverlay();
    
    // Remove class from body
    document.body.classList.remove('component-scanner-active');
  }
  
  // Handle mouseover event
  function handleMouseOver(event) {
    if (!isScanning) return;
    
    // Ignore overlay elements
    if (isPartOfOverlay(event.target)) return;
    
    // Remove highlight from previous element
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
    }
    
    // Add highlight to current element
    currentHighlightedElement = event.target;
    currentHighlightedElement.classList.add('component-scanner-highlight');
  }
  
  // Handle mouseout event
  function handleMouseOut(event) {
    if (!isScanning || !currentHighlightedElement) return;
    
    // Remove highlight only if mouseout is from the highlighted element
    if (event.target === currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
      currentHighlightedElement = null;
    }
  }
  
  // Handle click event
  function handleClick(event) {
    if (!isScanning || !currentHighlightedElement) return;
    
    // Ignore overlay elements
    if (isPartOfOverlay(event.target)) return;
    
    // Prevent default click behavior
    event.preventDefault();
    event.stopPropagation();
    
    // Capture the element
    captureElement(currentHighlightedElement);
    
    return false;
  }
  
  // Check if element is part of the overlay
  function isPartOfOverlay(element) {
    return overlay && (overlay === element || overlay.contains(element));
  }
  
  // Show overlay with instructions
  function showOverlay() {
    // Create overlay if it doesn't exist
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'component-scanner-overlay';
      
      const message = document.createElement('div');
      message.className = 'component-scanner-message';
      
      message.innerHTML = `
        <h3>Scanning Mode Active</h3>
        <p>Hover over an element and click to capture it.</p>
        <p>Press ESC to exit scanning mode.</p>
      `;
      
      overlay.appendChild(message);
      
      // Add click event to close
      overlay.addEventListener('click', () => {
        stopScanning();
        chrome.storage.local.set({ isScanning: false });
      });
      
      // Add ESC key event
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isScanning) {
          stopScanning();
          chrome.storage.local.set({ isScanning: false });
        }
      });
    }
    
    // Add overlay to DOM
    document.body.appendChild(overlay);
    
    // Remove overlay after 3 seconds
    setTimeout(() => {
      hideOverlay();
    }, 3000);
  }
  
  // Hide overlay
  function hideOverlay() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
  
  // Capture element
  function captureElement(element) {
    // Get position and dimensions of the element
    const rect = element.getBoundingClientRect();
    
    // Check if element is visible
    if (rect.width === 0 || rect.height === 0) {
      showCaptureMessage('Could not capture this element (zero dimensions).');
      return;
    }
    
    // Use html2canvas to capture the element
    html2canvas(element, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: window.devicePixelRatio
    }).then(canvas => {
      // Convert canvas to dataURL
      const dataUrl = canvas.toDataURL('image/png');
      
      // Create thumbnail (reduced version for history)
      const thumbnailCanvas = document.createElement('canvas');
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      
      // Set thumbnail dimensions
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
      
      // Draw resized image
      thumbnailCtx.drawImage(canvas, 0, 0, thumbnailWidth, thumbnailHeight);
      
      // Get dataURL of thumbnail
      const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/png');
      
      // Save capture in history
      chrome.storage.local.get(['captures'], (result) => {
        const captures = result.captures || [];
        
        // Add new capture to the beginning of the array
        captures.unshift({
          dataUrl,
          thumbnail: thumbnailDataUrl,
          timestamp: Date.now(),
          url: window.location.href,
          title: document.title
        });
        
        // Limit to 50 captures
        if (captures.length > 50) {
          captures.pop();
        }
        
        // Save updated captures
        chrome.storage.local.set({ captures }, () => {
          // Notify popup about new capture
          chrome.runtime.sendMessage({ action: 'newCapture' });
          
          // Copy to clipboard
          copyImageToClipboard(dataUrl);
          
          // Show success message
          showCaptureMessage('Component captured successfully!');
        });
      });
    }).catch(error => {
      console.error('Error capturing element:', error);
      showCaptureMessage('Error capturing the component.', true);
    });
  }
  
  // Copy image to clipboard
  function copyImageToClipboard(dataUrl) {
    // Create a temporary image element
    const img = new Image();
    img.src = dataUrl;
    
    // When the image loads, copy to clipboard
    img.onload = () => {
      // Create a temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image on the canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Convert to blob and copy
      canvas.toBlob(blob => {
        try {
          // Try to use the modern Clipboard API
          navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]).catch(err => {
            console.error('Error copying to clipboard:', err);
          });
        } catch (e) {
          console.error('Clipboard API not supported:', e);
        }
      });
    };
  }
  
  // Show capture message
  function showCaptureMessage(message, isError = false) {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `component-scanner-overlay`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'component-scanner-message';
    messageContent.innerHTML = `
      <h3>${isError ? 'Error' : 'Success'}</h3>
      <p>${message}</p>
    `;
    
    messageElement.appendChild(messageContent);
    
    // Add to DOM
    document.body.appendChild(messageElement);
    
    // Remove after 2 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 2000);
  }
})(); 