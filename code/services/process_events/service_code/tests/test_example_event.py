import unittest
import json
from static.types import RunTaskResponse
from unittest.mock import patch, MagicMock, call
from app import handler
from static.constants import get_read_only_constants

# from app import handler
from typing import Any, List, Dict


class TestProcessEventPermissions(unittest.TestCase):

    @patch.dict(
        "os.environ",
        {
            "AWS_REGION": "us-west-2-test",
            "DEPLOYMENT_ENVIRONMENT": "local-test",
            "EVENT_SOURCE_TABLE_NAME": "source-table-test",
            "PROCESS_TASKS_VPC_SECURITY_GROUP_ID": "sg-123456-test",
            "PROCESS_TASKS_CLUSTER_NAME": "cluster_test",
            "PROCESS_TASKS_SECURITY_GROUP_ID": "sg-123456-test",
            "PROCESS_TASKS_TASK_DEFINITION_ARN": "arn:aws:ecs:us-west-2:123456789012:task/test",
            "PROCESS_TASKS_CONTAINER_NAME": "container-test",
            "PROCESS_TASKS_VPC_SUBNETS": '["subnet-12345-test", "subnet-67890-test"]',
        },
    )
    @patch("boto3.resource")  # used to mock dynamo db source table client
    @patch("boto3.client")  # used to mock the ECS client
    @patch("mysql.connector.connect")  # used to patch mysql connector
    def test_event_type_task_a(self, mock_mysql_connector, mock_boto_client, mock_boto_resource):
        # Create a mock for the DynamoDB resource
        mock_dynamo_resource = MagicMock(name="dynamo_resource")
        mock_boto_resource.return_value = mock_dynamo_resource

        # Create a mock for the Table method
        mock_table = MagicMock(name="event_source_table_client")
        mock_dynamo_resource.Table.return_value = mock_table

        # Create a mock for the ECS client
        mock_ecs_client = MagicMock(name="ecs_client")
        mock_boto_client.return_value = mock_ecs_client

        # Create a mock for run_task method
        mock_run_task = MagicMock(name="run_task")
        mock_ecs_client.run_task.return_value = mock_run_task

        # Mock the Secrets Manager client
        mock_secrets_manager_client = MagicMock(name="secrets_manager_client")
        mock_secrets_manager_client.get_secret_value.return_value = {
            "SecretString": json.dumps(
                {
                    "host": "localhost",
                    "dbname": "test_db",
                    "username": "test_user",
                    "port": 3306,
                    "password": "test_password",
                }
            )
        }
        mock_boto_client.side_effect = [
            mock_ecs_client,
            mock_secrets_manager_client,
        ]

        # Create a mock cursor
        mock_cursor = MagicMock()
        mock_mysql_connector.return_value.cursor.return_value = mock_cursor

        # Prepare mock handler event
        stream_event = {
            "Records": [
                {
                    "eventID": "1",
                    "eventName": "INSERT",
                    "eventVersion": "1.0",
                    "eventSource": "aws:dynamodb",
                    "awsRegion": "us-west-2",
                    "dynamodb": {
                        "Keys": {"partition": {"S": "abc"}, "sort": {"S": "123"}},
                        "NewImage": {"message": {"S": "New item!"}, "event_type": {"S": "TRANSFORM_SNAKE_DATA"}},
                        "StreamViewType": "NEW_IMAGE",
                        "SequenceNumber": "111",
                        "SizeBytes": 26,
                    },
                    "eventSourceARN": "arn:aws:dynamodb:us-west-2:account-id:table/my-table/stream",
                }
            ]
        }

        # Execute lambda
        handler(stream_event, {})

        # assert clients were called in the correct order, with expected environment variables
        mock_boto_resource.assert_called_once_with("dynamodb", region_name="us-west-2-test")
        mock_dynamo_resource.Table.assert_called_once_with("source-table-test")
        mock_boto_client.assert_has_calls(
            [
                call("ecs", region_name="us-west-2-test"),  # first call
                call("secretsmanager", region_name="us-west-2-test"),  # second call
            ]
        )
        mock_mysql_connector.assert_called_once_with(
            host="localhost",
            database="test_db",
            user="test_user",
            password="test_password",
            port=3306,
            connection_timeout=30,
        )

        # assert the ECS run task was called with the incoming event
        constants = get_read_only_constants()
        process_tasks_cluster_name = constants["PROCESS_TASKS_CLUSTER_NAME"]
        process_tasks_task_definition_arn = constants["PROCESS_TASKS_DEFINITION_ARN"]
        process_task_subnets = constants["PROCESS_TASKS_VPC_SUBNETS"]
        process_tasks_security_group_id = constants["PROCESS_TASKS_VPC_SECURITY_GROUP_ID"]
        process_tasks_container_name = constants["PROCESS_TASKS_CONTAINER_NAME"]

        mock_ecs_client.run_task.assert_called_once_with(
            taskDefinition=process_tasks_task_definition_arn,
            cluster=process_tasks_cluster_name,
            launchType="FARGATE",
            count=1,
            platformVersion="LATEST",
            networkConfiguration={
                "awsvpcConfiguration": {
                    "subnets": process_task_subnets,
                    "securityGroups": [process_tasks_security_group_id],
                    "assignPublicIp": "ENABLED",
                }
            },
            overrides={
                "containerOverrides": [
                    {
                        "name": process_tasks_container_name,
                        "command": ["python3", "process_task.py"],
                        "environment": [
                            {"name": "TASK", "value": "TRANSFORM_SNAKE_DATA"},
                            {
                                "name": "SOURCE_EVENT",
                                "value": '{"message": "New item!", "event_type": "TRANSFORM_SNAKE_DATA"}',
                            },
                        ],
                    }
                ]
            },
        )


if __name__ == "__main__":
    unittest.main()
