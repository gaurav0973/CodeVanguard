const vscode = require("vscode");
const { runAgent } = require("../config/llm.config");

class SidebarProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._view = undefined;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "startReview": {
          this.startReview();
          break;
        }
        case "saveApiKey": {
          const config = vscode.workspace.getConfiguration("codevanguard");
          await config.update(
            "apiKey",
            data.value,
            vscode.ConfigurationTarget.Global
          );
          vscode.window.showInformationMessage("API Key saved successfully!");
          this._view.webview.postMessage({ type: "apiKeySaved" });
          break;
        }
        case "checkApiKey": {
          const config = vscode.workspace.getConfiguration("codevanguard");
          const apiKey = config.get("apiKey");
          if (apiKey) {
            this._view.webview.postMessage({ type: "apiKeySaved" });
          }
          break;
        }
      }
    });
  }

  async startReview() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("Please open a folder to review.");
      return;
    }

    const items = [];

    // 1. Entire Workspace
    items.push({
      label: "$(root-folder) Review Entire Workspace",
      description: "Analyze all files in the project",
      target: workspaceFolders[0].uri.fsPath,
    });

    // 2. Active File
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      items.push({
        label: "$(file) Review Active File",
        description: vscode.workspace.asRelativePath(activeEditor.document.uri),
        target: activeEditor.document.uri.fsPath,
      });
    }

    // 3. Folders
    const folders = await this.getFolders(workspaceFolders[0].uri);
    folders.forEach((folder) => {
      items.push({
        label: `$(folder) ${vscode.workspace.asRelativePath(folder)}`,
        target: folder.fsPath,
      });
    });

    // 4. All Files
    const files = await vscode.workspace.findFiles(
      "**/*",
      "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**}"
    );
    files.forEach((file) => {
      items.push({
        label: `$(file-code) ${vscode.workspace.asRelativePath(file)}`,
        target: file.fsPath,
      });
    });

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a file, folder, or scope to review",
      matchOnDescription: true,
    });

    if (!selection) return;

    const rootPath = selection.target;

    const config = vscode.workspace.getConfiguration("codevanguard");
    const apiKey = config.get("apiKey");

    if (!apiKey) {
      this._view.webview.postMessage({ type: "askApiKey" });
      return;
    }

    this._view.webview.postMessage({
      type: "addLog",
      value: `Starting review in: ${rootPath}`,
    });

    // Send initial metrics
    this._view.webview.postMessage({
      type: "updateMetrics",
      metrics: { files: 0, issues: 0, fixed: 0, quality: 0 },
    });

    try {
      // Pass a callback to stream logs to the webview
      await runAgent(rootPath, apiKey, {
        appendLine: (msg) => {
          if (this._view) {
            this._view.webview.postMessage({ type: "addLog", value: msg });
          }
        },
        updateMetrics: (metrics) => {
          if (this._view) {
            this._view.webview.postMessage({ type: "updateMetrics", metrics });
          }
        },
      });
      this._view.webview.postMessage({
        type: "addLog",
        value: "Review Completed!",
      }); // Remove loading state
      this._view.webview.postMessage({ type: "reviewCompleted" });
    } catch (error) {
      this._view.webview.postMessage({
        type: "addLog",
        value: `Error: ${error.message}`,
      });
      // Remove loading state on error
      this._view.webview.postMessage({ type: "reviewCompleted" });
    }
  }

  async getFolders(rootUri) {
    const folders = [];
    await this.collectFolders(rootUri, folders);
    return folders;
  }

  async collectFolders(uri, folders) {
    const excluded = ["node_modules", ".git", "dist", "out", "build"];
    const entries = await vscode.workspace.fs.readDirectory(uri);
    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory && !excluded.includes(name)) {
        const folderUri = vscode.Uri.joinPath(uri, name);
        folders.push(folderUri);
        // Recursively collect subfolders
        await this.collectFolders(folderUri, folders);
      }
    }
  }

  _getHtmlForWebview(webview) {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .header {
                    padding: 16px 20px 12px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-titleBar-activeBackground);
                }

                .header h2 {
                    margin: 0;
                    font-size: 1.2em;
                    font-weight: 600;
                    color: var(--vscode-titleBar-activeForeground);
                }

                .header p {
                    margin: 4px 0 0;
                    font-size: 0.9em;
                    opacity: 0.8;
                    color: var(--vscode-titleBar-activeForeground);
                }

                .content {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                }

                .section {
                    margin-bottom: 24px;
                }

                .section:last-child {
                    margin-bottom: 0;
                }

                .section h3 {
                    margin: 0 0 12px 0;
                    font-size: 1em;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .api-key-section {
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 6px;
                    padding: 16px;
                    margin-bottom: 16px;
                }

                .api-key-section p {
                    margin: 0 0 12px 0;
                    font-size: 0.9em;
                }

                .input-group {
                    display: flex;
                    gap: 8px;
                    align-items: stretch;
                }

                input[type="password"] {
                    flex: 1;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    padding: 8px 12px;
                    font-size: 0.9em;
                    outline: none;
                }

                input[type="password"]:focus {
                    border-color: var(--vscode-focusBorder);
                    outline: 1px solid var(--vscode-focusBorder);
                }

                .btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 3px;
                    padding: 8px 16px;
                    font-size: 0.9em;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.1s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                }

                .btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .btn:active {
                    transform: translateY(1px);
                }

                .btn-primary {
                    background: var(--vscode-button-background);
                    min-width: 120px;
                    justify-content: center;
                }

                .btn-primary:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .logs-container {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    overflow: hidden;
                }

                .logs-header {
                    background: var(--vscode-titleBar-activeBackground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding: 8px 12px;
                    font-size: 0.8em;
                    font-weight: 600;
                    color: var(--vscode-titleBar-activeForeground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                #logs {
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    border: none;
                    padding: 12px;
                    height: 250px;
                    overflow-y: auto;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.85em;
                    line-height: 1.4;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                #logs:empty::before {
                    content: "Ready to start code review...";
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }

                .hidden {
                    display: none !important;
                }

                .metrics-section {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 16px;
                    margin-bottom: 16px;
                    display: none;
                }

                .metrics-section.visible {
                    display: block;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .metric-item {
                    text-align: center;
                    padding: 12px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }

                .metric-value {
                    display: block;
                    font-size: 1.5em;
                    font-weight: bold;
                    color: var(--vscode-charts-blue);
                    margin-bottom: 4px;
                }

                .metric-label {
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .rating-section {
                    text-align: center;
                    padding: 16px;
                    background: linear-gradient(135deg, var(--vscode-charts-green) 0%, var(--vscode-charts-blue) 100%);
                    border-radius: 8px;
                    color: white;
                    display: none;
                }

                .rating-section.visible {
                    display: block;
                }

                .rating-score {
                    font-size: 3em;
                    font-weight: bold;
                    margin: 8px 0;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .rating-label {
                    font-size: 0.9em;
                    opacity: 0.9;
                }

                .progress-bar {
                    width: 100%;
                    height: 6px;
                    background: var(--vscode-progressBar-background);
                    border-radius: 3px;
                    overflow: hidden;
                    margin: 8px 0;
                }

                .progress-fill {
                    height: 100%;
                    background: var(--vscode-progressBar-foreground);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                    width: 0%;
                }

                .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--vscode-charts-green);
                    margin-right: 8px;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .loading .status-indicator {
                    background: var(--vscode-charts-yellow);
                }

                .error .status-indicator {
                    background: var(--vscode-charts-red);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>🛡️ Code Vanguard</h2>
                <p>AI-Powered Code Review Assistant</p>
            </div>

            <div class="content">
                <div id="apiKeySection" class="section hidden fade-in">
                    <div class="api-key-section">
                        <p>🔑 Configure your Gemini API Key to get started:</p>
                        <div class="input-group">
                            <input type="password" id="apiKeyInput" placeholder="Enter your Gemini API key..." />
                            <button id="saveKeyBtn" class="btn">Save Key</button>
                        </div>
                    </div>
                </div>

                <div id="mainSection" class="section">
                    <button id="startBtn" class="btn btn-primary">
                        <span class="status-indicator"></span>
                        Start Code Review
                    </button>

                    <div id="metricsSection" class="metrics-section">
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span id="filesCount" class="metric-value">0</span>
                                <span class="metric-label">Files</span>
                            </div>
                            <div class="metric-item">
                                <span id="issuesCount" class="metric-value">0</span>
                                <span class="metric-label">Issues</span>
                            </div>
                            <div class="metric-item">
                                <span id="fixedCount" class="metric-value">0</span>
                                <span class="metric-label">Fixed</span>
                            </div>
                            <div class="metric-item">
                                <span id="qualityScore" class="metric-value">0</span>
                                <span class="metric-label">Quality</span>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div id="progressFill" class="progress-fill"></div>
                        </div>
                    </div>

                    <div id="ratingSection" class="rating-section">
                        <div class="rating-label">Final Code Quality Rating</div>
                        <div id="finalRating" class="rating-score">0/10</div>
                        <div class="rating-label">Out of 10</div>
                    </div>

                    <div class="logs-container">
                        <div class="logs-header">Activity Log</div>
                        <div id="logs"></div>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                const apiKeySection = document.getElementById('apiKeySection');
                const mainSection = document.getElementById('mainSection');
                const metricsSection = document.getElementById('metricsSection');
                const ratingSection = document.getElementById('ratingSection');
                const logsDiv = document.getElementById('logs');
                const startBtn = document.getElementById('startBtn');
                const saveKeyBtn = document.getElementById('saveKeyBtn');
                const apiKeyInput = document.getElementById('apiKeyInput');

                function updateMetricsDisplay(metrics) {
                    console.log('🎯 Updating UI metrics:', metrics); // Debug log
                    document.getElementById('filesCount').textContent = metrics.files;
                    document.getElementById('issuesCount').textContent = metrics.issues;
                    document.getElementById('fixedCount').textContent = metrics.fixed;
                    document.getElementById('qualityScore').textContent = metrics.quality;

                    // Update progress bar based on completion
                    const progress = metrics.quality > 0 ? (metrics.quality / 10) * 100 : 0;
                    document.getElementById('progressFill').style.width = progress + '%';

                    // Show rating if quality > 0
                    if (metrics.quality > 0) {
                        ratingSection.classList.add('visible');
                        document.getElementById('finalRating').textContent = metrics.quality + '/10';
                    }
                }

                // Check API Key on load
                vscode.postMessage({ type: 'checkApiKey' });

                startBtn.addEventListener('click', () => {
                    logsDiv.innerHTML = ''; // Clear logs
                    startBtn.classList.add('loading');
                    metricsSection.classList.add('visible');
                    ratingSection.classList.remove('visible');
                    // Reset metrics
                    updateMetricsDisplay({ files: 0, issues: 0, fixed: 0, quality: 0 });
                    vscode.postMessage({ type: 'startReview' });
                });

                saveKeyBtn.addEventListener('click', () => {
                    const key = apiKeyInput.value;
                    if(key) {
                        vscode.postMessage({ type: 'saveApiKey', value: key });
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'addLog':
                            logsDiv.innerHTML += message.value + '\\n';
                            logsDiv.scrollTop = logsDiv.scrollHeight;
                            break;
                        case 'updateMetrics':
                            console.log('📨 Received metrics message:', message.metrics); // Debug log
                            updateMetricsDisplay(message.metrics);
                            break;
                        case 'reviewCompleted':
                            startBtn.classList.remove('loading');
                            break;
                        case 'askApiKey':
                            apiKeySection.classList.remove('hidden');
                            mainSection.classList.add('hidden');
                            break;
                        case 'apiKeySaved':
                            apiKeySection.classList.add('hidden');
                            mainSection.classList.remove('hidden');
                            apiKeyInput.value = '';
                            startBtn.classList.remove('loading');
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
  }
}

module.exports = SidebarProvider;
