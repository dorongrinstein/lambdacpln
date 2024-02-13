#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Define the path to package.json in the current directory
const packageJsonPath = path.join(process.cwd(), 'package.json');


// Function to check for the express dependency and add it if missing
function ensureExpressDependency() {
    fs.readFile(packageJsonPath, { encoding: 'utf-8' }, (err, data) => {
        if (err) {
            console.error('Error reading package.json:', err.message);
            return;
        }

        let packageJson;
        try {
            packageJson = JSON.parse(data);
        } catch (parseErr) {
            console.error('Error parsing package.json:', parseErr.message);
            return;
        }

        // Check if express dependency exists
        const hasExpress = packageJson.dependencies && packageJson.dependencies.express;

        if (!hasExpress) {
            console.log('Express dependency not found. Adding it...');
            // Add express dependency
            packageJson.dependencies = packageJson.dependencies || {};
            packageJson.dependencies.express = 'latest';

            // Write the modified package.json back to the file
            fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error('Error writing package.json:', writeErr.message);
                    return;
                }
                console.log('Express dependency added successfully.');
            });
        } else {
            console.log('Express dependency already exists.');
        }
    });
}



/**
 * Converts a Lambda handler file to an Express app and generates a Dockerfile for Node.js 18.16.
 * 
 * @param {string} lambdaFilePath Path to the Lambda function file.
 * @param {string} routeName The route name for the Express app.
 */
function convertLambdaToExpressAndCreateDockerfile(lambdaFilePath, routeName) {
    const lambdaFileName = lambdaFilePath.replace('.js', '');
    const expressAppCode = `
const express = require('express');
const { handler } = require('./${lambdaFileName}');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.post('/${routeName}', async (req, res) => {
    const event = { ...req.body };
    try {
        const result = await handler(event);
        res.send(result);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(\`Server running on http://localhost:\${port}\`);
});
`;

    const dockerfileContent = `
# Stage 1: Build
FROM node:18.16 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Run
FROM node:18.16-slim
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
EXPOSE 8080
CMD [ "node", "server.js" ]
`;

    const package = `
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

`
    // Save the Express app code to server.js
    fs.writeFileSync('server.js', expressAppCode);

    // Save the Dockerfile in the current directory
    fs.writeFileSync('Dockerfile', dockerfileContent);

    if (!fs.existsSync("./package.json"))
        fs.writeFileSync('package.json', package);


    console.log('Successfully generated server.js and Dockerfile for Node.js 18.16.');
}

// Example usage: node convertLambdaToExpressAndCreateDockerfile.js index.js uppercase
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.log('Usage: npx lambdacpln <path to lambda file> <route name>');
    process.exit(1);
}

const [lambdaFilePath, routeName] = args;
ensureExpressDependency();
convertLambdaToExpressAndCreateDockerfile(lambdaFilePath, routeName);
