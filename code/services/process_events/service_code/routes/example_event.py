from typing import Any, List
from protocol.logger_protocol import logger
import datetime
import json


def process_example_events(source_events: List[Any], mysql_client, event_source_table_client):
    failures = []
    for source_event in source_events:
        iso_time_stamp = datetime.datetime.now().isoformat()

        # aurora save logic
        try:
            mysql_client.save_record(
                "example",
                {"message": f"This is a sample message on {iso_time_stamp}: {json.dumps(source_event)}"},
            )

            # dynamo save logic
            item = {"partition": "a", "sort": "b", "payload": f"example {iso_time_stamp}"}
            event_source_table_client.put_item(Item=item)

        except Exception as e:
            logger.info(f"Failed to upload example records {source_event}")
            failures.append(source_event)

    return failures
