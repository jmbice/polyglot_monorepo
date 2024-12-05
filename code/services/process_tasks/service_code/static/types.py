from typing import TypedDict, Any
from static.mysql_connection import AuroraMysql
from mypy_boto3_dynamodb.service_resource import Table
from mypy_boto3_dynamodb import ServiceResource
from static.mysql_connection import AuroraMysql


class AwsClientsDict(TypedDict):
    dynamo_client: ServiceResource
    event_source_table_client: Table
    secrets_manager_client: Any
    mysql_client: AuroraMysql
    s3_client: Any
