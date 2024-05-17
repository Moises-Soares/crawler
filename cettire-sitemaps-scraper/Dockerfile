# cettire-sitemaps-scraper/Dockerfile
FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Environment variables
ENV KAFKA_BROKER=kafka-broker:9092

# Command to run the application
CMD ["node", "app.js"]