import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventLogConstruct } from "./EventLogConstruct.ts";
import { EventLogProps } from "../types.ts";
import { formatFromKebob } from "../code/common/formatting.ts";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { InstanceClass, InstanceSize } from "aws-cdk-lib/aws-ec2";

export class Infrastructure extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      env: {
        account: string;
        region: string;
      };
      eventLogProps: EventLogProps;
    }
  ) {
    super(scope, id, props);
    const { eventLogProps } = props;
    const { deploymentEnvironment, allowListIps } = eventLogProps;

    const vpc = this.createPrivateVpc({ deploymentEnvironment });
    this.createRdsCluster({ vpc, deploymentEnvironment, allowListIps });
    this.createEventLogDb({
      deploymentEnvironment,
    });
    this.createS3({ deploymentEnvironment });
  }

  createPrivateVpc({
    deploymentEnvironment,
  }: {
    deploymentEnvironment: string;
  }): cdk.aws_ec2.IVpc {
    // used for having consistent IP addresses for allow-listing with partners
    const eip = new cdk.aws_ec2.CfnEIP(this, "NatGatewayEIP", {});

    const vpc = new cdk.aws_ec2.Vpc(this, `vpc-${deploymentEnvironment}`, {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public-subnet-0",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "public-subnet-1",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "private-subnet",
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: 1,
      natGatewayProvider: cdk.aws_ec2.NatProvider.gateway({
        eipAllocationIds: [eip.attrAllocationId], // Attach the EIP here
      }),
      gatewayEndpoints: {
        // Add any gateway endpoints (e.g., S3, DynamoDB) to reduce NAT traffic costs
        s3: {
          service: cdk.aws_ec2.GatewayVpcEndpointAwsService.S3,
        },
        dynamoDb: {
          service: cdk.aws_ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        },
      },
    });

    new cdk.CfnOutput(this, "vpcArn", {
      value: vpc.vpcArn,
    });

    new cdk.CfnOutput(this, "vpcId", {
      value: vpc.vpcId,
    });

    // Outputs for NAT Gateway
    new cdk.CfnOutput(this, `PublicSubnetsIdList`, {
      value: JSON.stringify(vpc.publicSubnets.map((subnet) => subnet.subnetId)),
    });

    new cdk.CfnOutput(this, `PrivateSubnetIdList`, {
      value: JSON.stringify(
        vpc.privateSubnets.map((subnet) => subnet.subnetId)
      ),
    });

    return vpc;
  }

  createRdsCluster({
    vpc,
    deploymentEnvironment,
    allowListIps,
  }: {
    vpc: cdk.aws_ec2.IVpc;
    deploymentEnvironment: string;
    allowListIps: string[];
  }): cdk.aws_rds.DatabaseCluster {
    const formattedDeploymentEnvironment = formatFromKebob(
      deploymentEnvironment
    );
    // because we use secrets manager to store system credentials access to aurora mysql
    const systemMysqlCredentials = cdk.aws_rds.Credentials.fromGeneratedSecret(
      `mysqlUser${formattedDeploymentEnvironment}`,
      {
        secretName: `mysqlSecret${formattedDeploymentEnvironment}`,
      }
    );

    // because it cant have dashes, but it needs to reflect the deployment environment it belongs to
    const auroraMysqlName = `AuroraMysql${formattedDeploymentEnvironment}`;

    const auroraSecurityGroup = new cdk.aws_ec2.SecurityGroup(
      this,
      "AuroraSecurityGroup",
      {
        vpc,
        allowAllOutbound: true,
        description: "AM-SG: Security group assigned to Aurora Msql Cluster.",
      }
    );

    // because we want to allow inbound traffic on port 3306 for MySQL from the allowed IP addresses
    allowListIps.forEach((ip) => {
      auroraSecurityGroup.addIngressRule(
        cdk.aws_ec2.Peer.ipv4(ip),
        cdk.aws_ec2.Port.tcp(3306),
        `Allow (AM-SG) access from ${ip}`
      );
    });

    allowListIps.forEach((ip) => {
      auroraSecurityGroup.addEgressRule(
        cdk.aws_ec2.Peer.ipv4(ip),
        cdk.aws_ec2.Port.tcp(3306),
        `Provide (AM-SG) data to ${ip}`
      );
    });

    const rdsDbCluster = new cdk.aws_rds.DatabaseCluster(
      this,
      `mysql-provisioned-cluster-${deploymentEnvironment}`,
      {
        cloudwatchLogsRetention: RetentionDays.ONE_WEEK,
        defaultDatabaseName: auroraMysqlName,
        vpc,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
        },
        credentials: systemMysqlCredentials,
        engine: cdk.aws_rds.DatabaseClusterEngine.auroraMysql({
          version: cdk.aws_rds.AuroraMysqlEngineVersion.VER_3_07_1,
        }),

        // because serverless is too expensive
        writer: cdk.aws_rds.ClusterInstance.provisioned(
          "mysql-writer-instance",
          {
            autoMinorVersionUpgrade: true,
            publiclyAccessible: true,
            instanceType: cdk.aws_ec2.InstanceType.of(
              InstanceClass.T3,
              InstanceSize.MEDIUM
            ),
          }
        ),

        // because we need to attach the security group to the RDS instance to allow access to select ip addresses
        securityGroups: [auroraSecurityGroup],
      }
    );

    new cdk.CfnOutput(this, "auroraSecurityGroupId", {
      value: auroraSecurityGroup.securityGroupId,
    });

    new cdk.CfnOutput(this, "rdsDbClusterArn", {
      value: rdsDbCluster.clusterArn,
    });

    new cdk.CfnOutput(this, "rdsDbClusterHostName", {
      value: rdsDbCluster.clusterEndpoint.hostname,
    });

    new cdk.CfnOutput(this, "rdsAuroraInstanceJoinedArns", {
      value: rdsDbCluster.instanceIdentifiers
        .map((instanceId) => {
          return `arn:aws:rds:${this.region}:${this.account}:db:${instanceId}`;
        })
        .join(","),
    });

    new cdk.CfnOutput(this, "secretName", {
      value: systemMysqlCredentials.secretName,
    });

    return rdsDbCluster;
  }

  createEventLogDb({
    deploymentEnvironment,
  }: {
    deploymentEnvironment: string;
  }) {
    const eventLogDB = new EventLogConstruct(
      this,
      `event-log-${deploymentEnvironment}`,
      {
        tableName: `${deploymentEnvironment}-event-log`,
        deploymentEnvironment,
      }
    );

    new cdk.CfnOutput(this, "eventLogTableName", {
      value: eventLogDB.table.tableName,
    });

    new cdk.CfnOutput(this, "eventLogArn", {
      value: eventLogDB.table.tableArn,
    });

    new cdk.CfnOutput(this, "eventLogTableStreamArn", {
      value: eventLogDB.table.tableStreamArn,
    });

    return eventLogDB.table;
  }

  createS3({ deploymentEnvironment }: { deploymentEnvironment: string }) {
    const isPersistent = ["production", "develop"].includes(
      deploymentEnvironment
    );

    const bucket = new cdk.aws_s3.Bucket(
      this,
      `affordable-storage-${deploymentEnvironment}`,
      {
        bucketName: `private-s3-bucket-${deploymentEnvironment}`,
        publicReadAccess: false,
        removalPolicy: isPersistent
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: !isPersistent,
      }
    );

    new cdk.CfnOutput(this, "privateBucketName", {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, "privateBucketArn", {
      value: bucket.bucketArn,
    });

    return bucket;
  }
}
