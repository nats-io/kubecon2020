FROM alpine:3.12
COPY . /go/src/app
WORKDIR /go/src/app
RUN apk add --no-cache --virtual .go-deps make bash gcc musl-dev openssl go ca-certificates libc6-compat tzdata
RUN apk add --no-cache --virtual .js-deps nodejs npm

CMD ["make", "start"]
