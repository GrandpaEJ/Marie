class Tool:
    def __init__(self, name, description, parameters, safe=True):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.safe = safe

    def run(self, **kwargs):
        raise NotImplementedError
