import * as fs from "fs";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Table } from "aws-cdk-lib/aws-dynamodb";

import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { DockerImageCode } from "aws-cdk-lib/aws-lambda";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";

export class ProcessEventsStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps & {
      deploymentEnvironment: string;
      libraryToken: string;
    }
  ) {
    super(scope, id, props);
    const { libraryToken, deploymentEnvironment } = props;

    const {
      vpcId,
      eventLogTableArn,
      eventLogTableStreamArn,
      eventLogTableName,
      auroraSecurityGroupId,
    } = this.lookUpInfrastructureStackValues(deploymentEnvironment) || {};

    const {
      processTasksVpcSubnets,
      processTasksVPCSecurityGroupId,
      processTasksDefinitionArn,
      processTasksEcsClusterName,
      processTasksEcsContainerName,
      processTasksSecurityGroupId,
    } = this.lookUpTaskProcessorStackValues(deploymentEnvironment);

    const vpc = this.lookupVPC({ vpcId });

    const eventLogStreamTable = this.lookupStreamTable({
      eventLogTableStreamArn,
      eventLogTableArn: eventLogTableArn,
    });

    const processEventsLambda = this.createLambda({
      vpc,
      processTasksSecurityGroupId,
      processTasksVpcSubnets,
      processTasksVPCSecurityGroupId,
      processTasksDefinitionArn,
      processTasksEcsClusterName,
      processTasksEcsContainerName,
      eventLogTableStreamArn,
      libraryToken,
      eventLogTableName,
      deploymentEnvironment,
    });

    processEventsLambda.addEventSource(
      new cdk.aws_lambda_event_sources.DynamoEventSource(eventLogStreamTable, {
        startingPosition: cdk.aws_lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 5, // The number of records to send to the function in a single batch
        retryAttempts: 1, // How many times we retry
        // maxRecordAge: cdk.Duration.minutes(10), // Optional: Set max record age
      })
    );

    this.allowIngressToAurora(
      auroraSecurityGroupId,
      processEventsLambda.connections.securityGroups[0]
    );
  }

  createLambda({
    vpc,
    processTasksSecurityGroupId,
    processTasksVpcSubnets,
    processTasksVPCSecurityGroupId,
    processTasksDefinitionArn,
    processTasksEcsClusterName,
    processTasksEcsContainerName,
    eventLogTableStreamArn,
    libraryToken,
    eventLogTableName,
    deploymentEnvironment,
  }) {
    const processEventsLambda = new cdk.aws_lambda.DockerImageFunction(
      this,
      `${deploymentEnvironment}-process-events`,
      {
        vpc,
        code: this.getDockerCode(libraryToken),
        role: new Role(this, `${deploymentEnvironment}-process-events-role`, {
          assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
          inlinePolicies: {
            SecretManagerPolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: ["secretsmanager:GetSecretValue"],
                  resources: ["*"],
                  // resources: [secret.secretArn],
                }),
              ],
            }),
            // because we want the lambda to have permission to create cloudwatch logs
            CloudWatchPolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                  ],
                  resources: ["*"],
                }),
              ],
            }),
            // because we need the lambda to have permission to write to event source
            DynamoPolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: [
                    "dynamodb:BatchWriteItem",
                    "dynamodb:PutItem",
                    "dynamodb:TransactWriteItems",
                  ],
                  resources: ["*"],
                  // resources: [eventLogTableArn, `${eventLogTableArn}/index/*`],
                }),
              ],
            }),
            // because we need the lambda to have permission to write to mysql
            AuroraPolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: [
                    "rds:Connect", // Specifically allows connection
                    "rds:DescribeDBInstances", // Allow describing RDS instances
                    "rds:DescribeDBClusters", // Allow describing RDS clusters
                  ],
                  resources: ["*"],
                  // resources: [...rdsAuroraInstanceArns, rdsDbClusterArn],
                }),
              ],
            }),
            // because we need the lambda to have permission to trigger ECS
            EcsPolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  actions: [
                    "ecs:StartTask",
                    "ecs:StopTask",
                    "ecs:RunTask",
                    "ecs:UpdateService",
                    "ecs:DescribeServices",
                  ],
                  resources: ["*"],
                }),
              ],
            }),
            Ec2NetworkPolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: [
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:CreateNetworkInterface",
                    "ec2:DeleteNetworkInterface",
                    "ec2:DescribeSecurityGroups", // Optional, only if needed
                  ],
                  resources: ["*"], // Can restrict further
                }),
              ],
            }),
            // Because lambda needs this to call ecs via sdk
            PassRolePolicy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: ["iam:PassRole"],
                  resources: ["*"],
                }),
              ],
            }),
          },
        }),
        logGroup: new LogGroup(
          this,
          `${deploymentEnvironment}-process-events-log-group`,
          {
            logGroupName: `/lambda/${deploymentEnvironment}/process-events`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_DAY,
          }
        ),

        memorySize: 512,
        reservedConcurrentExecutions: 10,
        environment: {
          PROCESS_TASKS_VPC_SUBNETS: processTasksVpcSubnets,
          PROCESS_TASKS_SECURITY_GROUP_ID: processTasksSecurityGroupId,
          PROCESS_TASKS_VPC_SECURITY_GROUP_ID: processTasksVPCSecurityGroupId,
          PROCESS_TASKS_TASK_DEFINITION_ARN: processTasksDefinitionArn,
          PROCESS_TASKS_CLUSTER_NAME: processTasksEcsClusterName,
          PROCESS_TASKS_CONTAINER_NAME: processTasksEcsContainerName,
          EVENT_LOG_TABLE_STREAM_ARN: eventLogTableStreamArn,
          EVENT_SOURCE_TABLE_NAME: eventLogTableName,
          DEPLOYMENT_ENVIRONMENT: deploymentEnvironment,
        },
      }
    );

    return processEventsLambda;
  }

  lookupVPC({ vpcId }) {
    return cdk.aws_ec2.Vpc.fromLookup(this, "VPC", {
      vpcId,
    });
  }

  allowIngressToAurora(auroraSecurityGroupId, lambdaSecurityGroup) {
    const auroraSecurityGroup = SecurityGroup.fromSecurityGroupId(
      this,
      "import-sg",
      auroraSecurityGroupId
    );

    auroraSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      cdk.aws_ec2.Port.tcp(3306), // Example: allow HTTPS traffic
      "Allow (AM-SG) access from process-events lambda"
    );
  }

  lookupDynamoTable({ fromTableArn }: { fromTableArn: string }) {
    const table = Table.fromTableArn(this, "RETRIEVE TABLE", fromTableArn);

    return table;
  }

  lookupStreamTable({
    eventLogTableStreamArn,
    eventLogTableArn,
  }: {
    eventLogTableStreamArn: string;
    eventLogTableArn: string;
  }) {
    const table = Table.fromTableAttributes(this, "RETRIEVE STREAM TABLE", {
      tableStreamArn: eventLogTableStreamArn,
      tableArn: eventLogTableArn,
    });

    return table;
  }

  lookUpInfrastructureStackValues(deploymentEnvironment) {
    const infrastructureOutputsPath = "../../infrastructure/cdk-outputs.json";
    const jsonString = fs.existsSync(infrastructureOutputsPath)
      ? fs.readFileSync(infrastructureOutputsPath, "utf-8")
      : "{}";
    const infrastructureOutputsRaw = JSON.parse(jsonString);
    const infrastructureOutputs =
      infrastructureOutputsRaw[
        `${deploymentEnvironment}-infrastructure-stack`
      ] || {};

    const {
      vpcId = "",
      eventLogArn = "",
      rdsDbClusterArn = "",
      eventLogTableStreamArn = "",
      eventLogTableName = "",
      auroraSecurityGroupId = "",
    } = infrastructureOutputs;

    if (
      !vpcId ||
      !eventLogArn ||
      !rdsDbClusterArn ||
      !eventLogTableStreamArn ||
      !eventLogTableName ||
      !auroraSecurityGroupId
    ) {
      console.warn(
        `Something is missing:
            - vpcId: ${vpcId}
            - eventLogArn: ${eventLogArn}
            - rdsDbClusterArn: ${rdsDbClusterArn}
            - eventLogTableStreamArn: ${eventLogTableStreamArn}
            - eventLogTableName: ${eventLogTableName}
            - auroraSecurityGroupId: ${auroraSecurityGroupId}
          `
      );
    }

    return {
      vpcId,
      rdsDbClusterArn,
      eventLogTableArn: eventLogArn,
      eventLogTableStreamArn,
      eventLogTableName,
      auroraSecurityGroupId,
    };
  }

  lookUpTaskProcessorStackValues(deploymentEnvironment) {
    const processTaskStackOutputsPath = "../process_tasks/cdk-outputs.json";
    const jsonString = fs.existsSync(processTaskStackOutputsPath)
      ? fs.readFileSync(processTaskStackOutputsPath, "utf-8")
      : "{}";
    const processTaskStackOutputsRaw = JSON.parse(jsonString);
    const processTasksStackOutputs =
      processTaskStackOutputsRaw[
        `${deploymentEnvironment}-process-tasks-stack`
      ] || {};

    const {
      processTasksSecurityGroupId = "",
      processTasksVpcSubnets = "",
      processTasksDefinitionArn = "",
      processTasksVPCSecurityGroupId = "",
      processTaskEcsClusterArn = "",
      processTaskServiceArn = "",
      processTasksEcsContainerName = "",
      processTasksEcsClusterName = "",
    } = processTasksStackOutputs;

    if (
      !processTasksVpcSubnets ||
      !processTasksVPCSecurityGroupId ||
      !processTasksDefinitionArn ||
      !processTasksEcsClusterName ||
      !processTasksEcsContainerName ||
      !processTaskEcsClusterArn ||
      !processTasksSecurityGroupId ||
      !processTaskServiceArn
    ) {
      console.warn(
        `Something is missing:
            - processTasksVpcSubnets: ${processTasksVpcSubnets}
            - processTasksVPCSecurityGroupId: ${processTasksVPCSecurityGroupId}
            - processTasksDefinitionArn: ${processTasksDefinitionArn}
            - processTasksEcsClusterName: ${processTasksEcsClusterName}
            - processTasksEcsContainerName: ${processTasksEcsContainerName}
            - processTaskEcsClusterArn: ${processTaskEcsClusterArn}
            - processTasksSecurityGroupId: ${processTasksSecurityGroupId}
            - processTaskServiceArn: ${processTaskServiceArn}
          `
      );
    }

    return {
      processTasksVpcSubnets,
      processTasksVPCSecurityGroupId,
      processTasksDefinitionArn,
      processTasksEcsClusterName,
      processTasksEcsContainerName,
      processTaskEcsClusterArn,
      processTasksSecurityGroupId,
      processTaskServiceArn,
    };
  }

  getDockerCode(libraryToken: string): DockerImageCode {
    return DockerImageCode.fromImageAsset("./service_code", {
      buildArgs: {
        LIBRARY_TOKEN_GITHUB: libraryToken,
      },
      platform: Platform.LINUX_AMD64,
    });
  }
}
