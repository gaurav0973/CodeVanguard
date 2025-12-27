const path = require("path");
const { glob } = require("glob");

async function listDownAllFiles({ directoryPath }) {
  const extensions = ["js", "jsx", "ts", "tsx", "json", "html", "css"];

  const pattern = `**/*.+(${extensions.join("|")})`;

  const files = await glob(pattern, {
    cwd: directoryPath,
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
    ],
  });

  console.log("Total files found:", files.length);
  return { files };
}

module.exports = {
  listDownAllFiles,
};

// listDownAllFiles({ directoryPath: process.cwd() })
//   .then(({ files }) => {
//     console.log(files);
//   });
