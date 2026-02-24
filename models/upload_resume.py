from typing import Optional

from pydantic import BaseModel, Field
class basic_info(BaseModel):
    phone: str = Field(..., description="The phone number of the person")
    bio:str = Field(..., description="The bio of the person")
    resume_json: dict = Field(..., description="The resume in json format")
    domain:str=Field(..., description="The domain of the person")
class education_info(BaseModel):
    degree: str = Field(..., description="The degree obtained (e.g., B.Tech, M.Tech, Intermediate, SSC)")
    field_of_study: Optional[str] = Field(
        default=None,
        description="The field of study (e.g., Computer Science, Mechanical Engineering)"
    )
    college_name: str = Field(..., description="The name of the college or school")
    university_name: Optional[str] = Field(
        default=None,
        description="The name of the university affiliated"
    )
    gpa: Optional[float] = Field(
        default=None,
        description="The GPA or percentage obtained"
    )
    start_year: Optional[int] = Field(
        default=None,
        description="The starting year of the education"
    )
    end_year: Optional[int] = Field(
        default=None,
        description="The ending year of the education"
    )
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
    analysis:str=Field(..., description="give the analyis of the resume if you were an interviewer how would you feel and what must be improved")
    resume_score:int=Field(..., description="give a score out of 100 to the resume based on the quality of the resume and how well it is structured and how well it is written and how well it is formatted and how well it is organized and how well it is presented and how well it is tailored to the job description and how well it is optimized for ATS and how well it is optimized for human readers")
    domain:str=Field(..., description="give the domain of the resume based on the skills and experience mentioned in the resume")
    skill_analysis:str=Field(..., description="for the domain to which the candidate belong give the analysis of what skills should the candidate improve and resources to learn them like yt channels if the candidate is good avoid this just say you are good to go")
    suggested_projects:str=Field(..., description="for the domain to which the candidate belong give the analysis of what projects should the candidate work on to improve his resume and get more job opportunities like project ideas and resources to learn them like yt channels if the candidate is good avoid this just say you are good to go")