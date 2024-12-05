from typing import Dict, List, Any
from protocol.logger_protocol import logger


class Event_Helpers:
    @staticmethod
    def categorize_events_by_event_type(source_events) -> Dict[str, List[Any]]:
        source_events_by_type = {}
        for source_event in source_events:
            # if its not in the dict, instantiate a list with the new event
            append_log_for_source_event_type = source_events_by_type.get(source_event["event_type"], [])
            # apply the next source event
            append_log_for_source_event_type.append(source_event)
            # save the array of source events of this type
            source_events_by_type[source_event["event_type"]] = append_log_for_source_event_type

        return source_events_by_type
