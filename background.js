// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Initialize extension state
  chrome.storage.local.set({
    isScanning: false,
    captures: []
  });
  
  console.log('ComponentCapture: Extension installed/updated successfully!');
});

// Listener for messages from other scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward relevant messages to the popup if it's open
  if (message.action === 'newCapture') {
    chrome.runtime.sendMessage({ action: 'newCapture' });
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