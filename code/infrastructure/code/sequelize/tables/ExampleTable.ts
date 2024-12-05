import { DataTypes, Sequelize } from "sequelize";

// Define a model (this will map to a table)

export const defineExampleTable = async (sequelize: Sequelize) => {
  await sequelize
    .define(
      "Example",
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        message: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: new Date().toISOString(),
        },
      },
      {
        tableName: "example",
        timestamps: false,
      }
    )
    .sync({ force: false }); // Because sync force true would overwrite existing tables
};
