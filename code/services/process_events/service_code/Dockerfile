FROM public.ecr.aws/lambda/python:3.12

# Copy function code
COPY . ${LAMBDA_TASK_ROOT}

# Install the specified packages
RUN pip3 install -r requirements.txt -t ${LAMBDA_TASK_ROOT}

CMD ["app.handler"]