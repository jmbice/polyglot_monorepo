import boto3
from protocol.mysql_protocol import AuroraMysql
from static.types import AwsClientsDict
from static.constants import get_read_only_constants
from typing import Optional

aws_clients: Optional[AwsClientsDict] = None


class AwsClients:
    @staticmethod
    # We want to maintain a connection across multiple invocations so we save them to a global variable if they are not present
    # We set global inside handler because of the limitations of python testing: cannot set globals before tests execute
    def initialize_clients():
        # use preset global value from previous invocation
        global aws_clients
        if aws_clients:
            return aws_clients

        # otherwise, initialize necessary clients
        constants = get_read_only_constants()
        dynamo_client = AwsClients.dynamo_client(constants)
        event_source_table_client = AwsClients.event_source_table_client(constants, dynamo_client)
        ecs_client = AwsClients.ecs_client(constants)
        secrets_manager_client = AwsClients.secret_manager_client(constants)
        mysql_client = AwsClients.mysql_client(constants, secrets_manager_client)

        # set the global value for use next time
        aws_clients = {
            "dynamo_client": dynamo_client,
            "event_source_table_client": event_source_table_client,
            "ecs_client": ecs_client,
            "secrets_manager_client": secrets_manager_client,
            "mysql_client": mysql_client,
        }

        return aws_clients

    #
    @staticmethod
    def dynamo_client(constants):
        aws_region = constants["AWS_REGION"]
        return boto3.resource("dynamodb", region_name=aws_region)

    @staticmethod
    def event_source_table_client(constants, dynamo_client):
        event_source_table_client_name = constants["EVENT_SOURCE_TABLE_NAME"]
        return dynamo_client.Table(event_source_table_client_name)

    @staticmethod
    def ecs_client(constants):
        aws_region = constants["AWS_REGION"]
        return boto3.client("ecs", region_name=aws_region)

    @staticmethod
    def secret_manager_client(constants):
        aws_region = constants["AWS_REGION"]
        return boto3.client("secretsmanager", region_name=aws_region)

    @staticmethod
    def mysql_client(constants, secrets_manager_client):
        return AuroraMysql(constants, secrets_manager_client)
