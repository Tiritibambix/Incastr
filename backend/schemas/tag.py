from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str


class TagOut(BaseModel):
    id: str
    name: str
    user_id: str

    model_config = {"from_attributes": True}
