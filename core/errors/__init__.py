class ApexError(Exception):
    pass

class ProviderError(ApexError):
    pass

class EntityResolutionError(ApexError):
    pass

class ValidationError(ApexError):
    pass

class ScannerError(ApexError):
    pass
