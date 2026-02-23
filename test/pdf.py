from fastapi import FastAPI, UploadFile, File, HTTPException
from pypdf import PdfReader
import tempfile
import shutil
import os
import re

app = FastAPI()


# -----------------------------
# Resume Cleaning Function
# -----------------------------
def clean_resume_text(text: str) -> str:
    # Normalize line breaks
    text = text.replace("\r", "\n")

    # Remove multiple newlines
    text = re.sub(r"\n{2,}", "\n", text)

    # Remove multiple spaces/tabs
    text = re.sub(r"[ \t]{2,}", " ", text)

    # Replace weird bullet characters
    text = text.replace("•", "-")

    # Remove duplicate consecutive lines
    lines = text.split("\n")
    cleaned_lines = []
    prev_line = ""

    for line in lines:
        line = line.strip()
        if line and line != prev_line:
            cleaned_lines.append(line)
        prev_line = line

    text = "\n".join(cleaned_lines)

    # Remove large duplicate blocks
    parts = text.split("\n\n")
    unique_parts = list(dict.fromkeys(parts))
    text = "\n\n".join(unique_parts)

    return text.strip()


# -----------------------------
# Resume Heuristic Validation
# -----------------------------
def is_likely_resume(text: str) -> bool:
    resume_keywords = [
        "education",
        "experience",
        "skills",
        "employment",
        "profile",
        "projects",
        "certification",
    ]

    text_lower = text.lower()

    score = sum(keyword in text_lower for keyword in resume_keywords)

    return score >= 2  # require at least 2 resume signals


# -----------------------------
# Upload Endpoint
# -----------------------------
@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):

    # 1️⃣ Check file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    # 2️⃣ Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name

    try:
        # 3️⃣ Extract text using pypdf
        reader = PdfReader(temp_path)
        raw_text = ""

        for page in reader.pages:
            raw_text += page.extract_text() or ""

        # 4️⃣ Check if PDF has readable text
        if not raw_text.strip() or len(raw_text.strip()) < 300:
            raise HTTPException(
                status_code=400,
                detail="PDF has no readable text (possibly scanned document)",
            )

        # 5️⃣ Clean text
        cleaned_text = clean_resume_text(raw_text)

        # 6️⃣ Validate if it's a resume
        if not is_likely_resume(cleaned_text):
            raise HTTPException(
                status_code=400,
                detail="Uploaded file does not appear to be a resume",
            )

        # 7️⃣ Return cleaned resume text
        return {
            "filename": file.filename,
            "text_length": len(cleaned_text),
            "content": cleaned_text,
        }

    finally:
        # 8️⃣ Always remove temp file
        os.remove(temp_path)