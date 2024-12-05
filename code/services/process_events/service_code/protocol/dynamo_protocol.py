from boto3.dynamodb.types import TypeDeserializer
from decimal import Decimal


class Dynamo_Stream:
    @staticmethod
    def unpackDynamoValueFromStream(streamEvent):
        inserts = []
        updates = []
        deletes = []

        # Because each stream event can have multiple records
        for record in streamEvent["Records"]:
            # Because for now, we are only checking INSERT, DELETE operations
            if record["eventName"] == "INSERT":
                # Because AWS gives us awkward dynamodb formatted records
                new_dynamo_db_record = record["dynamodb"].get("NewImage")
                un_marshalled_insert_record = Dynamo_Stream.un_marshall_dynamodb_item(new_dynamo_db_record)
                inserts.append(un_marshalled_insert_record)
                continue
            if record["eventName" == "REMOVE"]:
                new_dynamo_db_record = record["dynamodb"].get("NewImage")
                # Because AWS gives us awkward dynamodb formatted records
                un_marshalled_delete_record = Dynamo_Stream.un_marshall_dynamodb_item(new_dynamo_db_record)
                deletes.append(un_marshalled_delete_record)
                continue
            if record["eventName" == "MODIFY"]:
                new_dynamo_db_record = record["dynamodb"].get("NewImage")
                # Because AWS gives us awkward dynamodb formatted records
                un_marshalled_update_record = Dynamo_Stream.un_marshall_dynamodb_item(new_dynamo_db_record)
                updates.append(un_marshalled_update_record)
                continue

        return {"inserts": inserts, "deletes": deletes, "updates": updates}

    @staticmethod
    def un_marshall_dynamodb_item(dynamodb_item):
        """
        Unmarshals a DynamoDB item into a normal Python dictionary.

        Args:
            dynamodb_item (dict): The DynamoDB item (a dict with DynamoDB types).

        Returns:
            dict: A Python dictionary with native types.
        """
        deserializer = TypeDeserializer()
        return {
            key: (
                str(deserializer.deserialize(value))
                if isinstance(deserializer.deserialize(value), Decimal)
                else deserializer.deserialize(value)
            )
            for key, value in dynamodb_item.items()
        }
