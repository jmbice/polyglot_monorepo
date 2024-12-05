import json
import base64


class Secrets_Manager:
    @staticmethod
    def get_secret(secret_name: str, secret_manager_client):
        try:
            response = secret_manager_client.get_secret_value(SecretId=secret_name)

            if "SecretString" in response:
                # Unpack response.SecretString into an object
                return json.loads(response["SecretString"])
            elif "SecretBinary" in response:
                # Unpack response.SecretBinary into an object
                secret_binary = base64.b64decode(response["SecretBinary"])
                return json.loads(secret_binary.decode("utf-8"))

            # Handle unexpected response shape
            raise ValueError(f'No "SecretString" or "SecretBinary" found for secretName: {secret_name}')

        except secret_manager_client.exceptions.ResourceNotFoundException:
            raise ValueError(f"Secret {secret_name} not found")

        except Exception as e:
            raise ValueError(f"Error retrieving secret {secret_name}: {str(e)}")
