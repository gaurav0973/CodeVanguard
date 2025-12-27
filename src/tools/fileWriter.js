const fs = require('fs');
const path = require('path');

async function writeFileContent({ filePath, content }) {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("Written to:", filePath);
    return { 
        success: true 
    };
  } catch (error) {
    return { 
        error: `Failed to write file: ${error.message}` 
    };
  }
}

module.exports = {
  writeFileContent
};