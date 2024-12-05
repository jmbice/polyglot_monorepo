import { App } from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { ProcessTaskStack } from "./ProcessTasksStack";
dotenv.config({ path: "../../../.env" });

(() => {
  new ProcessTaskStack(
    new App(),
    `${process?.env?.DEPLOYMENT_ENVIRONMENT}-process-tasks-stack`,
    {
      env: {
        account: process?.env?.AWS_ACCOUNT,
        region: process?.env?.AWS_REGION,
      },
      deploymentEnvironment: process?.env?.DEPLOYMENT_ENVIRONMENT,
      libraryToken: process?.env?.LIBRARY_TOKEN_GITHUB,
      awsRegion: process?.env?.AWS_REGION,
    }
  );
})();
