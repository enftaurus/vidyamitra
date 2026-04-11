from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import os

# Initialize the model
api_key = os.getenv("GROQ_API_KEY")
model = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)

# Define the prompt template
prompt_template = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant."),
        ("human", "{user_input}"),
    ]
)

# Define the output parser
output_parser = StrOutputParser()

# Create the chain
chain = prompt_template | model | output_parser

questions = {
    1: {
        "title": "Even-Odd Game",
        "problem_statement": "You are given an integer n. You must print numbers from 1 to n such that: All even numbers come first (in increasing order), Then all odd numbers (in increasing order)",
        "input_format": "A single integer n (1 ≤ n ≤ 100)",
        "output_format": "Print the sequence.",
        "sample_input": "5",
        "sample_output": "2 4 1 3 5"
    },
    2: {
        "title": "Minimum Moves to Equal",
        "problem_statement": "You are given three integers a, b, and c. In one move, you can increase any one of them by 1. Find the minimum number of moves required to make all three numbers equal.",
        "input_format": "Three integers a b c (1 ≤ a, b, c ≤ 100)",
        "output_format": "Print the minimum number of moves.",
        "sample_input": "1 2 3",
        "sample_output": "3"
    },
    3: {
        "title": "Nearly Lucky Number",
        "problem_statement": "A number is called nearly lucky if the count of digits 4 and 7 in it is itself a lucky number (only contains digits 4 and 7). Given a number n, determine if it is nearly lucky.",
        "input_format": "A number n (as a string) 1 ≤ length ≤ 100",
        "output_format": "\"YES\" if nearly lucky, \"NO\" otherwise",
        "sample_input": "4477",
        "sample_output": "YES"
    },
    4: {
        "title": "Reverse Prefix Sum",
        "problem_statement": "You are given an array of size n. Construct a new array where: The first element = sum of all elements, The second element = sum of last n-1 elements, The third = sum of last n-2, and so on.",
        "input_format": "n followed by n integers a1 a2 a3 ... an (1 ≤ n ≤ 100)",
        "output_format": "Print the new array.",
        "sample_input": "4\n1 2 3 4",
        "sample_output": "10 9 7 4"
    },
    5: {
        "title": "Binary Balance",
        "problem_statement": "You are given a binary string s. You can flip any character (0 → 1 or 1 → 0). Find the minimum number of flips required to make the string alternating (like 010101 or 101010).",
        "input_format": "A string s (1 ≤ length ≤ 100)",
        "output_format": "Print minimum flips.",
        "sample_input": "0100",
        "sample_output": "1"
    }
}


def get_questions(domain: str, difficulty: str, num_questions: int = 5):
    """
    Generates interview questions for a given domain and difficulty.
    """
    user_input = f"Generate {num_questions} interview questions for a {difficulty} level candidate in the {domain} domain."
    response = chain.invoke({"user_input": user_input})
    # Simple parsing of the response, assuming questions are separated by newlines
    questions = [q.strip() for q in response.split("\n") if q.strip()]
    return questions

def get_feedback(question: str, answer: str):
    """
    Provides feedback on a given answer to a question.
    """
    user_input = f"Question: {question}\nAnswer: {answer}\n\nProvide feedback on the answer."
    response = chain.invoke({"user_input": user_input})
    return response
