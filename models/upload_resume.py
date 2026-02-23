from typing import Optional

from pydantic import BaseModel, Field
class basic_info(BaseModel):
    phone: str = Field(..., description="The phone number of the person")
    bio:str = Field(..., description="The bio of the person")
    resume_json: dict = Field(..., description="The resume in json format")

class certificate_info(BaseModel):
    certificate_name: str = Field(..., description="The name of the certificate")
    certificate_issuer:str=Field(..., description="The issuer of the certificate")
    certificate_date:str=Field(..., description="The date of issue of the certificate")
class projects_info(BaseModel):
    project_name: str = Field(..., description="The name of the project")
    project_description:str=Field(..., description="The description of the project")
    project_link:  Optional[str] = Field(
        default=None,
        description="The link to the project"
    )
class skills_info(BaseModel):
    skill_name: str = Field(..., description="The name of the skill")

class resume_upload(BaseModel):
    candidates: basic_info = Field(..., description="The basic information of the person")
    certificates: Optional[list[certificate_info]] = Field(
        default=None,
        description="The list of certificates"
    )
    projects: Optional[list[projects_info]] = Field(
        default=None,
        description="The list of projects"
    )
    skills: Optional[list[skills_info]] = Field(
        default=None,
        description="The list of skills"
    )