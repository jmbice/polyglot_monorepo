## Example of a Polyglot Monorepo Deployment

This is part of a skeleton inspired by a short project I worked on for a mature product towards (0) Automating deployments with CDK and CICD, (1) containerizing existing logic, (2) creating a distinct development and production environment, (3) implementing automated testing, (4) and migrating away from EBS volumes for cost. This skeleton was a private exploration of low-effort home-grown CICD, polyglot monorepo for Python and Node for a mature ETL-like product.

### Requirements

You will need:

- Python v3.12
- Pip v24
- Node v20.9.0
- AWS cdk globally installed (latest node version)
- Typescript v5.4.3
- npm 10.2.2
- .env file

If you are receiving build errors, please check the version of the above requirements

### Vocabulary

Terms that are useful:

#### Workspaces

This is an npm monorepo. Workspaces are configured in the root directory's package.json. Each workspace has its own package.json to configure its dependencies.

#### Services

Services are workspaces that deploy a python service to AWS. Python projects have their own dependencies managed in their requirements.txt file. Each python project is in a folder called service_code.

### Commands

#### Install Node Modules

`npm i`

Run this command to load node modules in every workspace in the monorepo.

#### Deploy System

`npm run cdk:deploy:all`

Run this command from the root directory of deploy all the workspaces in the directory based on your `.env` file

#### Deploy a single workspace

`npm run cdk:deploy`

Run this command from the root of a service/infrastructure directory to deploy the workspace using the cdk. Run these commands if you want to update an already deployed system or because you are manually deploying the parts of the system one-by-one

#### Test a service locally

`npm run python:install`
`npm run test:local`
`npm run python:clean`

Run the first command `npm run python:install` from the root of a service directory. This will download dependencies to a local virtual environment. Then you can run the `npm run test:local` to to run the service locally. When you are done running tests, you can do the cleanup command `npm run python:clean` if you want to remove the virtual environment and any programmatically created files.

#### Run a service locally with virtual environment

`npm run python:install`
`npm run python:clean`

Run the first command `npm run python:install` from the root of a service directory. This will download dependencies to a local virtual environment. You may then execute code within the python environment. Then you can then execute the app.py with python. Run the `npm run python:clean` when you're done, if you want to remove the virtual environment and programmatically generated files.
