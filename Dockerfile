FROM alpine:3.21.3

RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node && apk add --no-cache nodejs

WORKDIR /home/node

COPY app.js package.json connection.js devices.js LICENSE /home/node/

RUN apk add --no-cache git npm && npm install && apk del git npm

USER node

CMD [ "node", "." ]
