FROM node:14.9.0-alpine
WORKDIR /usr/app
RUN apk --no-cache add --virtual native-deps libbz2 \
    g++ gcc libgcc libstdc++ linux-headers make python3 && \
    npm install --quiet node-gyp -g
COPY package.json .
COPY . .
RUN npm ci && \
    apk del native-deps