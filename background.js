// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Initialize extension state
  chrome.storage.local.set({
    isScanning: false,
    captures: []
  });
  
  console.log('Component Capture: Extension installed/updated successfully!');
});

// Listener for messages from other scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward relevant messages to the popup if it's open
  if (message.action === 'newCapture') {
    try {
      chrome.runtime.sendMessage({ action: 'newCapture' }, response => {
        if (chrome.runtime.lastError) {
          // Silently handle the error - popup might not be open
          console.log('Popup not available to receive message:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.log('Error sending message to popup:', error);
    }
  }
  
  // If the user wants to toggle scanning, ensure content script is injected
  if (message.action === 'toggleScan' && (message.isScanning || message.forceInjection)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Check if content script is already injected
        try {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' }, response => {
            // If there's an error, the content script isn't loaded yet
            if (chrome.runtime.lastError) {
              console.log('Content script not loaded, injecting now...');
              
              // First inject html2canvas.min.js
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['html2canvas.min.js']
              }).then(() => {
                // Then inject the content script
                chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id },
                  files: ['content.js']
                }).then(() => {
                  // After successful injection, send the toggle message again
                  setTimeout(() => {
                    try {
                      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScan', isScanning: message.isScanning }, response => {
                        if (chrome.runtime.lastError) {
                          console.log('Error sending toggle message after injection:', chrome.runtime.lastError.message);
                        }
                        
                        // Send response to the popup if this was requested
                        if (message.forceInjection && sendResponse) {
                          sendResponse({ status: 'injection_complete' });
                        }
                      });
                    } catch (error) {
                      console.log('Error sending toggle message:', error);
                      if (message.forceInjection && sendResponse) {
                        sendResponse({ status: 'injection_error', error: error.message });
                      }
                    }
                  }, 200); // Increased timeout to ensure script is fully loaded
                }).catch(err => {
                  console.log('Error injecting content script:', err);
                  if (message.forceInjection && sendResponse) {
                    sendResponse({ status: 'injection_error', error: err.message });
                  }
                });
              }).catch(err => {
                console.log('Error injecting html2canvas:', err);
                if (message.forceInjection && sendResponse) {
                  sendResponse({ status: 'injection_error', error: err.message });
                }
              });
            } else {
              console.log('Content script already loaded');
              if (message.forceInjection && sendResponse) {
                sendResponse({ status: 'already_injected' });
              }
            }
          });
        } catch (error) {
          console.log('Error checking content script:', error);
          if (message.forceInjection && sendResponse) {
            sendResponse({ status: 'injection_error', error: error.message });
          }
        }
      }
    });
  }
  
  // Always return true for asynchronous sendResponse
  return true;
});

// Listener for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  // If the user clicks on the extension icon without opening the popup,
  // we can toggle the scanning mode directly
  chrome.storage.local.get(['isScanning'], (result) => {
    const newState = !result.isScanning;
    
    chrome.storage.local.set({ isScanning: newState });
    
    // Send message to the current page
    try {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleScan', 
        isScanning: newState 
      }, response => {
        if (chrome.runtime.lastError) {
          console.log('Error sending toggle message:', chrome.runtime.lastError.message);
          
          // If content script isn't available, inject it for better UX
          if (newState) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['html2canvas.min.js']
            }).then(() => {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              }).then(() => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { 
                    action: 'toggleScan', 
                    isScanning: newState 
                  });
                }, 200);
              });
            });
          }
        }
      });
    } catch (error) {
      console.log('Error sending message to tab:', error);
    }
  });
}); 