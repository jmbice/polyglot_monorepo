import json


def parse_source_event(raw_source_event: str):
    if raw_source_event:
        return json.loads(raw_source_event)

    else:
        return ""
