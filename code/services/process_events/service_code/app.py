from protocol.dynamo_protocol import Dynamo_Stream
from protocol.event_protocol import Event_Helpers
from protocol.request_task_protocol import Request_Tasks
from routes.example_event import process_example_events
from protocol.aws_protocol import AwsClients
from protocol.logger_protocol import logger


def handler(event, context):
    # log incoming data
    logger.info(f"triggering event: {event}")
    logger.info(f"context: {context}")

    # authenticate aws sdks
    aws_clients = AwsClients.initialize_clients()

    # extract aws clients
    ecs_client = aws_clients["ecs_client"]
    event_source_table_client = aws_clients["event_source_table_client"]
    mysql_client = aws_clients["mysql_client"]

    failures = []
    # "unpack" the dynamo db records from the input event
    records = Dynamo_Stream.unpackDynamoValueFromStream(event)
    inserts = records["inserts"]  # we only process records on inserts
    updates = records["updates"]  # don't process updates
    deletes = records["deletes"]  # don't process deletes

    # organize the events
    source_events_by_type = Event_Helpers.categorize_events_by_event_type(inserts)

    # Something processed in this lambda
    process_events = source_events_by_type.get("EVENT_EXAMPLE", [])
    failed_to_process_events = process_example_events(process_events, mysql_client, event_source_table_client)

    # Something processed in a fargate
    example_events = source_events_by_type.get("TASK_EXAMPLE", [])
    failed_to_process_task_request = Request_Tasks.request_tasks(
        example_events,
        ecs_client,
    )
    failures.extend(failed_to_process_task_request)

    # close connection
    mysql_client.close_connection()
