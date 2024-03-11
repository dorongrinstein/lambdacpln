const util = require("./util");

exports.generateServerCode = (handlers) => {
  return `
import express, { Express, Request, Response } from 'express';
import { APIGatewayProxyEvent } from "aws-lambda";

${handlers.map((h) => h.getImportLine()).join("")}

const app: Express = express();
const port = process.env.PORT || 8080;

app.use(express.json());

${handlers
  .map(
    (h) => `
app.post('/${h.getRouteName()}', async (req: Request, res: Response) => {
  const event = {
    body: JSON.stringify(req.body),
    pathParameters: req.params,
    queryStringParameters: req.query,
    headers: req.headers,
    path: req.path,
  } as APIGatewayProxyEvent;
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
};

exports.generateDockerfile = () => {
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
};

exports.generateDockerIgnore = () => {
  return `
**/node_modules
`;
};

exports.generatePackage = (existingPackage) => {
  const serverDependencies = {
    express: "^4.18.2",
  };
  const serverDevDependencies = {
    "@types/express": "^4.17.21",
    "@types/aws-lambda": "^8.10.102",
    typescript: "^5.3.3",
    "@types/node": "20.11.19",
  };

  const dependencies = util.mergeDependencies(
    existingPackage.dependencies,
    serverDependencies
  );
  const devDependencies = util.mergeDependencies(
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
};

exports.generateTsconfig = () => {
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
};
