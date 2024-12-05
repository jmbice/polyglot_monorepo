import { App } from "aws-cdk-lib";
import { Infrastructure } from "./InfrastrcutureStack.ts";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

(async () => {
  // because we need to initiate the CDK through scripts and apply environment variables
  new Infrastructure(
    new App(),
    `${process?.env?.DEPLOYMENT_ENVIRONMENT}-infrastructure-stack`,
    {
      env: {
        account: process?.env?.AWS_ACCOUNT,
        region: process?.env?.AWS_REGION,
      },
      eventLogProps: {
        deploymentEnvironment: process?.env?.DEPLOYMENT_ENVIRONMENT,
        allowListIps: (process?.env?.ALLOW_LIST_IPS || "")
          .split(",")
          .filter((x) => x),
      },
    }
  );
})();
