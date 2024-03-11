#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const util = require("./util");
const code = require("./code");
const Handler = require("./handler").Handler;

// Constants
const IGNORE_FILES = [
  ".git",
  "package.json",
  ".tsconfig",
  ".gitignore",
  ".npmignore",
];

/**
 * Converts a Lambda handler file to an Express app and generates a Dockerfile for Node.js 20.
 *
 * @param {string[]} lambdaFilePaths Path to the Lambda function file.
 * @param {object} existingPackage Javascript object of the existing package.json file
 * @param {string} outputDir Directory to output cpln container
 */
function convertLambdaToExpressAndCreateDockerfile(
  lambdaFilePaths,
  existingPackage,
  outputDir
) {
  const handlers = [];
  for (const filePath of lambdaFilePaths) {
    handlers.push(new Handler(filePath));
  }

  const expressAppCode = code.generateServerCode(handlers);
  const dockerfileContent = code.generateDockerfile();
  const dockerIgnoreContent = code.generateDockerIgnore();
  const package = code.generatePackage(existingPackage);

  fs.writeFileSync(path.join(outputDir, `server.ts`), expressAppCode);
  fs.writeFileSync(path.join(outputDir, "Dockerfile"), dockerfileContent);
  fs.writeFileSync(path.join(outputDir, ".dockerignore"), dockerIgnoreContent);
  fs.writeFileSync(path.join(outputDir, "package.json"), package);
  fs.writeFileSync(
    path.join(outputDir, "tsconfig.json"),
    code.generateTsconfig()
  );

  console.log(`Successfully generated cpln container for Node.js 20`);
}

// Example usage: node lambdacpln.js index.js uppercase
const filePaths = process.argv.slice(2);
if (filePaths.length == 0) {
  console.log("Usage: npx lambdacpln <...paths to lambda file>");
  process.exit(1);
}

// Check if every file exists
for (let filePathIdx in filePaths) {
  const filePath = filePaths[filePathIdx];
  if (!fs.existsSync(filePath)) {
    console.log(`File: ${filePath} does not exist. Exiting`);
    process.exit(1);
  }
}

// Check for package.json
let package = {};
try {
  const packageString = fs.readFileSync(
    path.join(process.cwd(), "package.json"),
    { encoding: "utf-8" }
  );
  const packageObject = JSON.parse(packageString);
  package = packageObject;
} catch (e) {
  package = {};
}

// Copy files over
const cplnDir = path.join(process.cwd(), "cpln");
try {
  util.copyDir(process.cwd(), cplnDir, IGNORE_FILES);
} catch (e) {
  console.log(e.message + "\nExiting...");
  process.exit(1);
}

convertLambdaToExpressAndCreateDockerfile(filePaths, package, cplnDir);
