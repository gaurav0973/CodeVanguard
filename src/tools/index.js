const { readFileContent } = require('./fileReader');
const { listDownAllFiles } = require('./fileScanner');
const { writeFileContent } = require('./fileWriter');

module.exports = {
  listDownAllFiles,
  readFileContent,
  writeFileContent
};