FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ src/
COPY prompts/ prompts/

RUN npx tsc
RUN mkdir -p exports

EXPOSE 8080

CMD ["node", "dist/index.js"]
