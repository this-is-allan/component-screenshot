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
    chrome.runtime.sendMessage({ action: 'newCapture' });
  }
  
  // If the user wants to toggle scanning, ensure content script is injected
  if (message.action === 'toggleScan' && message.isScanning) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Check if content script is already injected
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
                  chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleScan', isScanning: true });
                }, 100);
              });
            });
          }
        });
      }
    });
  }
  
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
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleScan', 
      isScanning: newState 
    });
  });
}); 