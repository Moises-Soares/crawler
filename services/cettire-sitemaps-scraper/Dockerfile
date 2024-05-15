# Use the official Node.js image
FROM node:14
ARG CACHEBUST=1

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Specify the command to run the service
CMD ["node", "app.js"]

# If you have environment variables, you can set them here
# ENV NODE_ENV=production
