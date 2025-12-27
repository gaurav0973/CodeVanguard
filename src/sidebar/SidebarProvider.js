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

    try {
      // Pass a callback to stream logs to the webview
      await runAgent(rootPath, apiKey, {
        appendLine: (msg) => {
          if (this._view) {
            this._view.webview.postMessage({ type: "addLog", value: msg });
          }
        },
      });
      this._view.webview.postMessage({
        type: "addLog",
        value: "Review Completed!",
      });
    } catch (error) {
      this._view.webview.postMessage({
        type: "addLog",
        value: `Error: ${error.message}`,
      });
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
                body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-editor-foreground); }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; cursor: pointer; width: 100%; margin-bottom: 10px; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
                #logs { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; height: 300px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; font-size: 0.9em; }
                .hidden { display: none; }
            </style>
        </head>
        <body>
            <h2>Code Vanguard</h2>
            
            <div id="apiKeySection" class="hidden">
                <p>Please enter your Gemini API Key:</p>
                <input type="password" id="apiKeyInput" placeholder="Paste API Key here..." />
                <button id="saveKeyBtn">Save API Key</button>
            </div>

            <div id="mainSection">
                <button id="startBtn">Start Code Review</button>
                <div id="logs"></div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                const apiKeySection = document.getElementById('apiKeySection');
                const mainSection = document.getElementById('mainSection');
                const logsDiv = document.getElementById('logs');
                const startBtn = document.getElementById('startBtn');
                const saveKeyBtn = document.getElementById('saveKeyBtn');
                const apiKeyInput = document.getElementById('apiKeyInput');

                // Check API Key on load
                vscode.postMessage({ type: 'checkApiKey' });

                startBtn.addEventListener('click', () => {
                    logsDiv.innerHTML = ''; // Clear logs
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
                        case 'askApiKey':
                            apiKeySection.classList.remove('hidden');
                            mainSection.classList.add('hidden');
                            break;
                        case 'apiKeySaved':
                            apiKeySection.classList.add('hidden');
                            mainSection.classList.remove('hidden');
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
  }
}

module.exports = SidebarProvider;
