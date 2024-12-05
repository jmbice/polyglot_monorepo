# BUILD

# 'as builder' is the first stage; Docker will expose GitHub private access token if we don't have two stages
FROM python:3.12 as builder

ARG LIBRARY_TOKEN_GITHUB

WORKDIR /service_code

COPY . .

RUN pip3 install -r requirements.txt -t .

# DEPLOY
# 'as deployment' is the second stage; we must do this in two steps so that tokens aren't exposed
FROM python:3.12-slim as deployment

WORKDIR /service_code

COPY --from=builder /service_code ./

# Because we need to expose a port on the docker container
EXPOSE 8080

# Because we need a command that the system can call to make sure the container is healthy
CMD ["python3", "health_check.py"]
