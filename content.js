(() => {
  let isScanning = false;
  let currentHighlightedElement = null;
  let originalPageTitle = '';
  let escapeKeyHandler = null;
  const activeToasts = new Set();
  let mouseoverThrottle = null;
  
  // Initialize state
  chrome.storage.local.get(['isScanning', 'enableClickWidget'], (result) => {
    if (result.isScanning) {
      startScanning();
    }
    if (result.enableClickWidget !== false) { // Default to true
      enableClickWidget();
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

    // Handle click widget toggle
    if (message.action === 'toggleClickWidget') {
      if (message.enabled) {
        enableClickWidget();
      } else {
        disableClickWidget();
      }
      if (sendResponse) {
        sendResponse({ status: 'click_widget_toggled' });
      }
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

  // Enable click widget for all elements
  function enableClickWidget() {
    // Remove existing click listener if any
    document.removeEventListener('click', handleGlobalClick, true);

    // Add global click listener (capturing phase to handle all clicks)
    document.addEventListener('click', handleGlobalClick, true);

    // Store reference for cleanup
    window.clickWidgetEnabled = true;
  }

  // Utility function to remove all existing widgets
  function removeAllWidgets() {
    const existingGlobalWidget = document.querySelector('.global-click-widget');
    const existingScannerWidget = document.querySelector('.component-scanner-widget');
    if (existingGlobalWidget) {
      existingGlobalWidget.remove();
    }
    if (existingScannerWidget) {
      existingScannerWidget.remove();
    }
  }

  // Disable click widget for all elements
  function disableClickWidget() {
    document.removeEventListener('click', handleGlobalClick, true);
    window.clickWidgetEnabled = false;

    // Remove any existing widgets
    removeAllWidgets();
  }

  // Handle global click events
  function handleGlobalClick(event) {
    // Don't interfere with scanning mode clicks
    if (isScanning) return;

    // Don't show widget for very small elements or non-visible elements
    const rect = event.target.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 20 || rect.width === 0 || rect.height === 0) {
      return;
    }

    // Don't show widget for the widget itself or its children
    if (event.target.closest('.global-click-widget') || event.target.closest('.component-scanner-widget')) {
      return;
    }

    // Don't show widget for form inputs (to avoid interfering with typing)
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      return;
    }

    // Prevent default behavior for element selection
    event.preventDefault();
    event.stopPropagation();

    // Show the click widget
    showClickWidget(event.target);

    return false;
  }

  // Show click widget for any element
  function showClickWidget(element) {
    // Remove any existing widgets
    removeAllWidgets();

    // Get position and dimensions of the element
    const rect = element.getBoundingClientRect();

    // Create widget
    const widget = document.createElement('div');
    widget.className = 'global-click-widget';
    widget.innerHTML = `
      <div class="widget-header">
        <div class="widget-title">
          <i class="fas fa-code"></i>
          <span>Code Generator</span>
        </div>
        <button class="widget-close" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="widget-content">
        <div class="widget-options">
          <div class="option-group">
            <label>Component Format:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="componentFormat" value="html" checked>
                <span>HTML</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="componentFormat" value="jsx">
                <span>JSX</span>
              </label>
            </div>
          </div>
          <div class="option-group">
            <label>Style Format:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="tailwind" checked>
                <span>Tailwind V4</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="inline">
                <span>Inline CSS</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="external">
                <span>External CSS</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="local">
                <span>Local CSS</span>
              </label>
            </div>
          </div>
          <div class="option-group">
            <label>Media Query:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="mediaQuery" value="on" checked>
                <span>On</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="mediaQuery" value="off">
                <span>Off</span>
              </label>
            </div>
          </div>
        </div>
        <div class="widget-actions">
          <button class="generate-btn" disabled>
            <i class="fas fa-wand-magic-sparkles"></i>
            <span>Generate Code</span>
          </button>
          <button class="copy-btn" disabled>
            <i class="fas fa-copy"></i>
            <span>Copy</span>
          </button>
        </div>
        <div class="code-preview">
          <div class="code-header">
            <span>Generated Code</span>
          </div>
          <pre class="code-content"><code>Click "Generate Code" to create component code</code></pre>
        </div>
      </div>
    `;

    // Position widget near the element with viewport detection
    const widgetWidth = 500; // max-width from CSS
    const widgetHeight = 400; // estimated height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Calculate initial position (to the right of element)
    let widgetTop = rect.top + scrollTop - 10;
    let widgetLeft = rect.left + scrollLeft + rect.width + 20;

    // Ensure widget header is always visible by prioritizing top positioning
    const headerHeight = 60; // Approximate header height
    const minTopMargin = 20;
    
    // Adjust if widget would go off-screen at the top
    if (widgetTop < scrollTop + minTopMargin) {
      widgetTop = scrollTop + minTopMargin;
    }
    
    // Adjust if widget would go off-screen at the bottom
    if (widgetTop + widgetHeight > scrollTop + viewportHeight - minTopMargin) {
      widgetTop = scrollTop + viewportHeight - widgetHeight - minTopMargin;
    }

    // Adjust if widget would go off-screen to the right
    if (widgetLeft + widgetWidth > viewportWidth + scrollLeft) {
      // Position to the left of element instead
      widgetLeft = rect.left + scrollLeft - widgetWidth - 20;
    }

    // Adjust if widget would go off-screen to the left
    if (widgetLeft < scrollLeft + 10) {
      // Center horizontally in viewport
      widgetLeft = scrollLeft + (viewportWidth - widgetWidth) / 2;
    }
    
    // If widget is too tall for viewport, ensure header stays visible
    if (widgetHeight > viewportHeight - 40) {
      widgetTop = scrollTop + minTopMargin;
    }

    // Ensure minimum margins
    widgetTop = Math.max(scrollTop + minTopMargin, widgetTop);
    widgetLeft = Math.max(scrollLeft + 10, widgetLeft);

    widget.style.top = `${widgetTop}px`;
    widget.style.left = `${widgetLeft}px`;

    document.body.appendChild(widget);

    // Add smooth positioning animation
    requestAnimationFrame(() => {
      widget.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    // Add event listeners
    const closeBtn = widget.querySelector('.widget-close');
    const generateBtn = widget.querySelector('.generate-btn');
    const copyBtn = widget.querySelector('.copy-btn');
    const codeContent = widget.querySelector('.code-content');

    closeBtn.addEventListener('click', () => {
      widget.remove();
    });

    generateBtn.addEventListener('click', async () => {
      await generateCodeForClickWidget(element, generateBtn, codeContent);
      copyBtn.disabled = false;
    });

    copyBtn.addEventListener('click', () => {
      const code = codeContent.textContent;
      if (code && code !== 'Click "Generate Code" to create component code') {
        navigator.clipboard.writeText(code).then(() => {
          showCaptureMessage('Code copied to clipboard!');
        }).catch(() => {
          showCaptureMessage('Failed to copy code', true);
        });
      }
    });

    // Check for API key and enable generate button
    chrome.storage.local.get(['apiKey'], (result) => {
      if (result.apiKey) {
        generateBtn.disabled = false;
      } else {
        generateBtn.innerHTML = '<i class="fas fa-key"></i><span>API Key Required</span>';
        generateBtn.title = 'Please set your OpenAI API key in the extension popup';
      }
    });

    // Close widget when clicking outside
    const handleOutsideClick = (e) => {
      if (!widget.contains(e.target)) {
        widget.remove();
        document.removeEventListener('click', handleOutsideClick);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
  }

  // Generate code for click widget
  async function generateCodeForClickWidget(element, button, codeElement) {
    const originalButtonHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<div class="loading-spinner"></div><span>Generating...</span>';

    try {
      const result = await chrome.storage.local.get(['apiKey']);
      const apiKey = result.apiKey;

      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Get selected options
      const componentFormat = document.querySelector('input[name="componentFormat"]:checked').value;
      const styleFormat = document.querySelector('input[name="styleFormat"]:checked').value;
      const mediaQuery = document.querySelector('input[name="mediaQuery"]:checked').value;

      // Capture the element first
      const rect = element.getBoundingClientRect();
      
      // Check if element is visible
      if (rect.width === 0 || rect.height === 0) {
        throw new Error('Could not capture this element (zero dimensions)');
      }

      // Use html2canvas to capture the element
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        logging: false,
        useCORS: true,
        scale: window.devicePixelRatio,
        ignoreElements: (el) => {
          // Ignore toast notifications and scanner overlays
          return el.classList.contains('component-scanner-toast') || 
                 el.classList.contains('component-scanner-tooltip') ||
                 el.classList.contains('component-scanner-widget') ||
                 el.classList.contains('global-click-widget');
        }
      });

      // Convert canvas to dataURL
      const dataUrl = canvas.toDataURL('image/png');

      // Generate code using the captured image
      const code = await generateCode(dataUrl, apiKey, componentFormat, styleFormat, mediaQuery);
      codeElement.textContent = code;
      showCaptureMessage('Code generated successfully!');

    } catch (error) {
      console.error('Error generating code:', error);
      codeElement.textContent = `Error: ${error.message}`;
      showCaptureMessage('Failed to generate code', true);
    } finally {
      button.disabled = false;
      button.innerHTML = originalButtonHTML;
    }
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
               el.classList.contains('component-scanner-tooltip') ||
               el.classList.contains('component-scanner-widget');
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
      
      // Show code generation widget
      showCodeWidget(element, dataUrl);
      
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

  // Show code generation widget
  function showCodeWidget(element, dataUrl) {
    // Remove any existing widgets
    removeAllWidgets();

    // Get element position for widget placement
    const rect = element.getBoundingClientRect();

    // Create widget
    const widget = document.createElement('div');
    widget.className = 'component-scanner-widget';
    widget.innerHTML = `
      <div class="widget-header">
        <div class="widget-title">
          <i class="fas fa-code"></i>
          <span>Generated Code</span>
        </div>
        <button class="widget-close" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="widget-content">
        <div class="widget-options">
          <div class="option-group">
            <label>Component Format:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="componentFormat" value="html" checked>
                <span>HTML</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="componentFormat" value="jsx">
                <span>JSX</span>
              </label>
            </div>
          </div>
          <div class="transformation-info">
            <div class="info-item">
              <i class="fas fa-arrow-right"></i>
              <span>div → section</span>
            </div>
          </div>
          <div class="option-group">
            <label>Style Format:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="tailwind" checked>
                <span>Tailwind CSS</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="inline">
                <span>Inline CSS</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="external">
                <span>External CSS</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="styleFormat" value="local">
                <span>Local CSS</span>
              </label>
            </div>
          </div>
          <div class="option-group">
            <label>Media Query:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="mediaQuery" value="on" checked>
                <span>On</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="mediaQuery" value="off">
                <span>Off</span>
              </label>
            </div>
          </div>
        </div>
        <div class="widget-actions">
          <button class="generate-btn" disabled>
            <i class="fas fa-wand-magic-sparkles"></i>
            <span>Generate Code</span>
          </button>
          <button class="copy-btn" disabled>
            <i class="fas fa-copy"></i>
            <span>Copy</span>
          </button>
        </div>
        <div class="code-preview">
          <div class="code-header">
            <span>Generated Code</span>
          </div>
          <pre class="code-content"><code>Click "Generate Code" to create component code</code></pre>
        </div>
      </div>
    `;

    // Position widget near the captured element with viewport detection
    const widgetWidth = 500; // max-width from CSS
    const widgetHeight = 400; // estimated height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calculate initial position (to the right of element)
    let widgetTop = rect.top + scrollTop - 10;
    let widgetLeft = rect.left + scrollLeft + rect.width + 20;
    
    // Ensure widget header is always visible by prioritizing top positioning
    const headerHeight = 60; // Approximate header height
    const minTopMargin = 20;
    
    // Adjust if widget would go off-screen at the top
    if (widgetTop < scrollTop + minTopMargin) {
      widgetTop = scrollTop + minTopMargin;
    }
    
    // Adjust if widget would go off-screen at the bottom
    if (widgetTop + widgetHeight > scrollTop + viewportHeight - minTopMargin) {
      widgetTop = scrollTop + viewportHeight - widgetHeight - minTopMargin;
    }
    
    // Adjust if widget would go off-screen to the right
    if (widgetLeft + widgetWidth > viewportWidth + scrollLeft) {
      // Position to the left of element instead
      widgetLeft = rect.left + scrollLeft - widgetWidth - 20;
    }
    
    // Adjust if widget would go off-screen to the left
    if (widgetLeft < scrollLeft + 10) {
      // Center horizontally in viewport
      widgetLeft = scrollLeft + (viewportWidth - widgetWidth) / 2;
    }
    
    // If widget is too tall for viewport, ensure header stays visible
    if (widgetHeight > viewportHeight - 40) {
      widgetTop = scrollTop + minTopMargin;
    }
    
    // Ensure minimum margins
    widgetTop = Math.max(scrollTop + minTopMargin, widgetTop);
    widgetLeft = Math.max(scrollLeft + 10, widgetLeft);
    
    widget.style.top = `${widgetTop}px`;
    widget.style.left = `${widgetLeft}px`;

    document.body.appendChild(widget);
    
    // Add smooth positioning animation
    requestAnimationFrame(() => {
      widget.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    // Add event listeners
    const closeBtn = widget.querySelector('.widget-close');
    const generateBtn = widget.querySelector('.generate-btn');
    const copyBtn = widget.querySelector('.copy-btn');
    const codeContent = widget.querySelector('.code-content');

    closeBtn.addEventListener('click', () => {
      widget.remove();
    });

    generateBtn.addEventListener('click', async () => {
      await generateCodeForWidget(dataUrl, generateBtn, codeContent);
      copyBtn.disabled = false;
    });

    copyBtn.addEventListener('click', () => {
      const code = codeContent.textContent;
      if (code && code !== 'Click "Generate Code" to create component code') {
        navigator.clipboard.writeText(code).then(() => {
          showCaptureMessage('Code copied to clipboard!');
        }).catch(() => {
          showCaptureMessage('Failed to copy code', true);
        });
      }
    });

    // Check for API key and enable generate button
    chrome.storage.local.get(['apiKey'], (result) => {
      if (result.apiKey) {
        generateBtn.disabled = false;
      } else {
        generateBtn.innerHTML = '<i class="fas fa-key"></i><span>API Key Required</span>';
        generateBtn.title = 'Please set your OpenAI API key in the extension popup';
      }
    });

    // Close widget when clicking outside
    const handleOutsideClick = (e) => {
      if (!widget.contains(e.target)) {
        widget.remove();
        document.removeEventListener('click', handleOutsideClick);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
  }

  // Generate code for widget
  async function generateCodeForWidget(dataUrl, button, codeElement) {
    const originalButtonHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<div class="loading-spinner"></div><span>Generating...</span>';

    try {
      const result = await chrome.storage.local.get(['apiKey']);
      const apiKey = result.apiKey;

      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Get selected options
      const componentFormat = document.querySelector('input[name="componentFormat"]:checked').value;
      const styleFormat = document.querySelector('input[name="styleFormat"]:checked').value;
      const mediaQuery = document.querySelector('input[name="mediaQuery"]:checked').value;

      const code = await generateCode(dataUrl, apiKey, componentFormat, styleFormat, mediaQuery);
      codeElement.textContent = code;
      showCaptureMessage('Code generated successfully!');

    } catch (error) {
      console.error('Error generating code:', error);
      codeElement.textContent = `Error: ${error.message}`;
      showCaptureMessage('Failed to generate code', true);
    } finally {
      button.disabled = false;
      button.innerHTML = originalButtonHTML;
    }
  }

  // Generate code using OpenAI API
  async function generateCode(imageDataUrl, apiKey, componentFormat, styleFormat, mediaQuery) {
    let prompt = "Create a component that looks exactly like this UI element.";

    if (componentFormat === 'jsx') {
      prompt = "Create a React component that looks exactly like this UI element. Use functional components and hooks.";
    }

    if (styleFormat === 'tailwind') {
      prompt += " Use Tailwind CSS for styling.";
    } else if (styleFormat === 'inline') {
      prompt += " Use inline CSS styles.";
    } else if (styleFormat === 'external') {
      prompt += " Use external CSS classes.";
    } else if (styleFormat === 'local') {
      prompt += " Use CSS modules or local CSS classes.";
    }

    if (mediaQuery === 'on') {
      prompt += " Include responsive design with media queries.";
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

    // Extract code from markdown code blocks
    const codeBlockRegex = /```(?:html|css|jsx|tsx|javascript|js|react)?([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);

    if (match?.[1]) {
      return match[1].trim();
    }

    return content;
  }
})(); 