#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Define the path to package.json in the current directory
const packageJsonPath = path.join(process.cwd(), "package.json");

// Function to check for the express dependency and add it if missing
function ensureExpressDependency() {
  fs.readFileSync(packageJsonPath, { encoding: "utf-8" }, (err, data) => {
    if (err) {
      console.error("Error reading package.json:", err.message);
      return;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(data);
    } catch (parseErr) {
      console.error("Error parsing package.json:", parseErr.message);
      return;
    }

    // Check if express dependency exists
    const hasExpress =
      packageJson.dependencies && packageJson.dependencies.express;

    if (!hasExpress) {
      console.log("Express dependency not found. Adding it...");
      // Add express dependency
      packageJson.dependencies = packageJson.dependencies || {};
      packageJson.dependencies.express = "latest";

      // Write the modified package.json back to the file
      fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        (writeErr) => {
          if (writeErr) {
            console.error("Error writing package.json:", writeErr.message);
            return;
          }
          console.log("Express dependency added successfully.");
        }
      );
    } else {
      console.log("Express dependency already exists.");
    }
  });
}

function generateServerCode(handlerFileName, routeName, typescript = false) {
  let expressAppCode;

  if (typescript) {
    expressAppCode = `
import express, { Express, Request, Response } from 'express';

let handler = require('./${handlerFileName}')
handler = handler.handler ?? handler.default

const app: Express = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.post('/${routeName}', async (req: Request, res: Response) => {
  const event = { ...req.body } as any;
  try {
      const result = await handler(event) as any;
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

app.listen(port, () => {
  console.log(\`Server running on http://localhost:\${port}\`);
});
`;
  } else {
    expressAppCode = `
const express = require('express');

let handler = require('./${handlerFileName}')
handler = handler.handler ?? handler.default

const app = express()
const port = process.env.PORT || 8080;

app.use(express.json());

app.post('/${routeName}', async (req, res) => {
    const event = { ...req.body };
    try {
        const result = await handler(event);
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

app.listen(port, () => {
    console.log(\`Server running on http://localhost:\${port}\`);
});
`;
  }

  return expressAppCode;
}

function generateDockerfile(typescript = false) {
  let dockerfileContent;
  if (typescript)
    dockerfileContent = `
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
  else
    dockerfileContent = `
# Stage 1: Build
FROM node:20 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Run
FROM node:20-slim
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
EXPOSE 8080
CMD [ "node", "server.js" ]
`;

  return dockerfileContent;
}

function generatePackage(typescript = false) {
  let package = ``;
  if (typescript)
    package = `
{
  "name": "server",
  "version": "1.0.0",
  "description": "Express server created by lambdacpln utility",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "build": "tsc"
  },
  "dependencies": {
    "express": "latest"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "typescript": "^5.3.3"
  },
  "author": "",
  "license": "ISC"
}
`;
  else
    package = `
{
  "name": "server",
  "version": "1.0.0",
  "description": "Express server created by lambdacpln utility",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "latest"
  },
  "author": "",
  "license": "ISC"
}
`;

  return package;
}

function generateTsconfig() {
  return `
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  }
}
`;
}

/**
 * Converts a Lambda handler file to an Express app and generates a Dockerfile for Node.js 18.16.
 *
 * @param {string} lambdaFilePath Path to the Lambda function file.
 * @param {string} routeName The route name for the Express app.
 */
function convertLambdaToExpressAndCreateDockerfile(lambdaFilePath, routeName) {
  lambdaFilePath = path.join(".", lambdaFilePath);

  const isTypescript = lambdaFilePath.endsWith(".ts");
  let lambdaFileName;

  if (isTypescript) lambdaFileName = lambdaFilePath.replace(".ts", "");
  else lambdaFileName = lambdaFilePath.replace(".js", "");

  const expressAppCode = generateServerCode(
    lambdaFileName,
    routeName,
    isTypescript
  );
  const dockerfileContent = generateDockerfile(isTypescript);
  const package = generatePackage(isTypescript);

  // Save the Express app code to server.js
  fs.writeFileSync(`server.${isTypescript ? "ts" : "js"}`, expressAppCode);

  // Save the Dockerfile in the current directory
  fs.writeFileSync("Dockerfile", dockerfileContent);

  if (!fs.existsSync("./package.json"))
    fs.writeFileSync("package.json", package);

  if (isTypescript) {
    fs.writeFileSync("tsconfig.json", generateTsconfig());
  }

  console.log(
    `Successfully generated server.${
      isTypescript ? "ts" : "js"
    }, Dockerfile for Node.js 20`
  );
}

// Example usage: node lambdacpln.js index.js uppercase
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log("Usage: npx lambdacpln <path to lambda file> <route name>");
  process.exit(1);
}

const [lambdaFilePath, routeName] = args;

if (fs.existsSync("./server.js") || fs.existsSync("./server.ts")) {
  console.log("a file named server.js already exists, cannot convert. Exiting");
  process.exit(1);
}

if (fs.existsSync("./package.json")) {
  ensureExpressDependency();
}

convertLambdaToExpressAndCreateDockerfile(lambdaFilePath, routeName);
