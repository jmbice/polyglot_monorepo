import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

export class ProcessTaskStack extends cdk.Stack {
  constructor(
    scope: Construct,
    stackId: string,
    props: cdk.StackProps & {
      deploymentEnvironment: string;
      libraryToken: string;
      awsRegion: string;
    }
  ) {
    super(scope, stackId, props);
    const { deploymentEnvironment, libraryToken, awsRegion } = props;

    const {
      vpcId,
      eventLogTableArn,
      auroraSecurityGroupId,
      rdsAuroraInstanceArns,
      rdsDbClusterArn,
      eventLogTableName,
      privateBucketName,
    } = this.lookUpInfrastructureStackValues(deploymentEnvironment);

    this.ecsFargate({
      vpcId,
      eventLogTableArn,
      deploymentEnvironment,
      libraryToken,
      auroraSecurityGroupId,
      rdsAuroraInstanceArns,
      rdsDbClusterArn,
      awsRegion,
      eventLogTableName,
      privateBucketName,
    });
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
      eventLogArn = "",
      vpcId = "",
      auroraSecurityGroupId = "",
      rdsAuroraInstanceJoinedArns = "",
      rdsDbClusterArn = "",
      eventLogTableName = "",
      privateBucketName = "",
    } = infrastructureOutputs;

    if (
      !eventLogArn ||
      !vpcId ||
      !auroraSecurityGroupId ||
      !rdsAuroraInstanceJoinedArns ||
      !rdsDbClusterArn ||
      !eventLogTableName ||
      !privateBucketName
    ) {
      console.warn(
        `Something is missing:
            - eventLogTableArn: ${eventLogArn}
            - vpcId: ${vpcId}
            - auroraSecurityGroupId: ${auroraSecurityGroupId}
            - rdsAuroraInstanceJoinedArns: ${rdsAuroraInstanceJoinedArns}
            - rdsDbClusterArn: ${rdsDbClusterArn}
            - eventLogTableName: ${eventLogTableName}
            - privateBucketName: ${privateBucketName}
          `
      );
    }

    return {
      eventLogTableArn: eventLogArn,
      vpcId,
      auroraSecurityGroupId,
      rdsAuroraInstanceArns: rdsAuroraInstanceJoinedArns.split(","),
      rdsDbClusterArn,
      eventLogTableName,
      privateBucketName,
    };
  }

  ecsFargate({
    deploymentEnvironment,
    vpcId,
    libraryToken,
    auroraSecurityGroupId,
    awsRegion,
    eventLogTableName,
    privateBucketName,
    rdsAuroraInstanceArns,
    rdsDbClusterArn,
    eventLogTableArn,
  }) {
    const vpc = cdk.aws_ec2.Vpc.fromLookup(
      this,
      `vpc-lookup-for-ecs-${deploymentEnvironment}`,
      {
        vpcId,
      }
    );

    const cluster = new cdk.aws_ecs.Cluster(
      this,
      `cluster-${deploymentEnvironment}`,
      {
        vpc: vpc,
      }
    );

    const image = new cdk.aws_ecr_assets.DockerImageAsset(
      this,
      `fargate-image-${deploymentEnvironment}`,
      {
        directory: "./service_code",
        buildArgs: {
          LIBRARY_TOKEN_GITHUB: libraryToken,
        },
        platform: Platform.LINUX_AMD64,
      }
    );

    // Define the task definition
    const taskDefinition = new cdk.aws_ecs.FargateTaskDefinition(
      this,
      `TaskDefinition-${deploymentEnvironment}`,
      {
        cpu: 256,
        memoryLimitMiB: 512,
        taskRole: new Role(this, `EcsTaskRole-${deploymentEnvironment}`, {
          assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
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

            s3Policy: new PolicyDocument({
              statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  actions: [
                    "s3:*" // Allows all S3 actions
                  ],
                  resources: [
                    "*", // Allows access to all S3 resources
                  ],
                }),
              ],
            }),

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
          },
        }),
      }
    );

    const container = taskDefinition.addContainer(
      `Container-${deploymentEnvironment}`,
      {
        image: cdk.aws_ecs.ContainerImage.fromDockerImageAsset(image),
        environment: {
          AWS_REGION: awsRegion,
          EVENT_SOURCE_TABLE_NAME: eventLogTableName,
          DEPLOYMENT_ENVIRONMENT: deploymentEnvironment,
          BUCKET_NAME: privateBucketName,
        },
        logging: cdk.aws_ecs.LogDriver.awsLogs({
          streamPrefix: `process-task-${deploymentEnvironment}`,
          logGroup: new cdk.aws_logs.LogGroup(
            this,
            `LogGroup-${deploymentEnvironment}`,
            {
              logGroupName: `/ecs/${deploymentEnvironment}/process-task`,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
              retention: cdk.aws_logs.RetentionDays.ONE_DAY,
            }
          ),
        }),
      }
    );

    container.addPortMappings({
      containerPort: 8080,
      protocol: cdk.aws_ecs.Protocol.TCP,
    });

    // Define the Fargate service (without load balancer)
    const fargateService = new cdk.aws_ecs.FargateService(
      this,
      `FargateService-${deploymentEnvironment}`,
      {
        cluster,
        taskDefinition,
        desiredCount: 1,
        vpcSubnets: { subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS },
        assignPublicIp: false, // Set to true if you want the service to be accessible publicly
      }
    );

    // Create a security group to manage fargate
    const fargateServiceSecurityGroup = new cdk.aws_ec2.SecurityGroup(
      this,
      `SecurityGroup-${deploymentEnvironment}`,
      {
        vpc,
        allowAllOutbound: true,
        description: "FTS-SG: Security Group assigned to Fargate Task Service",
      }
    );

    const auroraSecurityGroup = cdk.aws_ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "AuroraSecurityGroup",
      auroraSecurityGroupId
    );

    auroraSecurityGroup.addIngressRule(
      cdk.aws_ec2.Peer.securityGroupId(
        fargateServiceSecurityGroup.securityGroupId
      ),
      cdk.aws_ec2.Port.tcp(3306),
      "Allow (FTS-SG) ingress to (AM-SG) on port 3306"
    );

    fargateServiceSecurityGroup.addIngressRule(
      cdk.aws_ec2.Peer.securityGroupId(auroraSecurityGroup.securityGroupId),
      cdk.aws_ec2.Port.tcp(3306),
      "Allow (AM-SG) ingress to (FTS-SG) on port 3306"
    );

    // Attach the security group to the service
    fargateService.connections.addSecurityGroup(fargateServiceSecurityGroup);

    // Output useful information
    new cdk.CfnOutput(this, "processTaskServiceArn", {
      value: fargateService.serviceArn,
    });

    new cdk.CfnOutput(this, "processTasksSecurityGroupId", {
      value: fargateServiceSecurityGroup.securityGroupId,
    });

    new cdk.CfnOutput(this, "processTasksVpcSubnets", {
      value: JSON.stringify(
        vpc.selectSubnets({
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds
      ),
      description: "Subnets used by the Fargate service",
    });

    new cdk.CfnOutput(this, "processTasksVPCSecurityGroupId", {
      value: fargateServiceSecurityGroup.securityGroupId,
      description: "Security Group ID for the Fargate service",
    });

    new cdk.CfnOutput(this, "processTasksDefinitionArn", {
      value: taskDefinition.taskDefinitionArn,
      description: "Fargate Task Definition ARN",
    });

    new cdk.CfnOutput(this, "processTasksEcsClusterName", {
      value: cluster.clusterName,
      description: "Name of the ECS cluster",
    });

    new cdk.CfnOutput(this, "processTasksEcsContainerName", {
      value: container.containerName,
      description: "Name of the ECS container",
    });

    new cdk.CfnOutput(this, "processTaskEcsClusterArn", {
      value: cluster.clusterArn,
      description: "Fargate Service ARN",
    });
  }
}
