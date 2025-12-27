const  { TOOLS } = require("./tools.config");
const  { GoogleGenAI } =  require("@google/genai");

const  { listDownAllFiles, readFileContent, writeFileContent } = require("../tools/index");
const { systemInstructions } = require("../constants/prompt");
require('dotenv').config()


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TOOL_FUNCTIONS = {
  listDownAllFiles: listDownAllFiles,
  readFileContent: readFileContent,
  writeFileContent: writeFileContent,
};

async function runAgent(directoryPath) {
  console.log(`🔍 Reviewing: ${directoryPath}\n`);

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
        tools: TOOLS
      },
    });
    if (result.functionCalls?.length > 0) {
      for (const functionCall of result.functionCalls) {
        const { name, args } = functionCall;

        console.log(`📌 ${name}`);
        const toolResponse = await TOOL_FUNCTIONS[name](args);
        // Add function call to history
        contents.push({
          role: "model",
          parts: [{ functionCall }],
        });

        // Add function response to history
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
      console.log("\n" + result.text);
      break;
    }
  }
}


module.exports = {
  runAgent
};
