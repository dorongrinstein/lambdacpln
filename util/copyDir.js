const fs = require("fs");
const path = require("path");

function copyDir(src, dest, excludeFiles = []) {
  // Make directory
  if (fs.existsSync(dest)) {
    throw new Error(`Directory: ${dest} already exists`);
  } else {
    fs.mkdirSync(dest);
  }

  try {
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
      // Continue is current is the destination dir
      if (
        entry.name == path.basename(dest) ||
        excludeFiles.includes(entry.name)
      )
        continue;

      let srcPath = path.join(src, entry.name);
      let destPath = path.join(dest, entry.name);

      // Check if the current entry is a directory
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath, excludeFiles); // Recurse into subdirectories
      } else {
        fs.copyFileSync(srcPath, destPath); // Copy file
      }
    }
  } catch (e) {
    throw new Error("Could not copy directory");
  }
}

exports.copyDir = copyDir;
