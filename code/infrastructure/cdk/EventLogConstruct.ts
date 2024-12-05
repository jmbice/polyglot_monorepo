import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AttributeType,
  Table,
  TableEncryption,
  BillingMode,
  TableClass,
  ProjectionType,
  StreamViewType,
} from "aws-cdk-lib/aws-dynamodb";

enum IndexesKeys {
  g1 = "index-gsi1", // Index name
  gp1 = "gsi1-p", // gsi p
  gs1 = "gsi1-s", // gsi s
  g2 = "index-gsi2", // Index name
  gp2 = "gsi2-p", // gsi p
  gs2 = "gsi2-s", // gsi s
}

export class EventLogConstruct extends Construct {
  table: Table;
  constructor(
    scope: Construct,
    stackId: string,
    props: cdk.StackProps & {
      tableName: string;
      deploymentEnvironment: string;
    }
  ) {
    super(scope, stackId);
    const { tableName, deploymentEnvironment } = props;

    this.table = new Table(this, tableName, {
      stream: StreamViewType.NEW_IMAGE, // Enable DynamoDB stream
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: false,
      tableClass: TableClass.STANDARD,
      encryption: TableEncryption.DEFAULT,
      partitionKey: {
        name: "partition",
        type: AttributeType.STRING,
      },
      sortKey: { name: "sort", type: AttributeType.STRING },
      removalPolicy: ["production", "develop"].includes(deploymentEnvironment)
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    this.createIndexes({
      globalSecondaryIndex: [
        {
          indexName: IndexesKeys.g1,
          partitionKey: {
            name: IndexesKeys.gp1,
            type: AttributeType.STRING,
          },
          sortKey: {
            name: IndexesKeys.gs1,
            type: AttributeType.NUMBER,
          },
          projectionType: ProjectionType.KEYS_ONLY,
        },
        {
          indexName: IndexesKeys.g2,
          partitionKey: {
            name: IndexesKeys.gp2,
            type: AttributeType.STRING,
          },
          sortKey: {
            name: IndexesKeys.gs2,
            type: AttributeType.STRING,
          },
          projectionType: ProjectionType.KEYS_ONLY,
        },
      ],
      localSecondaryIndex: [],
    });

    // this.setCapacity(this.table);
    this.table.applyRemovalPolicy(
      ["production", "develop"].includes(deploymentEnvironment)
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY
    );
  }

  createIndexes({ globalSecondaryIndex = [], localSecondaryIndex = [] }) {
    if (globalSecondaryIndex.length) {
      globalSecondaryIndex.map((gsiProps) =>
        this.table.addGlobalSecondaryIndex(gsiProps)
      );
    }
    if (localSecondaryIndex.length) {
      localSecondaryIndex.map((gsiProps) =>
        this.table.addLocalSecondaryIndex(gsiProps)
      );
    }
  }

  // setCapacity(table: cdk.aws_dynamodb.Table) {
  //   table.autoScaleReadCapacity({
  //     minCapacity: 1,
  //     maxCapacity: 2,
  //   });
  //   table.autoScaleWriteCapacity({
  //     minCapacity: 1,
  //     maxCapacity: 2,
  //   });
  // }
}
