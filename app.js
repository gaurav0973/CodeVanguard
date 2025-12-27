const { runAgent } = require("./src/config/llm.config");

const directoryPath = process.argv[2] || "./";

console.log(`Starting Code Reviewer Agent on directory: ${directoryPath}`);
(async () => {
  await runAgent(directoryPath);
})();
