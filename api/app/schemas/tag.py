from pydantic import BaseModel


class TagOut(BaseModel):
    id: int
    name: str
    slug: str
