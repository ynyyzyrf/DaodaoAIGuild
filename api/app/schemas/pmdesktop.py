from pydantic import BaseModel


class PmDesktopProductOut(BaseModel):
    id: str
    name: str
    status: str = ""
