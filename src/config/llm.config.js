const { TOOLS } = require("./tools.config");
const { GoogleGenAI } = require("@google/genai");
const {
  listDownAllFiles,
  readFileContent,
  writeFileContent,
} = require("../tools/index");
const { systemInstructions } = require("../constants/prompt");

const TOOL_FUNCTIONS = {
  listDownAllFiles: listDownAllFiles,
  readFileContent: readFileContent,
  writeFileContent: writeFileContent,
};

// logger 
function log(outputChannel, message) {
  console.log(message);
  if (outputChannel) {
    outputChannel.appendLine(message);
  }
}

async function runAgent(directoryPath, apiKey, outputChannel) {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  log(outputChannel, `🔍 Reviewing: ${directoryPath}\n`);

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `Review and fix all JavaScript/TypeScript code in: ${directoryPath}`,
        },
      ],
    },
  ];

  const MAX_TURNS = 10;

  for (let i = 0; i < MAX_TURNS; i++) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstructions(),
        tools: TOOLS,
      },
    });

    if (result.functionCalls?.length > 0) {
      for (const functionCall of result.functionCalls) {
        const { name, args } = functionCall;

        log(outputChannel, `📌 ${name}`);

        const toolResponse = await TOOL_FUNCTIONS[name](args);

        contents.push({
          role: "model",
          parts: [{ functionCall }],
        });

        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: { result: toolResponse },
              },
            },
          ],
        });
      }
    } else {
      log(outputChannel, "\n" + result.text);
      break;
    }
  }
}

module.exports = {
  runAgent,
};
