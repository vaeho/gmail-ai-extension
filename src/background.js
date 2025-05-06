import OpenAI from 'openai';
import { Buffer } from 'buffer'; // Polyfill needed by openai

// Polyfill global Buffer
if (typeof global === 'undefined') {
  window.global = window;
}
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}


console.log("Background script loaded.");

// Function to get settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'apiKey',
      'baseURL',
      'model',
      'systemPrompt'
    ], (items) => {
      resolve({
        apiKey: items.apiKey,
        baseURL: items.baseURL || providers[defaultProviderKey].baseURL, // Use default provider's URL if unset
        model: items.model || defaultModel, // Use the consistent default model
        systemPrompt: items.systemPrompt || defaultSystemPrompt // Use the consistent default prompt
      });
    });
  });
}

// Define defaults here, matching options.js
const defaultProviderKey = 'google'; // Match options.js
const defaultModel = 'gemini-2.0-flash'; // Match options.js
const defaultSystemPrompt = 'You are a helpful assistant writing emails.';

// Need the providers object here too to get the default baseURL
const providers = {
    google: { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai" }, // Default provider URL
    // openrouter: { baseURL: "https://openrouter.ai/api/v1" },
    // Add other providers if their baseURLs might be needed, though strictly only the default is necessary here
};

// --- Content Script Injection --- //

// Function to inject the content script
async function injectContentScript(tabId) {
  try {
    console.log(`Attempting to inject content script into tab ${tabId}`);
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.bundle.js']
    });
    console.log(`Successfully injected content script into tab ${tabId}`);
  } catch (err) {
    // Avoid errors like "Cannot access contents of url" or if injection already happened
    if (err.message.includes("Cannot access contents of url") ||
        err.message.includes("Receiving end does not exist") ||
        err.message.includes("Missing host permission")) {
      // console.warn(`Skipping injection for tab ${tabId}: ${err.message}`);
    } else {
        console.error(`Failed to inject content script into tab ${tabId}:`, err);
    }

  }
}

// Inject when a Gmail tab is updated (e.g., navigating within Gmail)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('://mail.google.com/')) {
    console.log(`Gmail tab updated: ${tabId}, URL: ${tab.url}`);
    injectContentScript(tabId);
  }
});

// Inject when a new Gmail tab is created
chrome.tabs.onCreated.addListener((tab) => {
    if (tab.url && tab.url.includes('://mail.google.com/')) {
        // May need to wait for the tab to finish loading, listen to onUpdated instead or add delay
        // For now, try injecting directly, but onUpdated is more reliable
        console.log(`Gmail tab created: ${tab.id}, URL: ${tab.url}`);
        // Injecting via onUpdated might be sufficient
        // injectContentScript(tab.id);
    }
});


// --- API Call Logic --- //

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);
  if (request.action === 'generateEmail') {
    handleGenerateEmail(request.prompt, request.history)
      .then(response => {
        console.log("Sending response:", response);
        sendResponse({ success: true, text: response });
      })
      .catch(error => {
        // Log the full error object for more details
        console.error("Error generating email (full error object):", error);
        // Respond with a potentially more specific message if available
        let errorMessage = "An unexpected error occurred.";
        if (error instanceof Error) {
             errorMessage = `API Error: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `API Error: ${error}`;
        }
        sendResponse({ success: false, error: errorMessage });
      });
    return true; // Indicates that the response is sent asynchronously
  }
  // Handle other actions if needed
  return false; // No async response
});

async function handleGenerateEmail(prompt, history = []) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error("API key is not set. Please configure it in the extension options.");
  }

  const openai = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
    dangerouslyAllowBrowser: true, // Necessary for using in browser context
  });

  const baseSystemPrompt = "You are an AI assistant integrated into Gmail. Your primary goal is to help users write emails. Respond with a complete email body (no subject), ready to be inserted, no placeholders or formatting unless you are missing crucial information like names or addresses. For the rest follow instructions provided below.";
  const userSystemPrompt = settings.systemPrompt || "You are a helpful assistant writing emails."; // Use saved or default user prompt
  const combinedSystemPrompt = `${baseSystemPrompt}\n\n${userSystemPrompt}`;

  const messages = [
    { role: 'system', content: combinedSystemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];

  // Log critical settings just before the call
  console.log("Attempting API call with:");
  console.log(`   Base URL: ${settings.baseURL}`);
  // Mask most of the API key for security in logs
  const maskedApiKey = settings.apiKey ? `${settings.apiKey.substring(0, 4)}...${settings.apiKey.substring(settings.apiKey.length - 4)}` : "NOT SET";
  console.log(`   API Key (Masked): ${maskedApiKey}`);
  console.log(`   Model: ${settings.model}`);
  // Log the combined prompt for debugging
  console.log(`   System Prompt (Combined): ${combinedSystemPrompt.substring(0, 100)}...`);
  // ----------------------------------------------------

  try {
    const completion = await openai.chat.completions.create({
      model: settings.model,
      messages: messages,
      // stream: false // Set to true if you want streaming later
    });

    console.log("Received response from AI:", completion);

    if (completion.choices && completion.choices.length > 0) {
      const generatedText = completion.choices[0].message?.content;
      if (generatedText) {
        return generatedText.trim();
      } else {
        throw new Error("Received an empty response from the AI.");
      }
    } else {
      throw new Error("Received no choices from the AI.");
    }
  } catch (error) {
    // Log the full error object here too for debugging API call issues
    console.error('Error calling AI API (full error object): ', error);
    console.error('Error Name:', error?.name);
    console.error('Error Message:', error?.message);
    console.error('Error Cause:', error?.cause);
    console.error('Error Stack:', error?.stack);

    // Try to provide a more specific error message if possible
    if (error.response) {
        console.error('API Error Response Data:', error.response.data);
        console.error('API Error Response Status:', error.response.status);
        console.error('API Error Response Headers:', error.response.headers);
        // Try to extract a message from standard OpenAI error structure or the response text
        const errorMsg = error.response.data?.error?.message || error.response.data || error.message;
        throw new Error(`API Error: ${error.response.status} ${errorMsg}`);
    } else if (error.request) {
        console.error('API Error Request:', error.request);
        throw new Error("API Error: No response received from server. Check network or endpoint URL.");
    } else {
        // General error during setup or call
        throw new Error(`API Error: ${error.message || 'Unknown error during API call'}`);
    }
  }
}

console.log("Background script event listeners registered.");