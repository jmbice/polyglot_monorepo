import json
from typing import Dict, Any, Union
from protocol.event_protocol import Event_Helpers
from protocol.logger_protocol import logger
from static.types import RunTaskResponse
from static.constants import get_read_only_constants


class Request_Tasks:
    @staticmethod
    def run_task_command(dynamo_record, ecs_client):
        constants = get_read_only_constants()
        process_tasks_cluster_name = constants["PROCESS_TASKS_CLUSTER_NAME"]
        process_tasks_task_definition_arn = constants["PROCESS_TASKS_DEFINITION_ARN"]
        process_tasks_vpc_subnets = constants["PROCESS_TASKS_VPC_SUBNETS"]
        process_tasks_security_group_id = constants["PROCESS_TASKS_SECURITY_GROUP_ID"]
        process_tasks_container_name = constants["PROCESS_TASKS_CONTAINER_NAME"]

        task_processor_response: RunTaskResponse = ecs_client.run_task(
            cluster=process_tasks_cluster_name,
            taskDefinition=process_tasks_task_definition_arn,
            launchType="FARGATE",
            count=1,
            platformVersion="LATEST",
            networkConfiguration={
                "awsvpcConfiguration": {
                    "subnets": process_tasks_vpc_subnets,
                    "securityGroups": [process_tasks_security_group_id],
                    "assignPublicIp": "ENABLED",
                }
            },
            overrides={
                "containerOverrides": [
                    {
                        "name": process_tasks_container_name,  # we should name this based on the type of task it is for clarity
                        "command": ["python3", "process_task.py"],
                        "environment": [
                            {"name": "TASK", "value": dynamo_record["event_type"]},
                            {"name": "SOURCE_EVENT", "value": json.dumps(dynamo_record)},
                        ],  # Because the container has multiple task options, this tells it which to execute
                    }
                ]
            },
        )

        logger.info(f"ECS response: {task_processor_response}")

        return task_processor_response

    @staticmethod
    def request_task(source_event, ecs_client) -> Dict[str, Union[str, Any]]:
        try:
            task_processor_response = Request_Tasks.run_task_command(source_event, ecs_client)

        except Exception as e:
            # return condition: error
            logger.info(f"Error: could not complete call to ECS fargate: {e}")
            return {"outcome": "error", "error": e, "source_event": source_event}

            # return condition: failure
        if task_processor_response.get("failures"):
            return {
                "outcome": "failure",
                "failures": task_processor_response.get("failures"),
                "source_event": source_event,
            }
        else:
            # return condition: success
            return {
                "outcome": "success",
                "source_event": source_event,
            }

    @staticmethod
    def request_tasks(task_source_events, ecs_client):
        failures = []
        for task_source_event in task_source_events:
            receipt = Request_Tasks.request_task(task_source_event, ecs_client)
            if receipt["outcome"] == "error" or receipt["outcome"] == "failures":
                failures.append(receipt)

        return failures
