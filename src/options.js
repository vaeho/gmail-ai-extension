// --- Provider Configuration --- //
const providers = {
    google: { name: "Google Gemini (Default)", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash-lite" },
    openai: { name: "OpenAI", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
    anthropic: { name: "Anthropic Claude", baseURL: "https://api.anthropic.com/v1/", defaultModel: "claude-3-haiku-20240307" },
    groq: { name: "Groq", baseURL: "https://api.groq.com/openai/v1", defaultModel: "llama3-8b-8192" },
    deepseek: { name: "DeepSeek", baseURL: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
    openrouter: { name: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", defaultModel: "google/gemini-2.0-flash-lite" }
};

const defaultProviderKey = 'google'; // Set Google as the default provider
const defaultModel = providers[defaultProviderKey].defaultModel;
const defaultSystemPrompt = 'You are a helpful assistant writing emails.';

// --- DOM Elements --- //
let apiKeyInput, providerSelect, modelInput, systemPromptInput, saveButton, statusDiv;

document.addEventListener('DOMContentLoaded', () => {
    // Assign elements after DOM is ready
    apiKeyInput = document.getElementById('apiKey');
    providerSelect = document.getElementById('provider');
    modelInput = document.getElementById('model');
    systemPromptInput = document.getElementById('systemPrompt');
    saveButton = document.getElementById('save');
    statusDiv = document.getElementById('status');

    populateProviderDropdown();
    restoreOptions();

    providerSelect.addEventListener('change', handleProviderChange);
    saveButton.addEventListener('click', saveOptions);
});

// --- Functions --- //

function populateProviderDropdown() {
    // Clear existing options first to prevent duplicates
    providerSelect.innerHTML = '';

    for (const key in providers) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = providers[key].name;
        providerSelect.appendChild(option);
    }
}

function handleProviderChange() {
    const selectedProviderKey = providerSelect.value;
    const selectedProvider = providers[selectedProviderKey];
    modelInput.placeholder = `e.g., ${selectedProvider.defaultModel || 'enter model name'}`;
    // Set default model for the selected provider if model field is empty or was just cleared
    if (!modelInput.value) {
        modelInput.value = selectedProvider.defaultModel || '';
    }
}

// Function to save options to chrome.storage.local
function saveOptions() {
  const apiKey = apiKeyInput.value;
  const selectedProviderKey = providerSelect.value;
  const baseURL = providers[selectedProviderKey].baseURL;
  let model = modelInput.value.trim();

  if (!model) {
      // If model is empty when saving a preset, use the provider's default
      model = providers[selectedProviderKey].defaultModel;
  }

  const systemPrompt = systemPromptInput.value.trim() || defaultSystemPrompt;

  chrome.storage.local.set({
    apiKey: apiKey,
    baseURL: baseURL,
    model: model,
    systemPrompt: systemPrompt
  }, () => {
    statusDiv.textContent = 'Options saved.';
    statusDiv.style.color = 'green'; // Ensure positive feedback color
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 1500);
  });
}

// Function to restore options from chrome.storage.local
function restoreOptions() {
  chrome.storage.local.get({
    apiKey: '',
    baseURL: providers[defaultProviderKey].baseURL, // Default to default provider URL
    model: defaultModel,
    systemPrompt: defaultSystemPrompt
  }, (items) => {
    apiKeyInput.value = items.apiKey;
    systemPromptInput.value = items.systemPrompt;
    modelInput.value = items.model;

    // Determine which provider matches the saved baseURL
    let foundProviderKey = defaultProviderKey; // Default to the main default
    for (const key in providers) {
        if (providers[key].baseURL === items.baseURL) {
            foundProviderKey = key;
            break;
        }
    }

    providerSelect.value = foundProviderKey;

    // Always ensure model placeholder is correct for the loaded provider
    modelInput.placeholder = `e.g., ${providers[foundProviderKey]?.defaultModel || 'enter model name'}`;
    // If the saved model is empty for some reason, fill with default for provider
    if (!items.model) {
         modelInput.value = providers[foundProviderKey]?.defaultModel || '';
    }

  });
}
