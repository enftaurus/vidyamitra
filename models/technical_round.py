from typing import Literal,TypedDict
from pydantic import BaseModel,Field

class QA(TypedDict):
    question:str
    answer:str
    #action:Literal["increase_difficulty","decrease_difficulty","keep_difficulty","end_interview"]
class final_analysis(BaseModel):
    analysis:str
    tips:str
    strengths:list[str]
    weaknesses:list[str]
    areas_to_focus_on:list[str]
    score:int
    
class InterviewState(TypedDict):
    candidate_profile:dict
    questiions_and_answers:list[QA]
    next_question:str
    should_end:bool
    action=Literal["increase_difficulty","decrease_difficulty","keep_difficulty","end_interview"]
    analysis:final_analysis
class questions(BaseModel):
    question:str=Field(...,description="The question to be asked in the technical round depending on the previous responses")
class answers(BaseModel):
    answer:str
    time_taken:int
class model_result(BaseModel):
    next_question:str=Field(...,description="The next question to be asked in the technical round based on the candidate's answer and profile")
    should_end:bool=Field(...,description="Whether the interview should end based on the candidate's answer and profile")
    action:Literal["increase_difficulty","decrease_difficulty","keep_difficulty","end_interview"]=Field(...,description="The action to be taken for the next question based on the candidate's answer and profile")