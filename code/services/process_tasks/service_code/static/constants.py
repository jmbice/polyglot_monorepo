import os
from helpers.parse_source_event import parse_source_event


def get_read_only_env_variables():
    SOURCE_EVENT_RAW = os.getenv("SOURCE_EVENT") or ""
    SOURCE_EVENT = parse_source_event(SOURCE_EVENT_RAW)
    DEPLOYMENT_ENVIRONMENT = os.getenv("DEPLOYMENT_ENVIRONMENT") or ""
    AWS_REGION = os.getenv("AWS_REGION") or ""
    TASK = os.getenv("TASK") or ""
    EVENT_SOURCE_TABLE_NAME = os.getenv("EVENT_SOURCE_TABLE_NAME") or ""
    BUCKET_NAME = os.getenv("BUCKET_NAME") or ""
    IS_LOCAL = os.getenv("IS_LOCAL") or ""
    IS_LOCAL = bool(IS_LOCAL)

    return {
        "TASK": TASK,
        "DEPLOYMENT_ENVIRONMENT": DEPLOYMENT_ENVIRONMENT,
        "EVENT_SOURCE_TABLE_NAME": EVENT_SOURCE_TABLE_NAME,
        "AWS_REGION": AWS_REGION,
        "BUCKET_NAME": BUCKET_NAME,
        "SOURCE_EVENT": SOURCE_EVENT,
        "IS_LOCAL": IS_LOCAL,
    }
