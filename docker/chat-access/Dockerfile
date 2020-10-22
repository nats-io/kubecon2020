FROM golang:alpine AS builder
COPY chat-access /go/src/app
WORKDIR /go/src/app

ENV GO111MODULE=on
RUN apk add -U --no-cache git binutils
RUN go install

FROM alpine:3.12

RUN apk add -U --no-cache ca-certificates
COPY --from=builder /go/bin/chat-access /usr/local/bin

CMD ["/usr/local/bin/chat-access"]
