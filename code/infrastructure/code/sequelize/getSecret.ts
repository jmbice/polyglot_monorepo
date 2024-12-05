import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { RdsSecret } from "../../types.ts";
import { secretsClient } from "./static/initiateSecretsManager.ts";

export const getSecret = async (secretName: string): Promise<RdsSecret> => {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);

  if (response.SecretString) {
    // Because we need to unpack response.SecretString into an object
    return JSON.parse(response.SecretString) as RdsSecret;
  } else if (response.SecretBinary) {
    // Because we may need to unpack response.SecretString into an object
    const secretBinaryString = Buffer.from(
      response.SecretBinary as Uint8Array
    ).toString("utf-8");
    return JSON.parse(secretBinaryString) as RdsSecret;
  }

  // Because we need to handle a scenario where we get an unexpected response shape
  throw Error(
    `No "SecretString" or "SecretBinary" found for secretName: ${secretName} payload response: ${response}`
  );
};
