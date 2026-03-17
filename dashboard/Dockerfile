FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY index.html .
EXPOSE 3002
CMD ["serve", "-s", ".", "-l", "3002"]
