def reconcile_bash_path(path, IS_LOCAL):
    if IS_LOCAL:
        return path[1:]
    else:
        return path
