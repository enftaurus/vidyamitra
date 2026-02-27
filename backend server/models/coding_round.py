from pydantic import BaseModel, Field
class solution(BaseModel):
    code:str=Field(..., description="The code solution submitted by the user")
    time_taken:float=Field(..., description="Time taken by the user to solve the problem in seconds")
    language:str=Field(..., description="Programming language used by the user for the solution")
class analysis(BaseModel):
    code_analysis:str=Field(..., description="Analysis of the submitted code solution in terms of its correctness, efficiency, readability, and any potential issues or bugs")
    solution_improvement:str=Field(..., description="Suggestions for improving the solution")
    tips_for_user:str=Field(..., description="Tips for the user to improve their coding skills and logic and syntax if needed")
    overall_analysis:str=Field(..., description="Overall analysis of the solution considering all aspects")
    overall_score:int=Field(..., description="Overall score for the solution out of 100 based on the code efficiency, correctness, readability, and improvement suggestions")