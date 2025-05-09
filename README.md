# Gmail AI Assistant Extension

This Chrome extension enhances your Gmail experience by integrating an AI assistant directly into the compose window.

## Features

- **AI Write Button:** Adds a '✨' button to the Gmail compose toolbar.
- **AI Panel:** Clicking the button opens a draggable panel next to your compose window.
- **AI Interaction:**
  - Type prompts into the panel's text area.
  - Click "Generate" (or use Ctrl+Enter) to get AI-generated text.
  - Supports follow-up instructions (maintains conversation history per compose window).
  - Generated text replaces the content of the email body.
- **Configuration:**
  - Set your AI provider API Key.
  - Choose your AI provider (currently supports OpenAI-compatible APIs like Google Gemini, Anthropic, Deepseek, Openrouter, etc. via specific endpoints).
  - Select the specific AI model.
  - Define a custom system prompt for personalized AI behavior.
  - Settings are accessed via the extension icon in the Chrome toolbar.
- **Modern UI:** Simple, clean panel design.

## Setup & Installation

### For Users:

1. **Install from Chrome Web Store:** For a quick and easy setup, visit the [Gmail AI Assistant extension on the Chrome Web Store](https://chromewebstore.google.com/detail/gmail-ai-assistant/kpfahmlbfebaepelpgeggceongcmmchd) and click "Add to Chrome". This method allows you to install the extension directly without building from source.
2. **Configure:** After installation, click the extension's icon in your Chrome toolbar to open the options page. Enter your API key and configure other settings as needed.

### For Developers:

1. **Clone or Download:** Get the extension code from the repository.
2. **Install Dependencies:** Navigate to the `gmail-ai-extension` directory in your terminal and run:
   ```bash
   npm install
   ```
3. **Build the Extension:** Run the build command:
   ```bash
   npm run build
   ```
   This will create the necessary bundled files in the `gmail-ai-extension/dist` directory.
4. **Load into Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode" using the toggle switch in the top-right corner.
   - Click the "Load unpacked" button.
   - Select the `gmail-ai-extension/dist` directory.
5. **Configure:** Click the extension's icon in your Chrome toolbar to open the options page. Enter your API key and configure other settings as needed.

## Usage

1.  Open Gmail and start composing a new email or reply.
2.  Click the '✨' button in the compose toolbar.
3.  The AI panel will appear. Enter your prompt and click "Generate" or press Ctrl+Enter.
4.  The generated text will appear in your email body.
5.  You can continue the conversation by typing follow-up prompts in the panel.
6.  Use the "Clear History" button in the panel to start a fresh conversation for that specific email.
7.  Drag the panel header to reposition it.
8.  Close the panel using the 'X' button or by pressing the Escape key.

## Development

- **Bundler:** Webpack
- **Manifest:** Version 3
- **Main Components:**
  - `src/background.js`: Handles API calls, settings management, and message passing.
  - `src/content.js`: Injects the button/panel into Gmail, handles UI interactions.
  - `src/options.js` / `public/options.html`: Manages the settings page.
  - `public/manifest.json`: Extension configuration.
  - `public/styles.css`: Styling for injected elements.
