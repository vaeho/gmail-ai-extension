# Privacy Policy for Gmail AI Assistant

**Last Updated:** [Date]

## 1. Data Handling

This extension does not:

- Collect, store, or transmit your emails
- Log your AI-generated content
- Track your usage statistics

All processing occurs locally in your browser.

## 2. Storage Practices

We store only:

- Your configured API key (encrypted in browser storage)
- Selected AI provider preferences
- Custom system prompt (if set)

Location: `chrome.storage.local` (accessible via Chrome's extension settings)

## 3. Permission Usage

| Permission        | Purpose                           |
| ----------------- | --------------------------------- |
| `storage`         | Save/Load your settings           |
| `scripting`       | Inject UI elements into Gmail     |
| `mail.google.com` | Add AI tools to compose window    |
| API domains\*     | Connect to your chosen AI service |

\*API domains include: generativelanguage.googleapis.com, api.openai.com, api.anthropic.com

## 4. AI Service Providers

When you use this extension:

- Prompts are sent directly to your configured AI provider
- We never intermediate or store these communications
- Provider-specific policies apply

## 5. User Control

You can:

1. Review stored data via Chrome's Extension Manager
2. Wipe all data by uninstalling the extension
3. Revoke API keys via your provider's dashboard

## 6. Changes & Contact

Policy updates will be posted here. Questions? Contact: vvakhtangishvili7@gmail.com
