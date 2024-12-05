const { exec } = require("child_process");

class ExecuteStackDeployments {
  static workspacesDeploymentOrder = [
    "code/infrastructure",
    "code/services/cron_jobs",
    "code/services/live_api",
    "code/services/process_tasks",
    "code/services/process_events",
  ];

  static deploy_all_stacks = async () => {
    for (const workspace of ExecuteStackDeployments.workspacesDeploymentOrder) {
      try {
        console.log(`>>> Starting deployment for:${workspace}`);
        await new Promise((resolve, reject) => {
          exec(
            `npm run cdk:deploy --workspace=${workspace}`,
            (error, stdout, stderr) => {
              if (error) {
                console.error(`Error deploying ${workspace}: ${stderr}`);
                reject(error);
              } else {
                console.log(stdout);
                resolve(void 0);
              }
            }
          );
        });
        console.log(`>>> Ending deployment for:${workspace}`);
      } catch (error) {
        console.error(
          `Failed to deploy ${workspace}. Stopping further deployments.`
        );
        process.exit(1);
      }
    }
    console.log("\nAll workspaces deployed successfully!");
  };

  static destroy_all_stacks = async () => {
    // Reverse the order for destruction
    const workspacesDestroyOrder = [
      ...ExecuteStackDeployments.workspacesDeploymentOrder,
    ].reverse();

    for (const workspace of workspacesDestroyOrder) {
      try {
        console.log(`>>> Starting destruction for: ${workspace}`);
        await new Promise((resolve, reject) => {
          exec(
            `npm run cdk:destroy --workspace=${workspace}`,
            (error, stdout, stderr) => {
              if (error) {
                console.error(`Error destroying ${workspace}: ${stderr}`);
                reject(error);
              } else {
                console.log(stdout);
                resolve(void 0);
              }
            }
          );
        });
        console.log(`>>> Ending destruction for: ${workspace}`);
      } catch (error) {
        console.error(
          `Failed to destroy ${workspace}. Stopping further destructions.`
        );
        process.exit(1);
      }
    }
    console.log("\nAll workspaces destroyed successfully!");
  };

  static accept_command = async (command: string) => {
    if (command === "deploy") {
      return ExecuteStackDeployments.deploy_all_stacks();
    }

    if (command === "destroy") {
      return ExecuteStackDeployments.destroy_all_stacks();
    }

    throw new Error(
      `Command provided invalid. Must be either "deploy" or "destroy". Command provided: ${command}`
    );
  };
}

ExecuteStackDeployments.accept_command(process.argv[2]);
