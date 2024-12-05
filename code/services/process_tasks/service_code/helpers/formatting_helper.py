def format_secret_key(prefix: str, deployment_environment: str) -> str:
    return prefix + "".join([part.capitalize() for part in deployment_environment.split("-")])
