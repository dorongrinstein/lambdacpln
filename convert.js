#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const copyDir = require("./util/copyDir").copyDir;
const toCamelCase = require("./util/toCamelCase").toCamelCase;

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
    return toCamelCase(this.getRouteName() + "Handler");
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

// Define the path to package.json in the current directory
const packageJsonPath = path.join(process.cwd(), "package.json");

function generateServerCode(handlers) {
  return `
import express, { Express, Request, Response } from 'express';

${handlers.map((h) => h.getImportLine()).join("")}

const app: Express = express();
const port = process.env.PORT || 8080;

app.use(express.json());

${handlers
  .map(
    (h) => `
app.post('/${h.getRouteName()}', async (req: Request, res: Response) => {
  const event = { ...req.body } as any;
  try {
      const result = await ${h.getImportName()}(event) as any;
      let sc = 200;
      if (result.statusCode) {
          sc = result.statusCode;
          delete result.statusCode;
      }
      res.status(sc).send(result);
  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});
`
  )
  .join("")}

app.listen(port, () => {
  console.log(\`Server running on http://localhost:\${port}\`);
});
`;
}

function generateDockerfile() {
  return `
# Stage 1: Build
FROM node:20 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

# Stage 2: Run
FROM node:20-slim
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./
RUN npm install --only=production
EXPOSE 8080
CMD [ "node", "dist/server.js" ]
`;
}

/**
 *
 * @param {{object}} dep1 Primary object, should take precedence
 * @param {{object}} dep2 Secondary object
 */
function mergeDependencies(dep1, dep2) {
  if (dep1 == undefined) return { ...dep2 };
  if (dep2 == undefined) return { ...dep1 };

  const res = { ...dep2 };

  for (key in dep1) {
    res[key] = dep1[key];
  }

  return res;
}

function generatePackage(existingPackage) {
  const serverDependencies = {
    express: "^4.18.2",
    "aws-lambda": "^1.0.7",
  };
  const serverDevDependencies = {
    "@types/express": "^4.17.21",
    "@types/aws-lambda": "^8.10.102",
    typescript: "^5.3.3",
    "@types/node": "20.11.19",
  };

  const dependencies = mergeDependencies(
    existingPackage.dependencies,
    serverDependencies
  );
  const devDependencies = mergeDependencies(
    existingPackage.devDependencies,
    serverDevDependencies
  );
  return JSON.stringify({
    name: "server",
    version: "1.0.0",
    description: "Express server created by lambdacpln utility",
    main: "server.js",
    scripts: {
      start: "node server.js",
      build: "tsc",
    },
    dependencies,
    devDependencies,
    author: "",
    license: "ISC",
  });
}

function generateTsconfig() {
  return `
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "rootDir": "./",
    "outDir": "dist",
    "skipLibCheck": true
  }
}
`;
}

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

  const expressAppCode = generateServerCode(handlers);
  const dockerfileContent = generateDockerfile();
  const package = generatePackage(existingPackage);

  fs.writeFileSync(path.join(outputDir, `server.ts`), expressAppCode);
  fs.writeFileSync(path.join(outputDir, "Dockerfile"), dockerfileContent);
  fs.writeFileSync(path.join(outputDir, "package.json"), package);
  fs.writeFileSync(path.join(outputDir, "tsconfig.json"), generateTsconfig());

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
  copyDir(process.cwd(), cplnDir, [
    ".git",
    "package.json",
    ".tsconfig",
    ".gitignore",
    ".npmignore",
  ]);
} catch (e) {
  console.log(e.message + "\nExiting...");
  process.exit(1);
}

convertLambdaToExpressAndCreateDockerfile(filePaths, package, cplnDir);
