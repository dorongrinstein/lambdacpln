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
    console.log(e);
    throw new Error("Could not copy directory");
  }
}
exports.copyDir = copyDir;

/**
 * @param {{object}} dep1 Primary object, should take precedence
 * @param {{object}} dep2 Secondary object
 */
exports.mergeDependencies = (dep1, dep2) => {
  if (dep1 == undefined) return { ...dep2 };
  if (dep2 == undefined) return { ...dep1 };

  const res = { ...dep2 };

  for (key in dep1) {
    res[key] = dep1[key];
  }

  return res;
};

exports.toCamelCase = (str) => {
  return (
    str
      // Split the string into words using a regular expression that
      // matches spaces, underscores, and dashes as word boundaries.
      .split(/[\s_\-]+/)
      // Map each word to a new word.
      .map((word, index) =>
        // If it's the first word, make it lowercase.
        // Otherwise, capitalize the first letter and make the rest lowercase.
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      // Join all the words into a single string.
      .join("")
  );
};
