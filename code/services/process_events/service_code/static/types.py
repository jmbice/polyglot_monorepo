from typing import TypedDict, List, Literal, Any
from protocol.mysql_protocol import AuroraMysql
from mypy_boto3_dynamodb.service_resource import Table
from mypy_boto3_dynamodb import ServiceResource


class Container(TypedDict):
    containerArn: str
    lastStatus: Literal["PENDING", "RUNNING", "STOPPED", "DEPROVISIONING", "PROVISIONING"]


class Task(TypedDict):
    taskArn: str
    clusterArn: str
    lastStatus: Literal["PENDING", "RUNNING", "STOPPED", "DEPROVISIONING", "PROVISIONING"]
    desiredStatus: Literal["RUNNING", "STOPPED"]
    containers: List[Container]


class Failure(TypedDict):
    arn: str
    reason: str


class RunTaskResponse(TypedDict):
    tasks: List[Task]
    failures: List[Failure]


class AwsClientsDict(TypedDict):
    dynamo_client: ServiceResource
    event_source_table_client: Table
    ecs_client: Any
    secrets_manager_client: Any
    mysql_client: AuroraMysql
