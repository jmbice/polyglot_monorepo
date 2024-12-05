import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

export const secretsClient = new SecretsManagerClient({
  region: process?.env?.AWS_REGION || "us-west-2",
});
