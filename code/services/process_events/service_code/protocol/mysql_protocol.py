import mysql.connector
from protocol.secrets_manager_protocol import Secrets_Manager
from protocol.logger_protocol import logger
from static.formatting import format_secret_key


class AuroraMysql:
    database_host = ""
    database_name = ""
    database_user = ""
    connection = None
    cursor = None

    def __init__(self, constants, secret_manager_client):
        deployment_environment = constants["DEPLOYMENT_ENVIRONMENT"]
        if not deployment_environment:
            raise Exception(f"Missing deployment environment: {deployment_environment}")

        try:
            # extract DB secrets
            secret_lookup_id = format_secret_key("mysqlSecret", deployment_environment)
            secret_manager_response = Secrets_Manager.get_secret(secret_lookup_id, secret_manager_client)
            self.database_host = secret_manager_response["host"]
            self.database_name = secret_manager_response["dbname"]
            self.database_user = secret_manager_response["username"]
            self.database_port = secret_manager_response["port"]
            password = secret_manager_response["password"]

            self.connection = mysql.connector.connect(
                host=self.database_host,
                database=self.database_name,
                user=self.database_user,
                password=password,
                port=self.database_port,
                connection_timeout=30,
            )

            self.cursor = self.connection.cursor()  # Ensure cursor is created

        except Exception as e:
            self.close_connection()
            logger.info(f"Error on mysql connection: {e}")
            raise Exception(e)

    def close_connection(self):
        if self.cursor:
            self.cursor.close()
        if self.connection and self.connection.is_connected():
            self.connection.close()

    def save_record(self, table_name, record):
        """
        Save a record to the specified table.

        :param table_name: The name of the table to insert the record into.
        :param record: A dictionary representing the record to insert.
        """
        columns = ", ".join(record.keys())
        values_placeholder = ", ".join(["%s"] * len(record))
        sql = f"INSERT INTO {table_name} ({columns}) VALUES ({values_placeholder})"

        if self.cursor and self.connection:
            self.cursor.execute(sql, tuple(record.values()))
            self.connection.commit()
        else:
            raise Exception("Missing cursor or connection")
