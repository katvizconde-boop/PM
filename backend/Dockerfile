FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY migrations ./migrations
EXPOSE 4000
# Run pending migrations, then start the API.
CMD ["sh", "-c", "npm run migrate:up && node src/index.js"]
