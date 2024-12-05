export interface EventLogProps {
  deploymentEnvironment: string;
  allowListIps: string[];
}

export interface RdsSecret {
  username: string;
  password: string;
  engine: string;
  host: string;
  port: number;
  dbname: string;
  dbInstanceIdentifier: string;
}
