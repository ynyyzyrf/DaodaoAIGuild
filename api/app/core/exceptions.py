class ApiError(Exception):
    """业务异常：统一携带业务错误码与 HTTP 状态码。"""

    def __init__(self, code: int, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)
