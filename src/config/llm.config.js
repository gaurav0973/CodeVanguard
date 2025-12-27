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
  let metrics = { files: 0, issues: 0, fixed: 0, quality: 0 };

  for (let i = 0; i < MAX_TURNS; i++) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstructions(),
        tools: TOOLS,
      },
    });

    // Parse metrics from every response
    const responseText = result.text || "";
    const metricsMatch = responseText.match(
      /\[METRICS\]\s*Files:\s*(\d+),\s*Issues:\s*(\d+),\s*Fixed:\s*(\d+),\s*Quality:\s*(\d+)\/10/
    );
    if (metricsMatch) {
      metrics = {
        files: parseInt(metricsMatch[1]),
        issues: parseInt(metricsMatch[2]),
        fixed: parseInt(metricsMatch[3]),
        quality: parseInt(metricsMatch[4]),
      };

      console.log("📊 Metrics updated:", metrics); // Debug log

      // Send metrics update to webview
      if (outputChannel.updateMetrics) {
        outputChannel.updateMetrics(metrics);
      }
    }

    if (result.functionCalls?.length > 0) {
      for (const functionCall of result.functionCalls) {
        const { name, args } = functionCall;

        log(outputChannel, `📌 ${name}`);

        const toolResponse = await TOOL_FUNCTIONS[name](args);

        // Update metrics based on tool usage
        if (name === "listDownAllFiles") {
          // When listing files, we can estimate the number of files
          const fileList = toolResponse.result || [];
          metrics.files = fileList.length;
          if (outputChannel.updateMetrics) {
            outputChannel.updateMetrics(metrics);
          }
        } else if (name === "readFileContent") {
          // Increment files analyzed when reading content
          metrics.files = Math.max(metrics.files, metrics.files + 1);
          if (outputChannel.updateMetrics) {
            outputChannel.updateMetrics(metrics);
          }
        }

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
      const responseText = result.text;

      log(outputChannel, "\n" + responseText);
      break;
    }
  }

  // Send final metrics
  if (outputChannel.updateMetrics) {
    outputChannel.updateMetrics(metrics);
  }
}

module.exports = {
  runAgent,
};
