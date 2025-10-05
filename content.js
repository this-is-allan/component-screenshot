(() => {
  let isScanning = false;
  let currentHighlightedElement = null;
  let originalPageTitle = '';
  let escapeKeyHandler = null;
  const activeToasts = new Set();
  let mouseoverThrottle = null;
  
  // Initialize state
  chrome.storage.local.get(['isScanning'], (result) => {
    if (result.isScanning) {
      startScanning();
    }
  });
  
  // Throttle function to limit event frequency
  function throttle(func, delay) {
    let timeoutId = null;
    let lastRan = 0;
    
    return function(...args) {
      const now = Date.now();
      const timeSinceLastRan = now - lastRan;
      
      if (timeSinceLastRan >= delay) {
        func.apply(this, args);
        lastRan = now;
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastRan = Date.now();
        }, delay - timeSinceLastRan);
      }
    };
  }
  
  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'toggleScan') {
      if (message.isScanning) {
        startScanning();
      } else {
        stopScanning();
      }
      // Send response to confirm message was processed
      if (sendResponse) {
        sendResponse({ status: 'toggle_processed' });
      }
    }
    
    // Responder ao ping do background script para verificar se o content script está carregado
    if (message.action === 'ping') {
      sendResponse({ status: 'content_script_loaded' });
    }
    
    // Always return true for asynchronous response
    return true;
  });
  
  // Start scanning mode
  function startScanning() {
    if (isScanning) return;
    
    isScanning = true;
    
    // Create throttled mouseover handler
    const throttledMouseOver = throttle(handleMouseOver, 50);
    mouseoverThrottle = throttledMouseOver;
    
    // Add event listeners with optimized handlers
    document.addEventListener('mouseover', throttledMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true);
    
    // Save original page title and update it
    originalPageTitle = document.title;
    document.title = '📸 Scanning Mode - ' + originalPageTitle;
    
    // Add custom cursor to body
    document.body.style.cursor = 'crosshair';
    
    // Add class to body to indicate scanning mode
    document.body.classList.add('component-scanner-active');
    
    // Show subtle notification instead of full overlay
    showScanningNotification();
  }
  
  // Stop scanning mode
  function stopScanning() {
    if (!isScanning) return;
    
    isScanning = false;
    
    // Remove event listeners using the throttled version if available
    if (mouseoverThrottle) {
      document.removeEventListener('mouseover', mouseoverThrottle);
      mouseoverThrottle = null;
    } else {
      document.removeEventListener('mouseover', handleMouseOver);
    }
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', handleClick, true);
    
    // Remove ESC key handler
    if (escapeKeyHandler) {
      document.removeEventListener('keydown', escapeKeyHandler);
      escapeKeyHandler = null;
    }
    
    // Remove highlight from current element
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('component-scanner-highlight');
      currentHighlightedElement = null;
    }
    
    // Restore original page title
    if (originalPageTitle) {
      document.title = originalPageTitle;
    }
    
    // Restore default cursor
    document.body.style.cursor = '';
    
    // Remove class from body
    document.body.classList.remove('component-scanner-active');
    
    // Clear any remaining notification elements efficiently
    activeToasts.forEach(toast => {
      toast?.parentNode && toast.remove();
    });
    activeToasts.clear();
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
  
  // Check if element is part of the toast notification (optimized)
  function isPartOfOverlay(element) {
    // Quick check: if element has the class itself, return true
    if (element.classList.contains('component-scanner-toast')) {
      return true;
    }
    
    // Check if any parent is a toast notification
    let current = element.parentElement;
    while (current && current !== document.body) {
      if (current.classList.contains('component-scanner-toast')) {
        return true;
      }
      current = current.parentElement;
    }
    
    return false;
  }
  
  // Show subtle scanning notification
  function showScanningNotification() {
    // Create a subtle toast notification
    const toast = document.createElement('div');
    toast.className = 'component-scanner-toast';
    toast.innerHTML = `
      <div class="scanner-toast-content">
        <i class="fas fa-camera"></i>
        <div class="scanner-toast-text">
          <strong>Scanning Mode Active</strong>
          <span>Hover and click to capture • Press ESC to exit</span>
        </div>
      </div>
    `;
    
    // Add to active toasts tracking
    activeToasts.add(toast);
    document.body.appendChild(toast);
    
    // Add ESC key event handler only once
    if (!escapeKeyHandler) {
      escapeKeyHandler = handleEscapeKey;
      document.addEventListener('keydown', escapeKeyHandler);
    }
    
    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
          activeToasts.delete(toast);
        }
      }, 300);
    }, 3000);
  }
  
  // Handle ESC key to exit scanning
  function handleEscapeKey(e) {
    if (e.key === 'Escape' && isScanning) {
      stopScanning();
      chrome.storage.local.set({ isScanning: false });
      document.removeEventListener('keydown', handleEscapeKey);
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
    
    // Remove highlight before capturing to avoid the outline in the screenshot
    const hadHighlight = element.classList.contains('component-scanner-highlight');
    if (hadHighlight) {
      element.classList.remove('component-scanner-highlight');
    }
    
    // Use html2canvas to capture the element
    html2canvas(element, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: window.devicePixelRatio,
      ignoreElements: (el) => {
        // Ignore toast notifications and scanner overlays
        return el.classList.contains('component-scanner-toast') || 
               el.classList.contains('component-scanner-tooltip');
      }
    }).then(canvas => {
      // Immediate feedback - stop scanning and show success message first
      stopScanning();
      showCaptureMessage('Component captured successfully!');
      
      // Convert canvas to dataURL in background
      const dataUrl = canvas.toDataURL('image/png');
      
      // Create thumbnail asynchronously with lower quality for speed
      const thumbnailDataUrl = createThumbnail(canvas);
      
      // Copy to clipboard immediately (non-blocking)
      copyImageToClipboard(dataUrl);
      
      // Save to storage and notify (combined operations for efficiency)
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
        
        // Save everything in one operation
        chrome.storage.local.set({ 
          captures,
          isScanning: false 
        }, () => {
          // Send all notifications asynchronously without blocking
          notifyCapture();
        });
      });
    }).catch(error => {
      console.error('Error capturing element:', error);
      showCaptureMessage('Error capturing the component.', true);
    });
  }
  
  // Create thumbnail efficiently
  function createThumbnail(canvas) {
    const maxThumbnailSize = 200;
    const scale = Math.min(maxThumbnailSize / canvas.width, maxThumbnailSize / canvas.height, 1);
    
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = canvas.width * scale;
    thumbnailCanvas.height = canvas.height * scale;
    
    const ctx = thumbnailCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    
    // Use JPEG with lower quality for faster encoding
    return thumbnailCanvas.toDataURL('image/jpeg', 0.7);
  }
  
  // Send all notifications asynchronously
  function notifyCapture() {
    // All notifications in parallel without waiting
    try {
      chrome.runtime.sendMessage({ action: 'newCapture' }, () => {
        if (chrome.runtime.lastError) {
          console.log('Unable to notify popup:', chrome.runtime.lastError.message);
        }
      });
      
      chrome.runtime.sendMessage({ action: 'toggleScan', isScanning: false }, () => {
        if (chrome.runtime.lastError) {
          console.log('Unable to notify scan stop:', chrome.runtime.lastError.message);
        }
      });
      
      chrome.runtime.sendMessage({ action: 'reopenPopup' }, () => {
        if (chrome.runtime.lastError) {
          console.log('Unable to request popup reopen:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.log('Error sending notifications:', error);
    }
  }
  
  // Copy image to clipboard (optimized)
  function copyImageToClipboard(dataUrl) {
    // Convert dataUrl directly to blob and copy
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        try {
          // Use the modern Clipboard API
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
      })
      .catch(err => {
        console.error('Error converting dataUrl to blob:', err);
      });
  }
  
  // Show capture message
  function showCaptureMessage(message, isError = false) {
    // Create toast message element
    const toast = document.createElement('div');
    toast.className = 'component-scanner-toast show';
    
    toast.innerHTML = `
      <div class="scanner-toast-content ${isError ? 'error' : 'success'}">
        <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        <div class="scanner-toast-text">
          <strong>${isError ? 'Error' : 'Success'}</strong>
          <span>${message}</span>
        </div>
      </div>
    `;
    
    // Add to active toasts tracking and DOM
    activeToasts.add(toast);
    document.body.appendChild(toast);
    
    // Remove after 2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
          activeToasts.delete(toast);
        }
      }, 300);
    }, 2000);
  }
})(); 