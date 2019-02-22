FROM node:latest

WORKDIR /app

COPY . /app/

RUN npm install
RUN npm install -g pm2

ENV NODE_ENV production

EXPOSE 9000

CMD ["pm2-runtime", "server.js"]