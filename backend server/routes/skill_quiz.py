from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from services.db_client import supabase
import os, json, random

router = APIRouter(prefix="/skill-quiz", tags=["skill-quiz"])

api_key = os.getenv("RESUME_API")

# ───────────────────────────────────────────────────
# Hardcoded question bank  –  keyed by skill (lower)
# Each entry: {"question": str, "options": [A,B,C,D], "answer": "B"}
# ───────────────────────────────────────────────────
QUESTION_BANK = {
    "python": [
        {"question": "What is the output of `print(type([]) is list)`?", "options": ["True", "False", "None", "Error"], "answer": "A"},
        {"question": "Which keyword is used to create a generator in Python?", "options": ["return", "yield", "generate", "iter"], "answer": "B"},
        {"question": "What does `len({1, 2, 2, 3})` return?", "options": ["4", "3", "2", "Error"], "answer": "B"},
        {"question": "Which of these is immutable in Python?", "options": ["list", "dict", "set", "tuple"], "answer": "D"},
        {"question": "What will `bool('')` evaluate to?", "options": ["True", "False", "None", "''"], "answer": "B"},
        {"question": "What module is used for regular expressions in Python?", "options": ["regex", "re", "regexp", "pyregex"], "answer": "B"},
        {"question": "How do you create a virtual environment?", "options": ["python -m venv env", "pip install env", "virtualenv --create", "python --env new"], "answer": "A"},
        {"question": "Which data structure uses LIFO order?", "options": ["Queue", "Deque", "Stack", "Heap"], "answer": "C"},
        {"question": "What does the `__init__` method do?", "options": ["Destroys an object", "Initializes an object", "Copies an object", "Compares objects"], "answer": "B"},
        {"question": "Which built-in function returns an enumerate object?", "options": ["iter()", "zip()", "enumerate()", "range()"], "answer": "C"},
    ],
    "javascript": [
        {"question": "What does `typeof null` return in JavaScript?", "options": ["'null'", "'object'", "'undefined'", "'boolean'"], "answer": "B"},
        {"question": "Which method converts a JSON string to an object?", "options": ["JSON.stringify()", "JSON.parse()", "JSON.convert()", "JSON.object()"], "answer": "B"},
        {"question": "What is the result of `0 == '0'`?", "options": ["true", "false", "undefined", "Error"], "answer": "A"},
        {"question": "Which keyword declares a block-scoped variable?", "options": ["var", "let", "both var and let", "global"], "answer": "B"},
        {"question": "What does `Array.isArray([1,2,3])` return?", "options": ["true", "false", "undefined", "[1,2,3]"], "answer": "A"},
        {"question": "Arrow functions do NOT have their own:", "options": ["return", "this", "parameters", "scope"], "answer": "B"},
        {"question": "Which method removes the last element from an array?", "options": ["shift()", "pop()", "splice()", "slice()"], "answer": "B"},
        {"question": "What does the spread operator `...` do?", "options": ["Compresses array", "Expands iterable", "Deletes items", "Sorts items"], "answer": "B"},
        {"question": "`NaN === NaN` evaluates to:", "options": ["true", "false", "NaN", "Error"], "answer": "B"},
        {"question": "Which event fires when the DOM is fully loaded?", "options": ["onload", "DOMContentLoaded", "ready", "domReady"], "answer": "B"},
    ],
    "react": [
        {"question": "What hook is used for side effects in React?", "options": ["useState", "useEffect", "useRef", "useReducer"], "answer": "B"},
        {"question": "JSX stands for:", "options": ["JavaScript XML", "Java Syntax Extension", "JSON Extended", "JavaScript Extension"], "answer": "A"},
        {"question": "Which method is used to update state in a class component?", "options": ["this.state()", "this.setState()", "setState()", "updateState()"], "answer": "B"},
        {"question": "What does the `key` prop help React with?", "options": ["Styling", "Reconciliation", "Routing", "Authentication"], "answer": "B"},
        {"question": "React components must return:", "options": ["A string", "A single root element or fragment", "Multiple root elements", "An object"], "answer": "B"},
        {"question": "What hook stores a mutable ref that persists across renders?", "options": ["useState", "useMemo", "useRef", "useCallback"], "answer": "C"},
        {"question": "Props in React are:", "options": ["Mutable", "Read-only", "Global variables", "State aliases"], "answer": "B"},
        {"question": "Virtual DOM is:", "options": ["A real DOM copy", "A lightweight JS representation of the DOM", "A CSS renderer", "An API"], "answer": "B"},
        {"question": "useContext is used to:", "options": ["Fetch data", "Share state across components without prop drilling", "Handle forms", "Cache data"], "answer": "B"},
        {"question": "Which lifecycle method runs after every render in class components?", "options": ["componentWillMount", "componentDidMount", "componentDidUpdate", "render"], "answer": "C"},
    ],
    "java": [
        {"question": "Java is a:", "options": ["Compiled language only", "Interpreted language only", "Both compiled and interpreted", "Scripting language"], "answer": "C"},
        {"question": "Which keyword prevents a class from being inherited?", "options": ["static", "abstract", "final", "private"], "answer": "C"},
        {"question": "What is the default value of an int variable in Java?", "options": ["null", "0", "undefined", "-1"], "answer": "B"},
        {"question": "Which collection allows duplicate elements?", "options": ["Set", "Map", "List", "TreeSet"], "answer": "C"},
        {"question": "The `==` operator compares:", "options": ["Values for primitives, references for objects", "Always values", "Always references", "Hash codes"], "answer": "A"},
        {"question": "Which interface must be implemented for custom sorting?", "options": ["Iterable", "Comparable", "Serializable", "Cloneable"], "answer": "B"},
        {"question": "What does JVM stand for?", "options": ["Java Virtual Machine", "Java Variable Manager", "Java Version Manager", "Java Visual Module"], "answer": "A"},
        {"question": "Which access modifier gives the widest access?", "options": ["private", "protected", "default", "public"], "answer": "D"},
        {"question": "What is autoboxing in Java?", "options": ["Converting string to int", "Converting primitive to wrapper", "Converting object to array", "Converting class to interface"], "answer": "B"},
        {"question": "Which exception is thrown for dividing by zero (int)?", "options": ["NullPointerException", "ArithmeticException", "NumberFormatException", "IllegalArgumentException"], "answer": "B"},
    ],
    "sql": [
        {"question": "Which SQL clause is used to filter groups?", "options": ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], "answer": "B"},
        {"question": "What does `DISTINCT` do?", "options": ["Sorts results", "Removes duplicate rows", "Limits results", "Joins tables"], "answer": "B"},
        {"question": "Which join returns all rows from both tables?", "options": ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"], "answer": "D"},
        {"question": "What is a primary key?", "options": ["Any column", "A unique identifier for each row", "A foreign reference", "An index"], "answer": "B"},
        {"question": "Which command is used to add a new row?", "options": ["UPDATE", "INSERT INTO", "ALTER", "CREATE"], "answer": "B"},
        {"question": "What does `COUNT(*)` return?", "options": ["Sum of values", "Number of rows", "Average", "Max value"], "answer": "B"},
        {"question": "A foreign key:", "options": ["Must be unique", "References a primary key in another table", "Cannot be null", "Is auto-incremented"], "answer": "B"},
        {"question": "Which clause sorts results?", "options": ["GROUP BY", "ORDER BY", "SORT BY", "ARRANGE BY"], "answer": "B"},
        {"question": "What does DDL stand for?", "options": ["Data Definition Language", "Data Design Language", "Database Description Language", "Data Deployment Language"], "answer": "A"},
        {"question": "Which aggregate function finds the smallest value?", "options": ["MIN()", "LEAST()", "SMALL()", "BOTTOM()"], "answer": "A"},
    ],
    "html": [
        {"question": "Which tag is used for the largest heading?", "options": ["<h6>", "<heading>", "<h1>", "<head>"], "answer": "C"},
        {"question": "What does HTML stand for?", "options": ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"], "answer": "A"},
        {"question": "Which attribute specifies an image source?", "options": ["href", "src", "link", "source"], "answer": "B"},
        {"question": "The <br> tag is:", "options": ["A block element", "An inline element / self-closing", "A semantic element", "A form element"], "answer": "B"},
        {"question": "Which input type creates a checkbox?", "options": ["type='check'", "type='checkbox'", "type='tick'", "type='bool'"], "answer": "B"},
        {"question": "Semantic HTML element for navigation:", "options": ["<div>", "<nav>", "<menu>", "<header>"], "answer": "B"},
        {"question": "<meta charset='UTF-8'> goes inside:", "options": ["<body>", "<head>", "<footer>", "<main>"], "answer": "B"},
        {"question": "Which tag creates an unordered list?", "options": ["<ol>", "<ul>", "<li>", "<list>"], "answer": "B"},
        {"question": "The 'alt' attribute on <img> is for:", "options": ["Styling", "Accessibility / fallback text", "Linking", "Animation"], "answer": "B"},
        {"question": "Which element defines a table row?", "options": ["<td>", "<tr>", "<th>", "<table>"], "answer": "B"},
    ],
    "css": [
        {"question": "Which property changes text color?", "options": ["font-color", "text-color", "color", "foreground"], "answer": "C"},
        {"question": "What does `display: flex` do?", "options": ["Hides element", "Creates a flex container", "Floats element", "Centers text"], "answer": "B"},
        {"question": "Which unit is relative to the root font-size?", "options": ["em", "rem", "px", "%"], "answer": "B"},
        {"question": "How do you select an element with id 'main'?", "options": [".main", "#main", "main", "*main"], "answer": "B"},
        {"question": "`position: absolute` is relative to:", "options": ["Viewport", "Nearest positioned ancestor", "Parent element always", "Document body"], "answer": "B"},
        {"question": "Which property adds space inside an element?", "options": ["margin", "padding", "border", "gap"], "answer": "B"},
        {"question": "Media queries are used for:", "options": ["Animations", "Responsive design", "Variables", "Fonts"], "answer": "B"},
        {"question": "z-index works on elements with position:", "options": ["static", "relative / absolute / fixed", "inline", "block"], "answer": "B"},
        {"question": "Which pseudo-class targets the first child?", "options": [":first", ":first-child", ":child(1)", ":nth(1)"], "answer": "B"},
        {"question": "CSS Grid property to define columns:", "options": ["grid-rows", "grid-template-columns", "grid-columns", "column-template"], "answer": "B"},
    ],
    "node.js": [
        {"question": "Node.js runs on which engine?", "options": ["SpiderMonkey", "V8", "Chakra", "JavaScriptCore"], "answer": "B"},
        {"question": "Which module is used to create a server?", "options": ["fs", "http", "path", "url"], "answer": "B"},
        {"question": "Node.js is:", "options": ["Multi-threaded by default", "Single-threaded with event loop", "Only for frontend", "A database"], "answer": "B"},
        {"question": "Which command initializes a new Node project?", "options": ["node init", "npm init", "npm start", "node create"], "answer": "B"},
        {"question": "The `require()` function is used to:", "options": ["Install packages", "Import modules", "Export modules", "Delete files"], "answer": "B"},
        {"question": "Which package manager comes with Node.js?", "options": ["yarn", "npm", "pnpm", "bower"], "answer": "B"},
        {"question": "What does `process.env` contain?", "options": ["File paths", "Environment variables", "Request data", "Module cache"], "answer": "B"},
        {"question": "Express.js is a:", "options": ["Database", "Web framework", "Template engine", "Testing library"], "answer": "B"},
        {"question": "Callbacks in Node can lead to:", "options": ["Memory leaks only", "Callback hell", "Faster execution", "Thread creation"], "answer": "B"},
        {"question": "`fs.readFile` is:", "options": ["Synchronous", "Asynchronous", "Blocking", "Deprecated"], "answer": "B"},
    ],
    "mongodb": [
        {"question": "MongoDB stores data as:", "options": ["Tables", "BSON documents", "XML files", "CSV rows"], "answer": "B"},
        {"question": "Which command inserts a document?", "options": ["db.col.add()", "db.col.insertOne()", "db.col.create()", "db.col.push()"], "answer": "B"},
        {"question": "MongoDB is a:", "options": ["Relational DB", "NoSQL document DB", "Graph DB", "Key-value store"], "answer": "B"},
        {"question": "Which operator is used for 'greater than'?", "options": ["$gt", "$greater", "$>", "$gte"], "answer": "A"},
        {"question": "`_id` field is:", "options": ["Optional", "Auto-generated unique identifier", "A foreign key", "An index only"], "answer": "B"},
        {"question": "Which command finds all documents?", "options": ["db.col.findAll()", "db.col.find()", "db.col.get()", "db.col.select()"], "answer": "B"},
        {"question": "Mongoose is:", "options": ["A MongoDB driver", "An ODM for MongoDB with Node.js", "A query language", "A database"], "answer": "B"},
        {"question": "MongoDB collections are analogous to SQL:", "options": ["Rows", "Columns", "Tables", "Databases"], "answer": "C"},
        {"question": "Which method updates a document?", "options": ["db.col.modify()", "db.col.updateOne()", "db.col.change()", "db.col.set()"], "answer": "B"},
        {"question": "Aggregation pipeline uses:", "options": ["Stages like $match, $group", "SQL joins", "Stored procedures", "Triggers"], "answer": "A"},
    ],
    "c++": [
        {"question": "Which operator is used for dynamic memory allocation?", "options": ["malloc", "new", "alloc", "create"], "answer": "B"},
        {"question": "C++ supports:", "options": ["Only procedural programming", "Only OOP", "Both procedural and OOP", "Only functional"], "answer": "C"},
        {"question": "What is a destructor?", "options": ["A function that creates objects", "A function called when an object is destroyed", "A copy function", "A virtual function"], "answer": "B"},
        {"question": "Which header is needed for cout?", "options": ["<stdio.h>", "<iostream>", "<conio.h>", "<output>"], "answer": "B"},
        {"question": "STL stands for:", "options": ["Standard Template Library", "Static Type Library", "Structured Text Language", "System Template Loader"], "answer": "A"},
        {"question": "Polymorphism allows:", "options": ["Only inheritance", "One interface, multiple implementations", "Only encapsulation", "Memory management"], "answer": "B"},
        {"question": "Which container provides key-value pairs?", "options": ["vector", "set", "map", "list"], "answer": "C"},
        {"question": "What does `virtual` keyword enable?", "options": ["Static binding", "Dynamic binding / runtime polymorphism", "Memory allocation", "Inline functions"], "answer": "B"},
        {"question": "A reference variable is declared with:", "options": ["*", "&", "#", "@"], "answer": "B"},
        {"question": "`const` in C++ means:", "options": ["Variable can change", "Variable is read-only after initialization", "Variable is global", "Variable is static"], "answer": "B"},
    ],
    "machine learning": [
        {"question": "Supervised learning requires:", "options": ["Only input data", "Labeled data", "Unlabeled data", "No data"], "answer": "B"},
        {"question": "Which algorithm is used for classification?", "options": ["Linear Regression", "K-Means", "Decision Tree", "PCA"], "answer": "C"},
        {"question": "Overfitting means:", "options": ["Model performs well on test data", "Model memorizes training data", "Model underfits", "Model is balanced"], "answer": "B"},
        {"question": "What does CNN stand for?", "options": ["Central Neural Network", "Convolutional Neural Network", "Connected Node Network", "Cascading Neural Network"], "answer": "B"},
        {"question": "Which metric is used for regression?", "options": ["Accuracy", "F1-Score", "RMSE", "Precision"], "answer": "C"},
        {"question": "K-Means is a type of:", "options": ["Supervised learning", "Unsupervised learning", "Reinforcement learning", "Semi-supervised learning"], "answer": "B"},
        {"question": "Gradient descent is used to:", "options": ["Increase loss", "Minimize the loss function", "Generate data", "Split datasets"], "answer": "B"},
        {"question": "What is a feature in ML?", "options": ["The output", "An input variable", "A model", "A dataset"], "answer": "B"},
        {"question": "Train-test split helps prevent:", "options": ["Underfitting", "Overfitting evaluation bias", "Data collection", "Feature engineering"], "answer": "B"},
        {"question": "Random Forest is an ensemble of:", "options": ["SVMs", "Decision Trees", "Neural Networks", "KNNs"], "answer": "B"},
    ],
    "data structures": [
        {"question": "A stack follows:", "options": ["FIFO", "LIFO", "Random", "Priority"], "answer": "B"},
        {"question": "Binary search requires the array to be:", "options": ["Empty", "Sorted", "Reversed", "Circular"], "answer": "B"},
        {"question": "Time complexity of accessing an array element by index:", "options": ["O(n)", "O(1)", "O(log n)", "O(n²)"], "answer": "B"},
        {"question": "A linked list node contains:", "options": ["Only data", "Data and pointer to next node", "Only pointer", "Index and data"], "answer": "B"},
        {"question": "Which traversal visits root first?", "options": ["Inorder", "Preorder", "Postorder", "Level order"], "answer": "B"},
        {"question": "Hash table average lookup time:", "options": ["O(n)", "O(1)", "O(log n)", "O(n²)"], "answer": "B"},
        {"question": "A queue follows:", "options": ["LIFO", "FIFO", "Random", "Sorted"], "answer": "B"},
        {"question": "Worst-case time complexity of quicksort:", "options": ["O(n log n)", "O(n²)", "O(n)", "O(log n)"], "answer": "B"},
        {"question": "A binary tree has at most how many children per node?", "options": ["1", "2", "3", "Unlimited"], "answer": "B"},
        {"question": "Graph BFS uses which data structure?", "options": ["Stack", "Queue", "Heap", "Array"], "answer": "B"},
    ],
    "typescript": [
        {"question": "TypeScript is a superset of:", "options": ["Java", "Python", "JavaScript", "C#"], "answer": "C"},
        {"question": "Which keyword defines an interface?", "options": ["type", "interface", "class", "struct"], "answer": "B"},
        {"question": "TypeScript compiles to:", "options": ["Bytecode", "JavaScript", "Machine code", "WebAssembly"], "answer": "B"},
        {"question": "What does `?` after a property name mean?", "options": ["Required", "Optional", "Nullable", "Readonly"], "answer": "B"},
        {"question": "`unknown` vs `any` — which is type-safe?", "options": ["any", "unknown", "Both", "Neither"], "answer": "B"},
        {"question": "Generics allow:", "options": ["Only string types", "Reusable components with multiple types", "Only number types", "No types"], "answer": "B"},
        {"question": "Enum in TypeScript:", "options": ["Defines constants", "Defines a named set of constants", "Is a loop", "Is a function"], "answer": "B"},
        {"question": "`readonly` modifier means:", "options": ["Property can change", "Property is assigned once and cannot be mutated", "Property is private", "Property is optional"], "answer": "B"},
        {"question": "Which file configures TypeScript compiler options?", "options": ["package.json", "tsconfig.json", "tslint.json", ".tsrc"], "answer": "B"},
        {"question": "Type assertion uses:", "options": ["`as` keyword or angle brackets", "`typeof`", "`instanceof`", "`cast`"], "answer": "A"},
    ],
    "git": [
        {"question": "Which command stages changes?", "options": ["git commit", "git add", "git push", "git pull"], "answer": "B"},
        {"question": "What does `git clone` do?", "options": ["Creates a branch", "Copies a remote repository locally", "Deletes a repo", "Merges branches"], "answer": "B"},
        {"question": "`git stash` is used to:", "options": ["Delete changes", "Temporarily save uncommitted changes", "Push changes", "Create a branch"], "answer": "B"},
        {"question": "Which command shows commit history?", "options": ["git status", "git log", "git diff", "git show"], "answer": "B"},
        {"question": "A merge conflict occurs when:", "options": ["Files are deleted", "Same lines are changed in different branches", "A commit is missing", "Remote is empty"], "answer": "B"},
        {"question": "`HEAD` in Git refers to:", "options": ["First commit", "Current commit / branch pointer", "Remote branch", "Stash"], "answer": "B"},
        {"question": "Which command creates a new branch?", "options": ["git branch <name>", "git new <name>", "git create <name>", "git fork <name>"], "answer": "A"},
        {"question": "`git rebase` vs `git merge`:", "options": ["Both identical", "Rebase rewrites history, merge creates a merge commit", "Merge rewrites history", "Neither changes history"], "answer": "B"},
        {"question": "Which file tells Git to ignore files?", "options": [".gitconfig", ".gitignore", ".gitkeep", ".gitmodules"], "answer": "B"},
        {"question": "`git pull` is equivalent to:", "options": ["git fetch + git merge", "git push + git commit", "git add + git commit", "git stash + git pop"], "answer": "A"},
    ],
    "docker": [
        {"question": "A Dockerfile starts with:", "options": ["RUN", "FROM", "CMD", "COPY"], "answer": "B"},
        {"question": "Which command builds an image?", "options": ["docker run", "docker build", "docker create", "docker start"], "answer": "B"},
        {"question": "Containers are:", "options": ["Virtual machines", "Lightweight isolated processes", "Physical servers", "Databases"], "answer": "B"},
        {"question": "Which command lists running containers?", "options": ["docker images", "docker ps", "docker list", "docker show"], "answer": "B"},
        {"question": "Docker Compose is used for:", "options": ["Building images", "Multi-container orchestration", "Monitoring", "Networking only"], "answer": "B"},
        {"question": "A Docker volume is for:", "options": ["Networking", "Persistent data storage", "CPU allocation", "Image layering"], "answer": "B"},
        {"question": "Which command runs a container?", "options": ["docker start", "docker run", "docker exec", "docker begin"], "answer": "B"},
        {"question": "`EXPOSE` in Dockerfile:", "options": ["Opens a port on the host", "Documents which port the app listens on", "Blocks a port", "Creates a network"], "answer": "B"},
        {"question": "Docker Hub is:", "options": ["A CI/CD tool", "A public image registry", "A monitoring tool", "An IDE"], "answer": "B"},
        {"question": "Difference between CMD and ENTRYPOINT:", "options": ["No difference", "CMD can be overridden, ENTRYPOINT is the fixed executable", "ENTRYPOINT can be overridden", "CMD runs first"], "answer": "B"},
    ],
}

# Alias mappings so common skill names hit the right bank
SKILL_ALIASES = {
    "js": "javascript", "node": "node.js", "nodejs": "node.js",
    "express": "node.js", "expressjs": "node.js",
    "reactjs": "react", "react.js": "react",
    "mongo": "mongodb", "c": "c++", "cpp": "c++",
    "ml": "machine learning", "ai": "machine learning",
    "deep learning": "machine learning",
    "dsa": "data structures", "algorithms": "data structures",
    "ds": "data structures", "ts": "typescript",
    "pg": "sql", "postgres": "sql", "postgresql": "sql",
    "mysql": "sql", "sqlite": "sql", "database": "sql",
    "html5": "html", "css3": "css", "scss": "css", "sass": "css",
    "tailwind": "css", "bootstrap": "css",
    "github": "git", "gitlab": "git", "version control": "git",
    "containers": "docker", "kubernetes": "docker",
}

FALLBACK_SKILLS = ["python", "javascript", "sql", "data structures"]


def _resolve_skill(raw: str) -> str:
    """Normalise a skill name to a question-bank key."""
    low = raw.strip().lower()
    return SKILL_ALIASES.get(low, low)


def _pick_questions(skills: list[str], count: int = 10) -> list[dict]:
    """Pick *count* questions across *skills* from the bank."""
    pool: list[dict] = []
    resolved = list(dict.fromkeys(_resolve_skill(s) for s in skills))  # dedupe, order-preserving
    matched = [s for s in resolved if s in QUESTION_BANK]
    if not matched:
        matched = FALLBACK_SKILLS

    # Distribute evenly, then pad randomly
    per_skill = max(1, count // len(matched))
    for skill in matched:
        bank = QUESTION_BANK[skill]
        chosen = random.sample(bank, min(per_skill, len(bank)))
        for q in chosen:
            pool.append({**q, "skill": skill})
        if len(pool) >= count:
            break

    # If still short, grab more from any matched skill
    if len(pool) < count:
        remaining = []
        existing_qs = {q["question"] for q in pool}
        for skill in matched:
            for q in QUESTION_BANK[skill]:
                if q["question"] not in existing_qs:
                    remaining.append({**q, "skill": skill})
        random.shuffle(remaining)
        pool.extend(remaining[: count - len(pool)])

    random.shuffle(pool)
    return pool[:count]


# ── GET /skill-quiz/questions/{user_id} ──
@router.get("/questions/{user_id}")
def get_quiz_questions(user_id: int):
    """Fetch user skills and return 10 MCQ questions."""
    try:
        profile_resp = supabase.rpc(
            "get_full_candidate_profile", {"p_user_id": user_id}
        ).execute()

        skills: list[str] = []
        if profile_resp.data:
            row = profile_resp.data[0] if isinstance(profile_resp.data, list) else profile_resp.data
            skills_raw = row.get("skills") or []
            if isinstance(skills_raw, str):
                try:
                    skills_raw = json.loads(skills_raw)
                except Exception:
                    skills_raw = []
            for s in skills_raw:
                if isinstance(s, dict):
                    skills.append(s.get("skill_name") or s.get("name") or "")
                else:
                    skills.append(str(s))
        skills = [s for s in skills if s]

        questions = _pick_questions(skills, 10)
        # Strip correct answers before sending to the client
        client_questions = []
        for idx, q in enumerate(questions):
            client_questions.append({
                "id": idx + 1,
                "skill": q["skill"],
                "question": q["question"],
                "options": q["options"],
            })

        return {
            "user_skills": skills,
            "matched_skills": list(dict.fromkeys(_resolve_skill(s) for s in skills if _resolve_skill(s) in QUESTION_BANK)),
            "questions": client_questions,
            # Store answer key server-side in a mapping
            "_answer_key": {str(idx + 1): q["answer"] for idx, q in enumerate(questions)},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /skill-quiz/evaluate ──
class QuizSubmission(BaseModel):
    user_id: int
    questions: list[dict]  # [{id, skill, question, options, user_answer}]
    answer_key: dict        # {"1": "B", "2": "A", ...}


@router.post("/evaluate")
def evaluate_quiz(payload: QuizSubmission):
    """Score the quiz and get AI analysis."""
    # 1. Score
    total = len(payload.questions)
    correct = 0
    breakdown = []
    for q in payload.questions:
        qid = str(q["id"])
        correct_ans = payload.answer_key.get(qid, "")
        user_ans = q.get("user_answer", "")
        is_correct = user_ans.strip().upper() == correct_ans.strip().upper()
        if is_correct:
            correct += 1
        breakdown.append({
            "id": q["id"],
            "skill": q.get("skill", ""),
            "question": q["question"],
            "options": q.get("options", []),
            "correct_answer": correct_ans,
            "user_answer": user_ans,
            "is_correct": is_correct,
        })

    score = correct
    percentage = round((correct / total) * 100, 1) if total else 0

    # 2. AI analysis via Gemini
    try:
        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", temperature=0.7, api_key=api_key
        )

        qa_text = ""
        for b in breakdown:
            status = "✓ CORRECT" if b["is_correct"] else "✗ WRONG"
            qa_text += (
                f"[{b['skill'].upper()}] Q: {b['question']}\n"
                f"  Options: {', '.join(b['options'])}\n"
                f"  Correct: {b['correct_answer']} | User chose: {b['user_answer']} — {status}\n\n"
            )

        prompt = f"""
You are an expert skill assessment evaluator for a tech interview platform called VidyaMitra.

A candidate just completed a 10-question skill-based quiz.

SCORE: {correct}/{total} ({percentage}%)

DETAILED RESULTS:
{qa_text}

Provide a brief but insightful analysis in the following JSON format (return ONLY valid JSON, no markdown fences):
{{
  "overall_rating": "<Excellent / Good / Average / Needs Improvement / Poor>",
  "summary": "<2-3 sentence overall assessment>",
  "skill_breakdown": [
    {{
      "skill": "<skill name>",
      "correct": <number correct>,
      "total": <number total>,
      "comment": "<1 sentence feedback>"
    }}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}}
"""
        response = model.invoke([HumanMessage(content=prompt)])
        raw_text = response.content.strip()
        # Try to parse JSON from the model response
        # Strip markdown fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()
        try:
            analysis = json.loads(raw_text)
        except json.JSONDecodeError:
            analysis = {"summary": raw_text, "overall_rating": "N/A"}
    except Exception as e:
        analysis = {"summary": f"AI analysis unavailable: {str(e)}", "overall_rating": "N/A"}

    return {
        "score": score,
        "total": total,
        "percentage": percentage,
        "breakdown": breakdown,
        "analysis": analysis,
    }
