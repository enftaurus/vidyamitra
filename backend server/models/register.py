from pydantic import BaseModel, EmailStr
class register(BaseModel):
    name:str
    email:EmailStr
    password:str