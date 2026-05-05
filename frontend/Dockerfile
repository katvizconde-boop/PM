FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# nginx:alpine processes /etc/nginx/templates/*.template at startup,
# substituting env vars (see /docker-entrypoint.d/20-envsubst-on-templates.sh).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_HOST=backend API_PORT=4000
EXPOSE 80
