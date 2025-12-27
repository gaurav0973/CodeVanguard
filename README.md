# Code Vanguard

AI-powered code reviewer and fixer for Visual Studio Code.

## Features

- **Intelligent Code Review**: Uses Google's Gemini AI to analyze your code
- **Multi-scope Review**: Review entire workspace, active file, or specific folders
- **Real-time Feedback**: Get suggestions and fixes directly in VS Code
- **Secure**: Your code stays local, only analysis requests sent to AI

## Requirements

- Visual Studio Code 1.80.0 or later
- A Google Gemini API key (get one at [Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

1. Install from VS Code Marketplace: Search for "Code Vanguard"
2. Or download the .vsix file and install manually

## Setup

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. In VS Code, go to Settings → Extensions → Code Vanguard
3. Enter your API key in the "Api Key" field

## Usage

1. Open the Code Vanguard sidebar from the activity bar (shield icon)
2. Click "Start Code Review"
3. Choose what to review:
   - **Entire Workspace**: Analyze all files in your project
   - **Active File**: Review the currently open file
   - **Folders**: Select specific folders to analyze
   - **Individual Files**: Pick specific files
4. Wait for the AI analysis to complete
5. Review suggestions and apply fixes as needed

## Supported Languages

- JavaScript
- TypeScript
- Python
- And more...

## Privacy

- Your code is analyzed locally
- Only analysis requests are sent to Google's Gemini API
- No code is stored or transmitted permanently

## Contributing

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/gaurav0973/CodeVanguard).

## License

MIT License - see [LICENSE](LICENSE) file for details.
