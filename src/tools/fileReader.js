const fs = require('fs');
const path = require('path');

async function readFileContent({ filePath }) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    console.log("Read file:", filePath);
    return { 
        content 
    };
  }catch (error) {
    return { 
        error: `Failed to read file: ${error.message}` 
    };
  }
}

module.exports = {
  readFileContent
};