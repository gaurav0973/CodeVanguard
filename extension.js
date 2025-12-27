const vscode = require("vscode");
const SidebarProvider = require("./src/sidebar/SidebarProvider");

function activate(context) {
  // Register the Sidebar Provider
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "codevanguard.sidebarView",
      sidebarProvider
    )
  );

  // Command to open the sidebar
  let disposable = vscode.commands.registerCommand(
    "codevanguard.startReview",
    async () => {
      await vscode.commands.executeCommand("codevanguard.sidebarView.focus");
    }
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
