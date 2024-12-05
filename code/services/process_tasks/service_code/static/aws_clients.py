import boto3
from static.mysql_connection import AuroraMysql
from static.types import AwsClientsDict
from static.constants import get_read_only_env_variables
from typing import Optional

# Prevent re-connections by setting this.
aws_clients: Optional[AwsClientsDict] = None


class AwsClients:
    @staticmethod
    # We set global inside handler because of the limitations in (my understanding of) python testing.
    # Without this, I believe, we cannot set/mock globals environment variables before test execution
    def initialize_clients():
        # use preset global value from previous invocation
        global aws_clients
        if aws_clients:
            return aws_clients

        # otherwise, initialize necessary clients
        environment_variables = get_read_only_env_variables()
        dynamo_client = AwsClients.dynamo_client(environment_variables)
        event_source_table_client = AwsClients.event_source_table_client(environment_variables, dynamo_client)
        secrets_manager_client = AwsClients.secret_manager_client(environment_variables)
        mysql_client = AwsClients.mysql_client(environment_variables, secrets_manager_client)
        s3_client = AwsClients.s3_client(environment_variables)

        # set the global value for use next time
        aws_clients = {
            "dynamo_client": dynamo_client,
            "event_source_table_client": event_source_table_client,
            "secrets_manager_client": secrets_manager_client,
            "mysql_client": mysql_client,
            "s3_client": s3_client,
        }

        return aws_clients

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
    def s3_client(constants):
        aws_region = constants["AWS_REGION"]
        return boto3.client("s3", region_name=aws_region)

    @staticmethod
    def mysql_client(constants, secrets_manager_client):
        return AuroraMysql(constants, secrets_manager_client)
