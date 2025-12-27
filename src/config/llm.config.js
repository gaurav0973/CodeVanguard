const  { TOOLS } = require("./tools.config");
const  { GoogleGenAI, Type } =  require("@google/genai");

const  { listDownAllFiles, readFileContent, writeFileContent } = require("../tools/index");
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
        systemInstruction: `You are an expert Code Reviewer Agent.

                1. Start by using "listDownAllFiles" to see the project structure.
                2. Read files using "readFileContent".
                3. Fix bugs, add comments, and improve code quality.
                4. Write the fixed code back using "writeFileContent".
                5. Once finished, provide a text summary.
                
                IMPORTANT: When writing files, maintain the existing code style and imports.`,
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
