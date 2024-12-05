import { Sequelize } from "sequelize";
import { getSecret } from "./getSecret.ts";
import { defineExampleTable } from "./tables/ExampleTable.ts";
import * as dotenv from "dotenv";
import { formatFromKebob } from "../common/formatting.ts";
dotenv.config({ path: "../../.env" });

export const setMysqlTables = async () => {
  // because we need the DB information to connect sequelize
  const { username, host, port, password, dbname, engine } = await getSecret(
    `mysqlSecret${formatFromKebob(process?.env?.DEPLOYMENT_ENVIRONMENT || "")}`
  );

  const sequelize = new Sequelize({
    username,
    host,
    port,
    password,
    database: dbname,
    dialect: engine as "mysql",
    dialectOptions: {
      ssl: "Amazon RDS",
      connectTimeout: 30000, // Set connect timeout directly in dialectOptions
    },
    // pool: {
    //   acquire: 30000, // Increase acquire timeout to 30 seconds
    //   idle: 10000,
    // },
  });

  await sequelize.authenticate();
  await defineExampleTable(sequelize);
  await sequelize.close();
};
