const util = require("./util");
const path = require("path");

class Handler {
  constructor(pathName) {
    this.pathName = path.join(".", pathName);
  }

  withoutExtension() {
    return this.pathName.split(".")[0];
  }

  /**
   * Creates a routename based on the parent directory name
   *
   * @param {string[]} lambdaFilePaths Path to the Lambda function file.
   *
   * @returns {string}
   */
  getRouteName() {
    const parentDirName = path.basename(path.dirname(this.pathName));
    const fileName = path.basename(this.withoutExtension());

    if (parentDirName !== ".") return parentDirName;
    else return fileName;
  }

  getImportName() {
    return util.toCamelCase(this.getRouteName() + "Handler");
  }

  // Imports files as if ../ is parent directory
  getImportLine() {
    const importName = this.getImportName();
    return `
let ${importName} = require("./${this.withoutExtension()}")
${importName} = ${importName}.handler ?? ${importName}.default
`;
  }
}

exports.Handler = Handler;
