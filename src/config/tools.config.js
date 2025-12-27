const { Type } = require("@google/genai")
const listFileTool = {
  name: "listDownAllFiles",
  description: "List down all code files in the given directory path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      directoryPath: {
        type: Type.STRING,
        description: "The directory path where to scan for code files.",
      },
    },
    required: ["directoryPath"],
  },
};

const readFileTool = {
  name: "readFileContent",
  description: "Read the content of a code file given its file path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The full path of the code file to read.",
      },
    },
    required: ["filePath"],
  },
};

const writeFileTool = {
  name: "writeFileContent",
  description: "Write content to a code file given its file path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The full path of the code file to write.",
      },
      content: {
        type: Type.STRING,
        description: "The content to write into the code file.",
      },
    },
    required: ["filePath", "content"],
  },
};
const TOOLS = [
    {
        functionDeclarations : [listFileTool, readFileTool, writeFileTool],
    }
]
module.exports = {
  TOOLS
};