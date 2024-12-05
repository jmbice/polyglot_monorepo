from static.constants import get_read_only_env_variables
from static.logger import logger
from static.aws_clients import AwsClients


def handler():
    environment_variables = get_read_only_env_variables()

    # identify task
    TASK = environment_variables["TASK"] or ""
    logger.info(f"Called to process task: {TASK}")

    # instantiate clients
    aws_clients = AwsClients.initialize_clients()
    aurora = aws_clients["mysql_client"]
    s3_client = aws_clients["s3_client"]

    # execute single task based on environment variable
    try:
        if TASK == "EXAMPLE":
            print("Do a thing")

        else:
            raise Exception(f"Task not matched in process_task_fargate. Task provided: {TASK}")

    except Exception as e:
        error_message = f"Failed to process task for source_event: {TASK}. EXCEPTION: {e}"
        raise Exception(error_message) from e

    finally:
        clean_up_handler(aurora)


def clean_up_handler(aurora):
    if aurora:
        aurora.close_connection()


if __name__ == "__main__":
    handler()
