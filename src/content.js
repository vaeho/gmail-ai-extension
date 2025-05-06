console.log("Gmail AI Content Script Loaded");

// --- Constants & State --- //
const GMAIL_AI_BUTTON_ID = 'gmail-ai-button';
const GMAIL_AI_PANEL_ID = 'gmail-ai-panel';
const GMAIL_AI_TEXTAREA_ID = 'gmail-ai-textarea';
const GMAIL_AI_GENERATE_BTN_ID = 'gmail-ai-generate-btn';
const GMAIL_AI_CLOSE_BTN_ID = 'gmail-ai-close-btn';
const GMAIL_AI_STATUS_ID = 'gmail-ai-status';
const GMAIL_AI_CLEAR_BTN_ID = 'gmail-ai-clear-history-btn';

// Store conversation history per compose window instance
// Key: Unique identifier for the compose window (e.g., derived from its element)
// Value: Array of { role: 'user' | 'assistant', content: string }
const conversationHistories = new Map();

// Keep track of the compose body element for focus management
const composeBodyMap = new Map();

// Keep track of injected buttons/panels to avoid duplicates
const injectedComposeWindows = new Set();

// --- DOM Manipulation & UI Injection --- //

/**
 * Finds the toolbar element within a Gmail compose window.
 * Note: Selectors might change with Gmail updates.
 * Current selector targets the area containing Send, Formatting options, etc.
 */
function findComposeToolbar(composeWindowElement) {
  // Try a few common selectors for the bottom toolbar
  const selectors = [
    '.gU.Up', // Older selector?
    'div[aria-label="Formatting options"] > div:nth-child(2)', // Area near send button often
    '[data-tooltip="Send"] > div > div > div', // Near send button structure
    '.IZ.bG.aA7', // Another potential parent
    '.adj', // Toolbar container class
    'tr.btC' // Fallback to table row containing buttons
  ];

  for (const selector of selectors) {
    const toolbar = composeWindowElement.querySelector(selector);
    if (toolbar) {
      // console.log(`Found toolbar with selector: ${selector}`);
      return toolbar;
    }
  }
  console.warn("Could not find suitable compose toolbar element.");
  return null;
}

/**
 * Finds the main contenteditable body of the compose window.
 */
function findComposeBody(composeWindowElement) {
  // Try specific label first (new compose)
  let body = composeWindowElement.querySelector('div[aria-label="Message Body"]');
  if (body) {
      console.log("Found compose body using aria-label.");
      // Ensure it's actually contenteditable (for replies/forwards)
      if (body.contentEditable !== 'true') {
          const editableChild = body.querySelector('div[contenteditable="true"]');
          if (editableChild) {
              console.log("Adjusted to contenteditable child within aria-label div.");
              return editableChild;
          }
      }
      return body;
  }

  // Fallback 1: Common editable div class within compose area
  // Gmail uses obfuscated classes, need to inspect. Common patterns include `Am`, `editable`
  // Let's try a broader search for contenteditable divs within the compose window
  const editableDivs = composeWindowElement.querySelectorAll('div[contenteditable="true"]');
  if (editableDivs.length > 0) {
      // Often the main body is the first or largest one. Let's assume the first for now.
      // More robust: could check parent structure or size if needed.
      body = editableDivs[0]; 
      console.log("Found compose body using first contenteditable div.", body);
      return body;
  }

  // Fallback 2: Look for specific structure if needed (example, might change)
  // body = composeWindowElement.querySelector('.Ar.Au > div'); 

  console.warn("Could not find compose body element using known selectors.");
  return null;
}

/**
 * Creates and injects the AI button and panel into the compose window's toolbar.
 */
function injectAIButtonAndPanel(composeWindowElement, composeKey) {
  const toolbar = findComposeToolbar(composeWindowElement);
  if (!toolbar) {
    console.warn("Cannot inject AI button: Toolbar not found.");
    return;
  }

  const composeBody = findComposeBody(composeWindowElement);
  if (!composeBody) {
      console.warn("Cannot inject AI button: Compose body not found.");
      return;
  }
  // Store the compose body for later focus management
  composeBodyMap.set(composeKey, composeBody);

  // Prevent duplicate injection by checking within the specific compose window
  if (composeWindowElement.querySelector(`#${GMAIL_AI_BUTTON_ID}`)) {
      console.log("AI Button already exists in this specific compose window element.");
      return;
  }

  console.log("Injecting AI Button and Panel...");

  // --- Create AI Button --- //
  const aiButton = document.createElement('button');
  aiButton.id = GMAIL_AI_BUTTON_ID;
  aiButton.className = 'gmail-ai-button gmail-ai-element';
  aiButton.textContent = '✨';
  aiButton.type = 'button';

  // --- Create Button Container --- //
  const aiButtonContainer = document.createElement('td'); // *** Use td instead of div ***
  aiButtonContainer.className = 'gmail-ai-button-container gmail-ai-element';
  aiButtonContainer.appendChild(aiButton);

  // --- Create AI Panel (initially hidden) --- //
  const aiPanel = document.createElement('div');
  aiPanel.id = GMAIL_AI_PANEL_ID;
  aiPanel.className = 'gmail-ai-panel gmail-ai-element'; // Add common class
  aiPanel.style.display = 'none';
  aiPanel.innerHTML = `
    <div class="gmail-ai-panel-content">
        <div class="gmail-ai-panel-header">
            <span>AI Assistant</span>
            <button id="${GMAIL_AI_CLOSE_BTN_ID}" class="gmail-ai-close-button">&times;</button>
        </div>
        <textarea id="${GMAIL_AI_TEXTAREA_ID}" placeholder="Tell the AI what to write..."></textarea>
        <div id="${GMAIL_AI_STATUS_ID}" class="gmail-ai-status"></div>
        <div class="gmail-ai-panel-footer">
             <button id="${GMAIL_AI_CLEAR_BTN_ID}" class="gmail-ai-clear-button">Clear History</button>
             <div class="gmail-ai-footer-spacer"></div>
             <button id="${GMAIL_AI_GENERATE_BTN_ID}" class="gmail-ai-generate-button">Generate</button>
        </div>
        <div class="gmail-ai-panel-subfooter">
            <span class="gmail-ai-shortcut-label">Ctrl+Enter</span>
        </div>
    </div>
  `;

  // --- Append Button Container --- //
  // Try finding the Send button TD and a sibling TD (e.g., formatting)
  const sendButton = composeWindowElement.querySelector('[data-tooltip^="Send"]');
  let sendButtonTd = null;
  if (sendButton) {
      // Go up parents until we find a TD (might be parent.parent or just parent)
      let current = sendButton;
      while (current && current.tagName !== 'TD' && current !== composeWindowElement) {
          current = current.parentElement;
      }
      if (current && current.tagName === 'TD') {
          sendButtonTd = current;
      }
  }

  if (sendButtonTd && sendButtonTd.parentNode) {
      const parentRow = sendButtonTd.parentNode;
      console.log(`Send Button TD found. Parent row: ${parentRow.tagName}`);

      // Find a sibling TD to clone (e.g., the one containing formatting)
      // This selector targets a common container for format options
      const formatOptionsContainer = composeWindowElement.querySelector('div[aria-label="Formatting options"]');
      let formatTd = null;
      if (formatOptionsContainer) {
           let current = formatOptionsContainer;
           while (current && current.tagName !== 'TD' && current !== composeWindowElement) {
               current = current.parentElement;
           }
           if (current && current.tagName === 'TD') {
               formatTd = current;
           }
      }

      if (formatTd) {
          // Clone the formatting TD
          const clonedTd = formatTd.cloneNode(true);
          // Clear its contents
          while (clonedTd.firstChild) {
              clonedTd.removeChild(clonedTd.firstChild);
          }
          // Append our specific container (which holds the button)
          // Note: aiButtonContainer is already a TD, maybe just put button directly in clonedTd?
          // Let's try putting the button directly into the cloned TD for simplicity
          clonedTd.className = 'gmail-ai-button-container gmail-ai-element'; // Reuse class for styling
          clonedTd.style.paddingLeft = '8px'; // Re-apply padding directly
          clonedTd.style.verticalAlign = 'middle'; // Re-apply valign
          clonedTd.appendChild(aiButton);

          // Insert the cloned TD after the send button TD
          parentRow.insertBefore(clonedTd, sendButtonTd.nextSibling);
          console.log("Inserted CLONED TD with AI button after Send button TD");
      } else {
          console.warn("Could not find formatting TD to clone for AI button insertion.");
          // Fallback? Maybe append aiButtonContainer (the TD) to the row?
          parentRow.appendChild(aiButtonContainer);
          console.warn("Appended original AI button TD to parent row as fallback.")
      }

  } else {
      console.warn("Could not find Send button TD or its parent row. Button not added.");
  }

  // --- Panel Append Logic --- //
  document.body.appendChild(aiPanel);
  console.log("Reverted: Appended AI panel to document.body");

  // --- Define Escape Key Handler (closes over scope) --- //
  const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
          console.log("Escape key pressed, closing panel and clearing history.");
          aiPanel.style.display = 'none';
          // Clear history (same logic as close button)
          const currentHistory = conversationHistories.get(composeKey);
          if (currentHistory && currentHistory.length > 0) {
              conversationHistories.delete(composeKey);
              console.log(`History cleared via Escape for key: ${composeKey}`);
          }
          // Focus back on the email body
          const bodyToFocus = composeBodyMap.get(composeKey);
          if (bodyToFocus && document.body.contains(bodyToFocus)) {
              bodyToFocus.focus();
              console.log("Focused email body after Escape close.");
          }
          // Remove this listener itself
          document.removeEventListener('keydown', handleEscapeKey);
      }
  };

  // --- Add Event Listeners --- //
  aiButton.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log("AI Write Button Clicked!");

      const panel = document.getElementById(GMAIL_AI_PANEL_ID); // Find panel by ID
      console.log("Panel Element:", panel);

      if (panel) {
          const currentDisplay = panel.style.display;
          const isHidden = currentDisplay === 'none' || currentDisplay === '';

          if (isHidden) {
              panel.style.display = 'block';
              console.log(`Set panel display to: block`);
              // Add Escape listener when panel opens
              document.addEventListener('keydown', handleEscapeKey);
              setTimeout(() => {
                  if (promptTextarea) {
                      promptTextarea.focus();
                      console.log("Attempted to focus textarea.");
                  }
              }, 0);
          } else {
              panel.style.display = 'none';
              console.log(`Set panel display to: none`);
              // Focus back on the email body when closing via toggle
              const bodyToFocus = composeBodyMap.get(composeKey);
              if (bodyToFocus && document.body.contains(bodyToFocus)) {
                  bodyToFocus.focus();
                  console.log("Focused email body after toggle close.");
              }
              // Remove Escape listener when panel closes via button
              document.removeEventListener('keydown', handleEscapeKey);
          }
      } else {
          console.error("AI Panel element not found in DOM!");
      }
  });

  // Add Drag functionality
  // Add mousedown listener to the *entire panel* to stop propagation
  aiPanel.addEventListener('mousedown', (e) => {
      // Prevent events on the panel itself (outside the header) from bubbling up
      // This might help prevent Gmail from stealing focus or closing the panel
      e.stopPropagation();
  });

  const panelHeader = aiPanel.querySelector('.gmail-ai-panel-header');
  if (panelHeader) {
      let isDragging = false;
      let offsetX, offsetY;

      panelHeader.addEventListener('mousedown', (e) => {
          // Only drag with left mouse button
          if (e.button !== 0) return;

          isDragging = true;
          // Calculate offset from the top-left corner of the panel
          offsetX = e.clientX - aiPanel.getBoundingClientRect().left;
          offsetY = e.clientY - aiPanel.getBoundingClientRect().top;
          aiPanel.style.cursor = 'grabbing';
          panelHeader.style.cursor = 'grabbing';

          // Prevent text selection during drag
          e.preventDefault();
          // Stop propagation to prevent interfering with other listeners
          e.stopPropagation();
      });

      document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          // Stop propagation during drag move
          e.stopPropagation();

          // Calculate new top and left based on mouse position and initial offset
          let newTop = e.clientY - offsetY;
          let newLeft = e.clientX - offsetX;

          // Basic boundary detection (optional, but good practice)
          const panelRect = aiPanel.getBoundingClientRect();
          newTop = Math.max(0, Math.min(newTop, window.innerHeight - panelRect.height));
          newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panelRect.width));

          aiPanel.style.top = `${newTop}px`;
          aiPanel.style.left = `${newLeft}px`;
      });

      document.addEventListener('mouseup', (e) => {
          if (isDragging) {
              // Stop propagation when drag ends
              e.stopPropagation();
              isDragging = false;
              aiPanel.style.cursor = 'default';
              panelHeader.style.cursor = 'grab'; // Reset to grab cursor
          }
      });

      // Set initial cursor style for header
      panelHeader.style.cursor = 'grab';
  } else {
      console.error("Could not find AI panel header for dragging.");
  }

  const closeButton = aiPanel.querySelector(`#${GMAIL_AI_CLOSE_BTN_ID}`);
  // Define promptTextarea here in the broader scope
  const promptTextarea = aiPanel.querySelector(`#${GMAIL_AI_TEXTAREA_ID}`);

  closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      aiPanel.style.display = 'none';
      // Clear history when panel is explicitly closed
      console.log(`Close button clicked. Attempting to clear history for key: ${composeKey}`);
      const currentHistory = conversationHistories.get(composeKey);
      console.log("Current history before clear:", currentHistory);
      if (currentHistory && currentHistory.length > 0) {
          const deleted = conversationHistories.delete(composeKey);
          console.log(`History deleted successfully: ${deleted}. History map size: ${conversationHistories.size}`);
      } else {
          console.log("No history found or history was empty for key:", composeKey);
      }
      // Focus back on the email body
       const bodyToFocus = composeBodyMap.get(composeKey);
       if (bodyToFocus && document.body.contains(bodyToFocus)) {
           bodyToFocus.focus();
           console.log("Focused email body after 'X' close.");
       }
      // Also remove Escape listener when closed via X button
      document.removeEventListener('keydown', handleEscapeKey);
  });

  // --- Attach Clear Button Listener --- //
  const clearButton = aiPanel.querySelector(`#${GMAIL_AI_CLEAR_BTN_ID}`);
  if (clearButton) {
      clearButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentHistory = conversationHistories.get(composeKey);
          if (currentHistory && currentHistory.length > 0) {
              conversationHistories.delete(composeKey);
              console.log("Cleared history for key:", composeKey);
              const statusDiv = document.getElementById(GMAIL_AI_STATUS_ID);
              if (statusDiv) {
                  statusDiv.textContent = 'Conversation history cleared.';
                  statusDiv.style.color = '#5f6368';
                  setTimeout(() => {
                      statusDiv.textContent = '';
                  }, 2000);
              }
          } else {
              console.log("No history to clear for key:", composeKey);
          }
      });
  } else {
       console.error("Could not find Clear History button element.");
  }

  // --- Attach listener for Ctrl+Enter --- //
  if (promptTextarea) {
      promptTextarea.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              console.log("Ctrl+Enter detected, triggering Generate.");
              const generateBtn = aiPanel.querySelector(`#${GMAIL_AI_GENERATE_BTN_ID}`);
              if (generateBtn && !generateBtn.disabled) {
                  generateBtn.click();
              }
          }
      });
  } else {
       console.error("Could not find Prompt Textarea element to attach keydown listener.");
  }

  const generateButton = aiPanel.querySelector(`#${GMAIL_AI_GENERATE_BTN_ID}`);
  generateButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    // Use the existing promptTextarea variable
    // const promptTextarea = document.getElementById(GMAIL_AI_TEXTAREA_ID);
    const statusDiv = document.getElementById(GMAIL_AI_STATUS_ID);
    const prompt = promptTextarea.value.trim();

    if (!prompt) {
      statusDiv.textContent = 'Please enter a prompt.';
      statusDiv.style.color = 'red';
      return;
    }

    const composeBody = findComposeBody(composeWindowElement);
    if (!composeBody) {
      statusDiv.textContent = 'Error: Cannot find email body.';
      statusDiv.style.color = 'red';
      return;
    }

    statusDiv.textContent = 'Generating...';
    statusDiv.style.color = '#555';
    generateButton.disabled = true;
    promptTextarea.disabled = true;

    try {
      // Retrieve current history for this compose window
      const history = conversationHistories.get(composeKey) || [];

      console.log('Sending prompt to background:', prompt, 'History:', history);
      const response = await chrome.runtime.sendMessage({
        action: 'generateEmail',
        prompt: prompt,
        history: history
      });

      console.log('Received response from background:', response);

      if (response && response.success) {
        console.log("Attempting to insert text. Body element:", composeBody);
        console.log("Generated text:", response.text);

        // Ensure body is still valid and attached to DOM
        if (!composeBody || !document.body.contains(composeBody)) {
            console.error("Compose body no longer valid or attached to DOM.");
            statusDiv.textContent = 'Error: Could not find email body to insert text.';
            statusDiv.style.color = 'red';
            return; // Exit early
        }

        // Insert response into compose body
        // Try replacing innerHTML first, but add checks
        try {
             composeBody.innerHTML = response.text.replace(/\n/g, '<br>');
             statusDiv.textContent = 'Email content generated!';
             statusDiv.style.color = 'green';
        } catch (insertionError) {
            console.error("Error setting innerHTML:", insertionError);
            statusDiv.textContent = 'Error inserting text into email body.';
            statusDiv.style.color = 'red';
            // Don't update history or clear prompt if insertion failed
            return;
        }

        // Update history
        const newHistory = [
            ...history,
            { role: 'user', content: prompt },
            { role: 'assistant', content: response.text }
        ];
        conversationHistories.set(composeKey, newHistory);

        // Clear prompt textarea for next instruction
        promptTextarea.value = '';
        // Optionally close panel after generation?
        // aiPanel.style.display = 'none';

      } else {
        throw new Error(response?.error || 'Failed to generate email.');
      }
    } catch (error) {
      console.error('Error during generation:', error);
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.style.color = 'red';
    }
    finally {
      generateButton.disabled = false;
      promptTextarea.disabled = false;
      setTimeout(() => {
          if (statusDiv.textContent !== 'Generating...') { // Don't clear if still showing error/success
              // statusDiv.textContent = '';
          }
          // Focus back on the textarea after generation completes (or fails)
          // Use setTimeout to ensure focus happens after potential UI updates
          setTimeout(() => promptTextarea.focus(), 0);
      }, 3000); // Clear status after a few seconds unless error
    }
  });
}

// --- Mutation Observer --- //

/**
 * Callback function for the MutationObserver.
 * Checks for added nodes that look like Gmail compose windows.
 */
function handleMutation(mutationsList, observer) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(node => {
        // Check if the added node is an element and might be a compose window
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Gmail compose windows often use specific classes or attributes.
          // This selector targets the main compose area. May need adjustment.
          const composeSelector = '.M9 /*.aoP*/'; // Common classes for compose popup, M9 seems stable for now
          let composeWindow = null;

          if (node.matches && node.matches(composeSelector)) {
            composeWindow = node;
          } else if (node.querySelector) {
            composeWindow = node.querySelector(composeSelector);
          }

          if (composeWindow) {
            // Generate a unique key for this compose window instance
            // Using a simple approach for now, might need refinement
            const composeKey = composeWindow.getAttribute('data-gmail-ai-key') || `compose-${Date.now()}-${Math.random()}`;
            composeWindow.setAttribute('data-gmail-ai-key', composeKey);

            if (!injectedComposeWindows.has(composeKey)) {
              console.log('Detected new compose window:', composeWindow, 'Key:', composeKey);
              // Find body *before* injecting, to ensure it's stored if injection happens
              const bodyForInit = findComposeBody(composeWindow);
              if (bodyForInit) {
                  composeBodyMap.set(composeKey, bodyForInit); // Store immediately
                  injectAIButtonAndPanel(composeWindow, composeKey);
                  injectedComposeWindows.add(composeKey);
              } else {
                   console.warn("Could not find body for existing compose window on init. Skipping injection for:", composeKey);
              }

              // Optional: Add observer to clean up history when compose window is removed
              const composeObserver = new MutationObserver((composeMutations) => {
                  if (!document.body.contains(composeWindow)) {
                      console.log("Compose window removed, cleaning up history for key:", composeKey);
                      conversationHistories.delete(composeKey);
                      injectedComposeWindows.delete(composeKey);
                      composeBodyMap.delete(composeKey); // Clean up body reference
                      // Also remove the panel from the body when compose window closes
                      const panel = document.getElementById(GMAIL_AI_PANEL_ID);
                      if (panel) panel.remove();
                      composeObserver.disconnect();
                  }
              });
              // Observe the parent of the compose window for removal
              composeObserver.observe(composeWindow.parentElement || document.body, { childList: true, subtree: true });

            }
          }
        }
      });
    }
  }
}

// --- Initialization --- //

function initialize() {
    console.log("Initializing Gmail AI content script injection observer.");
    // Start observing the document body for changes
    const observer = new MutationObserver(handleMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial check in case compose window is already open
    document.querySelectorAll('.M9').forEach(composeWindow => {
        const composeKey = composeWindow.getAttribute('data-gmail-ai-key') || `compose-${Date.now()}-${Math.random()}`;
        composeWindow.setAttribute('data-gmail-ai-key', composeKey);
        if (!injectedComposeWindows.has(composeKey)) {
            console.log('Found existing compose window on init:', composeWindow, 'Key:', composeKey);
            // Find body *before* injecting, to ensure it's stored if injection happens
            const bodyForInit = findComposeBody(composeWindow);
            if (bodyForInit) {
                composeBodyMap.set(composeKey, bodyForInit); // Store immediately
                injectAIButtonAndPanel(composeWindow, composeKey);
                injectedComposeWindows.add(composeKey);
            } else {
                 console.warn("Could not find body for existing compose window on init. Skipping injection for:", composeKey);
            }
        }
    });
}

// Run initialization logic
// Use a small delay or wait for window load to ensure Gmail UI is somewhat ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
