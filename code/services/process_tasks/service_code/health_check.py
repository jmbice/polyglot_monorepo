from static.logger import logger


def health_check_handler():
    try:
        logger.info("Heart is beating!")
        return 200

    except Exception as e:
        logger.error("An error occurred: %s", e)
        raise  # Re-raise the exception after logging


if __name__ == "__main__":
    health_check_handler()
