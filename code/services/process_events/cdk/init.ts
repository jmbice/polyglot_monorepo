import { App } from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { ProcessEventsStack } from "./ProcessEventsStack";
dotenv.config({ path: "../../../.env" });

(() => {
  // because we need to initiate the CDK through scripts and apply environment variables
  new ProcessEventsStack(
    new App(),
    `${process?.env?.DEPLOYMENT_ENVIRONMENT}-process-events-stack`,
    {
      env: {
        account: process?.env?.AWS_ACCOUNT,
        region: process?.env?.AWS_REGION,
      },
      deploymentEnvironment: process?.env?.DEPLOYMENT_ENVIRONMENT,
      libraryToken: process?.env?.GITHUB_LIBRARY_TOKEN,
    }
  );
})();
