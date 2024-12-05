import { setMysqlTables } from "./sequelize/setTables.ts";
import { execSync } from "child_process";

(async () => {
  // Because we want the infrastructure repo to deploy database and table changes associated with production
  try {
    // Because executing this as a script in this manner allows us to wait for the CDK to deploy before we write our tables
    execSync(
      "cdk deploy '*' --require-approval 'never' --outputs-file ./cdk-outputs.json",
      { stdio: "inherit" }
    );

    // Because we want to set columns/values for the tables that don't already exist
    await setMysqlTables();
  } catch (error) {
    console.error(
      "Error during CDK deployment or aurora table creation/migration",
      error
    );
    process.exit(1);
  }
})();
