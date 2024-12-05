## Executing Process_Tasks locally with virtual environment:

To execute a task locally, simply navigate to the root directory of the process tasks service and run the following scripts:

- `npm run python:install`: this will download requirements to a local venv
- `npm run python:local`: this will enable the venv and run commands locally
- `npm run python:clean`: this will remove venv and generated files

Pro tip: Run clear before making commits

## Executing Process_Tasks locally with docker container:

In certain cases, we needed docker to run old code locally on mac. That was a bonus for docker.

### Build image with amd64

Note, we explicitly build int amd64 because legacy code requires it:

```
docker build --platform linux/amd64 -t process-tasks-image .
```

### Shell into local container that executes in Fargate:

Enter and look at the local file structure and how it works with the build.

```
docker run -it --entrypoint /bin/bash process-tasks-image
```

### Execute image locally:

Don't forget to replace it with your own environment variables. This command runs the transform_snakes_data. This requires the snakes_pdf to be set-up

```
  docker run --rm \
  -e TASK="TACK_ACTION" \
  -e EVENT_SOURCE_TABLE_NAME="jordan-sandbox-infrastructure-stack-eventlogjordansandboxjordansandboxeventlogD2083823-4092OS2DEVDV" \
  -e DEPLOYMENT_ENVIRONMENT="jordan-sandbox" \
  -e BUCKET_NAME="private-s3-bucket-jordan-sandbox" \
  -e AWS_REGION="us-west-1" \
  -e SOURCE_EVENT='{"transform_date":"20241108"}' \
  -e AWS_ACCESS_KEY_ID="xxxxxxxx" \
  -e AWS_SECRET_ACCESS_KEY="xxxxxxxxxx" \
  process-tasks-image python3 process_task.py
```
