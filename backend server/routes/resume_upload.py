from fastapi import APIRouter, File, UploadFile, Request, HTTPException, Form
from pydantic import BaseModel
from models.upload_resume import resume_upload
from langchain_groq import ChatGroq
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate
from services.db_client import supabase
from services.coding_profiles import (
    extract_platform_handles,
    fetch_all_coding_profiles,
    format_coding_profiles_for_prompt,
)
import tempfile
import os
import re
import time
import logging

logger = logging.getLogger(__name__)
##------------------------------------------------------------------------------------------------------------------
# Domain IDs must match the DB domains table exactly
DOMAINS = {
    1: "AI/ML",
    2: "Web Development",
    3: "Cybersecurity",
    4: "Data Science",
    5: "DevOps",
}
domain_text = "\n".join([f"{k} - {v}" for k, v in DOMAINS.items()])
##------------------------------------------------------------------------------------------------------------------
##------------------------------------------------------------------------------------------------------------------
api_key=os.getenv("GROQ_API_KEY")
model=ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.4, groq_api_key=api_key)
structured_model=model.with_structured_output(resume_upload)

# ── Retry helper for transient Groq tool_use_failed errors ──────────────────
MAX_RETRIES = 4
RETRY_DELAY_BASE = 2  # seconds; exponential backoff: 2, 4, 8, 16

def _fallback_plain_json_invoke(prompt_text: str):
    """
    Fallback: if structured output keeps failing, use a plain ChatGroq call
    that asks for raw JSON, then parse it into the resume_upload Pydantic model.
    """
    import json as _json

    fallback_model = ChatGroq(
        model_name="llama-3.3-70b-versatile",
        temperature=0.4,
        groq_api_key=api_key,
    )
    wrapped_prompt = (
        prompt_text
        + "\n\nIMPORTANT: Return your response as a single valid JSON object. "
        "Do NOT wrap it in markdown code fences. Do NOT add any text before or after the JSON."
    )
    raw_response = fallback_model.invoke(wrapped_prompt)
    raw_text = raw_response.content if hasattr(raw_response, "content") else str(raw_response)

    # Strip markdown fences if present
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    parsed = _json.loads(cleaned)
    return resume_upload.model_validate(parsed)


def invoke_structured_with_retry(prompt_text: str, retries: int = MAX_RETRIES):
    """
    Invoke the structured model with automatic retries.
    If all structured attempts fail, falls back to a plain JSON invocation.
    """
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            result = structured_model.invoke(prompt_text)
            logger.info(
                "Structured model succeeded on attempt %d/%d",
                attempt, retries,
            )
            dumped = result.model_dump()
            logger.info(
                "LLM returned analysis length=%d, resume_score=%s, domain=%s",
                len(str(dumped.get("analysis", ""))),
                dumped.get("resume_score"),
                dumped.get("domain"),
            )
            return result
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            logger.error(
                "Structured model FAILED on attempt %d/%d: %s",
                attempt, retries, str(e)[:500],
            )
            is_retryable = (
                "tool_use_failed" in err_str
                or "failed_generation" in err_str
                or "failed to call a function" in err_str
            )
            if is_retryable and attempt < retries:
                wait = RETRY_DELAY_BASE ** attempt
                logger.warning(
                    "Groq tool_use_failed on attempt %d/%d – retrying in %ds …",
                    attempt, retries, wait,
                )
                time.sleep(wait)
                continue
            # All structured attempts exhausted — try plain JSON fallback
            break

    logger.warning("All %d structured attempts failed — trying plain JSON fallback …", retries)
    try:
        result = _fallback_plain_json_invoke(prompt_text)
        logger.info("Plain JSON fallback succeeded")
        dumped = result.model_dump()
        logger.info(
            "Fallback returned analysis length=%d, resume_score=%s",
            len(str(dumped.get("analysis", ""))),
            dumped.get("resume_score"),
        )
        return result
    except Exception as fallback_err:
        logger.error("Plain JSON fallback also failed: %s", str(fallback_err)[:500])
        # Raise the original structured error since it's more informative
        raise last_error
prompt = f"""
You are a world-class resume analyst, career coach, and ATS optimization expert.
Your task is to extract structured information from the given resume text AND provide an extremely detailed, comprehensive evaluation.
You MUST follow these rules strictly:
1. Extract only information explicitly present in the resume.
2. Do NOT hallucinate or invent missing data.
3. If a section does not exist, return null for that field.
4. If a list section (skills, projects, certificates, education) is empty or not present, return null.
5. Dates must be in ISO format (YYYY-MM-DD) if available.
6. Return clean structured JSON only.
7. Do NOT return explanations outside the structured fields.
8. Do NOT return markdown outside the structured fields.
9. Speak like you are giving feedback to a close friend. Address the user as "you".
10. Be brutally honest but constructive.
-------------------------
Extract the following fields:
BASIC INFORMATION:
- phone
- bio (If not explicitly present, generate a concise professional bio strictly from resume content. Make it sound professional and LinkedIn-worthy.)
- resume_json (structured JSON representation of resume sections)
- domain (classify into exactly one domain from the list below)
EDUCATION:
For each education entry extract:
- degree
- field_of_study
- college_name
- university_name
- gpa
- start_year
- end_year
CERTIFICATES:
For each certification extract:
- certificate_name
- certificate_issuer
- certificate_date (YYYY-MM-DD if available, otherwise null)
PROJECTS:
For each project extract:
- project_name
- project_description (include tech stack if mentioned)
- project_link (if available, otherwise null)
SKILLS:
Extract individual technical skills as separate plain strings.
Avoid duplicates. Keep original order of appearance if possible.
-------------------------
DOMAIN CLASSIFICATION:
Based strictly on the candidate's skills, education, and projects,
select ONLY ONE primary domain from the list below:
{domain_text}
Return:
- domain (string only, must be exactly one from the list above)
If no clear domain matches, use AI/ML as a fallback.
-------------------------
TOP-LEVEL EVALUATION FIELDS (these must be returned as direct top-level keys, NOT nested inside any wrapper object):
Provide the following fields at the ROOT level of the output:
- analysis:
  THIS IS THE MOST IMPORTANT FIELD. You MUST write a VERY LONG, DETAILED, COMPREHENSIVE analysis (minimum 300 words, aim for 400-500 words).
  Structure it as a multi-paragraph deep-dive evaluation covering ALL of these areas:

  **PARAGRAPH 1 — First Impressions & Overall Assessment:**
  Start with your honest first impression. Is this resume ready for job applications? What tier would you rate it (entry-level, mid-level, strong)?
  
  **PARAGRAPH 2 — Resume Structure & Formatting:**
  Evaluate the layout, section ordering, use of bullet points, action verbs, and quantifiable achievements.
  Is it ATS-friendly (simple formatting, no tables/images, standard headers)?
  Point out specific formatting issues you notice.

  **PARAGRAPH 3 — Skills Analysis:**
  Are the skills relevant to their domain? Are there critical missing skills for their target domain?
  Do projects demonstrate real use of listed skills or are skills just keyword-stuffed?
  
  **PARAGRAPH 4 — Projects Deep-Dive:**
  Evaluate each project individually. Are they impressive? Do they show real engineering work or just tutorials?
  Suggest how each project description could be improved (quantify impact, mention scale, add tech decisions).
  
  **PARAGRAPH 5 — Education & Certifications:**
  Comment on GPA, university reputation, relevant coursework, and any certifications.
  
  **PARAGRAPH 6 — Career Readiness & What To Do Next:**
  Give 3-5 specific, actionable steps they should take in the next 30 days to make their resume stronger.
  Mention DSA/CP practice, open-source contributions, and portfolio improvements.

  Speak like a brutally honest but supportive friend. Use "you" and "your". Be specific — reference actual items from their resume.
  Do NOT be generic. Do NOT say "overall good resume" without backing it up.

- resume_score:
  Score out of 100. Be strict and fair. Most students should score 40-70. Only truly exceptional resumes get 80+.
  Base on: structure (15), clarity & grammar (15), impact & quantification (20), ATS optimization (15), technical depth (20), presentation (15).

- skill_analysis:
  Return a structured object with:
    * skills: list of 5-10 specific skill names the candidate MUST learn to be job-ready in their domain according to 2024-2025 market trends.
      Think: what would a recruiter at Google/Microsoft/Amazon expect? Always suggest DSA/CP improvement unless they have 500+ LeetCode problems solved.
      Do NOT say "you are good to go" easily — there is always room to improve.
    * analysis: 3-5 sentence explanation of WHY these skills matter and WHERE to learn them (specific platforms like LeetCode, Coursera, freeCodeCamp, etc.)

- suggested_projects:
  Return 2-4 impressive, complex project ideas that would genuinely strengthen their resume and help them land interviews. Each must have:
    * name: catchy project name
    * description: 3-4 sentence description explaining what it does and WHY it's impressive to recruiters
    * tech_stack: list of technologies to use
  Projects should be PORTFOLIO-WORTHY — not todo apps or calculators. Think: distributed systems, ML pipelines, browser extensions, real-time dashboards, CLI tools with real utility.
  Also strongly encourage them to practice competitive programming (CP) and DSA daily.
- coding_profiles_analysis:
    Return a structured object with:
        * leetcode_insight: concise insight from LeetCode stats
        assess the coding profiles based on competitive programming rigor, consistency, and progression over time. Look for patterns like steady improvement, recent activity, and performance in relevant problem categories.
        * codeforces_insight: concise insight from Codeforces stats
        check whats his rating and see his consistency and activity and how good is he in competitive programming
        * github_insight: concise insight from GitHub stats
        like is he having the languages related to his domain or not, is he having good number of repos or not, is he active recently or not, is he having good number of contributions or not, is he having some open source contributions or not etc.
        * overall_profile_signal: one of weak|moderate|strong|exceptional|insufficient-data
        * analysis: combined 3-5 sentence analysis of coding rigor + practical engineering exposure
        * suggestions: list of 3-5 specific, practical, and achievable action items to improve coding profiles

        STRICT CONSISTENCY RULES (must follow):
        - Use only the provided platform stats. If a platform has no stats, say data is unavailable.
        - Do not hallucinate, infer hidden data, or invent activity/rating trends.
        - Keep platform boundaries strict:
            LeetCode metrics must only be discussed in leetcode_insight.
            Codeforces metrics must only be discussed in codeforces_insight.
            GitHub metrics must only be discussed in github_insight.
        - Never confuse Codeforces with CodeChef. If CodeChef data is not provided, do not mention CodeChef.
-------------------------
If the text is not a valid resume, return an empty JSON object.
Return structured output now.
"""

CODECHEF_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?codechef\.com/users/([A-Za-z0-9_]{1,100})(?:/|$)",
    re.IGNORECASE,
)

##------------------------------------------------------------------------------------------------------------------
def clean_resume_text(text: str) -> str:
    text=text.replace("\r", "\n")
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    lines=text.split("\n")
    cleaned_lines=[]
    prev_line=""
    for line in lines:
        line=line.strip()
        if line and line!=prev_line:
            cleaned_lines.append(line)
        prev_line=line
    text="\n".join(cleaned_lines)
    parts=text.split("\n\n")
    unique_parts=list(dict.fromkeys(parts))
    text="\n\n".join(unique_parts)
    return text.strip()


def _has_minimum_resume_text(text: str) -> bool:
    """Return True when extracted resume text is sufficient for AI analysis."""
    if not text:
        return False
    return len(text.strip()) >= 80


def _pick_first_str_value(source: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _normalize_codechef_username(value: str) -> str:
    if not value:
        return ""

    value = value.strip()
    url_match = CODECHEF_URL_RE.search(value)
    if url_match:
        return url_match.group(1)

    value = value.lstrip("@").strip().strip("/")
    if "/" in value:
        value = value.split("/")[0]

    value = re.sub(r"[^A-Za-z0-9_]", "", value)
    return value[:100]


def _extract_codechef_from_text(text: str) -> str:
    if not text:
        return ""
    match = CODECHEF_URL_RE.search(text)
    return match.group(1) if match else ""


def _normalize_handle_map(handles: dict | None) -> dict[str, str]:
    handles = handles or {}
    normalized = extract_platform_handles(
        leetcode_username=str(handles.get("leetcode") or ""),
        codeforces_handle=str(handles.get("codeforces") or ""),
        github_username=str(handles.get("github") or ""),
        text="",
    )
    normalized["codechef"] = _normalize_codechef_username(str(handles.get("codechef") or ""))
    return normalized


def _get_latest_coding_profiles_row(user_id: str) -> dict | None:
    try:
        response = (
            supabase
            .table("coding_profiles")
            .select("id,user_id,leetcode_username,codeforces_username,codechef_username,github_username")
            .eq("user_id", int(user_id))
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def _load_saved_coding_profile_usernames(user_id: str) -> dict[str, str]:
    row = _get_latest_coding_profiles_row(user_id)
    if not row:
        return {"leetcode": "", "codeforces": "", "codechef": "", "github": ""}

    return _normalize_handle_map(
        {
            "leetcode": row.get("leetcode_username"),
            "codeforces": row.get("codeforces_username"),
            "codechef": row.get("codechef_username"),
            "github": row.get("github_username"),
        }
    )


def _upsert_user_coding_profile_usernames(user_id: str, handles: dict | None) -> None:
    normalized = _normalize_handle_map(handles)
    if not any(normalized.values()):
        return

    existing_row = _get_latest_coding_profiles_row(user_id)
    payload = {
        "leetcode_username": normalized["leetcode"] or None,
        "codeforces_username": normalized["codeforces"] or None,
        "codechef_username": normalized["codechef"] or None,
        "github_username": normalized["github"] or None,
    }

    try:
        if not existing_row:
            supabase.table("coding_profiles").insert({"user_id": int(user_id), **payload}).execute()
            return

        existing_normalized = _normalize_handle_map(
            {
                "leetcode": existing_row.get("leetcode_username"),
                "codeforces": existing_row.get("codeforces_username"),
                "codechef": existing_row.get("codechef_username"),
                "github": existing_row.get("github_username"),
            }
        )

        merged = {
            "leetcode": normalized["leetcode"] or existing_normalized["leetcode"],
            "codeforces": normalized["codeforces"] or existing_normalized["codeforces"],
            "codechef": normalized["codechef"] or existing_normalized["codechef"],
            "github": normalized["github"] or existing_normalized["github"],
        }

        if merged == existing_normalized:
            return

        supabase.table("coding_profiles").update(
            {
                "leetcode_username": merged["leetcode"] or None,
                "codeforces_username": merged["codeforces"] or None,
                "codechef_username": merged["codechef"] or None,
                "github_username": merged["github"] or None,
            }
        ).eq("id", existing_row.get("id")).execute()
    except Exception:
        # Optional persistence only.
        return


def _resolve_requested_coding_profile_handles(
    source_text: str,
    basic_info: dict | None = None,
    saved_handles: dict | None = None,
) -> dict[str, str]:
    basic_info = basic_info or {}
    saved = _normalize_handle_map(saved_handles)

    raw_leetcode = _pick_first_str_value(
        basic_info,
        ("leetcode", "leetcode_username", "leetcode_url"),
    )
    raw_codeforces = _pick_first_str_value(
        basic_info,
        ("codeforces", "codeforces_handle", "codeforces_username", "codeforces_url"),
    )
    raw_github = _pick_first_str_value(
        basic_info,
        ("github", "github_username", "github_url"),
    )
    raw_codechef = _pick_first_str_value(
        basic_info,
        ("codechef", "codechef_username", "codechef_url"),
    )

    extracted_handles = extract_platform_handles(
        leetcode_username=raw_leetcode,
        codeforces_handle=raw_codeforces,
        github_username=raw_github,
        text=source_text,
    )
    codechef = _normalize_codechef_username(raw_codechef) or _extract_codechef_from_text(source_text)

    return {
        "leetcode": extracted_handles["leetcode"] or saved["leetcode"],
        "codeforces": extracted_handles["codeforces"] or saved["codeforces"],
        "codechef": codechef or saved["codechef"],
        "github": extracted_handles["github"] or saved["github"],
    }


def _with_profile_username_context(base_context: str, handles: dict[str, str]) -> str:
    lines = []
    if handles.get("leetcode"):
        lines.append(f"- LeetCode username provided: {handles['leetcode']}")
    if handles.get("codeforces"):
        lines.append(f"- Codeforces username provided: {handles['codeforces']}")
    if handles.get("codechef"):
        lines.append(
            f"- CodeChef username provided: {handles['codechef']} (username only; stats are not fetched in this pipeline)"
        )
    if handles.get("github"):
        lines.append(f"- GitHub username provided: {handles['github']}")

    if not lines:
        return base_context

    block = (
        "PROFILE USERNAMES (use these handles as reliable context even when stats are unavailable):\n"
        + "\n".join(lines)
        + "\n"
    )

    if not base_context:
        return (
            "\n"
            "CODING PROFILE DATA (factor this into resume_score, skill_analysis, and suggested_projects):\n"
            f"{block}"
            "Use this data as evidence of DSA strength, competitive coding rigor, and practical project exposure.\n"
        )

    return f"{base_context}\n{block}"


def _build_coding_profile_context(
    source_text: str,
    basic_info: dict | None = None,
    saved_handles: dict | None = None,
) -> tuple[dict, str, dict]:
    handles = _resolve_requested_coding_profile_handles(
        source_text=source_text,
        basic_info=basic_info,
        saved_handles=saved_handles,
    )

    try:
        profiles = fetch_all_coding_profiles(
            leetcode_username=handles["leetcode"],
            codeforces_handle=handles["codeforces"],
            github_username=handles["github"],
        )
        context = format_coding_profiles_for_prompt(profiles)
        context = _with_profile_username_context(context, handles)
        return profiles, context, handles
    except Exception:
        # Profile enrichment should never break resume upload/build.
        return {
            "leetcode": None,
            "codeforces": None,
            "github": None,
        }, _with_profile_username_context("", handles), handles


##------------------------------------------------------------------------------------------------------------------
##------------------------------------------------------------------------------------------------------------------
router = APIRouter(prefix="/resume", tags=["Resume Upload"])


def _sanitize_resume_payload(data: dict) -> dict:
    """
    Ensure array fields (skills, education, certificates, projects) are proper
    lists — never Python None, which serializes to JSON null and causes Postgres
    error 22023 ('cannot extract elements from a scalar') inside jsonb_array_elements.

    Also normalizes skills from flat strings to {"skill_name": "..."} objects
    because the LLM naturally returns strings but the DB expects objects.

    IMPORTANT: Do NOT hoist or unpack the 'candidates' sub-dict — the
    upsert_full_resume RPC reads data->'candidates'->'phone' etc. directly.
    """
    list_fields = ["skills", "education", "certificates", "projects"]
    for field in list_fields:
        val = data.get(field)
        if not isinstance(val, list):
            # Covers None, JSON null strings, unexpected scalars
            data[field] = []

    # Normalize skills: LLM returns ["Python", "SQL"] but DB expects [{"skill_name": "Python"}]
    normalized_skills = []
    for s in data["skills"]:
        if isinstance(s, str):
            normalized_skills.append({"skill_name": s})
        elif isinstance(s, dict) and "skill_name" in s:
            normalized_skills.append(s)
        # skip anything else malformed
    data["skills"] = normalized_skills

    # Also sanitize inside candidates sub-dict if present
    if isinstance(data.get("candidates"), dict):
        cand = data["candidates"]
        if cand.get("resume_json") is None:
            cand["resume_json"] = {}
        if not isinstance(cand.get("domain"), str) or not cand.get("domain", "").strip():
            cand["domain"] = data.get("domain") or "AI/ML"

    if not isinstance(data.get("analysis"), str) or not data.get("analysis", "").strip():
        data["analysis"] = (
            "We could not generate AI analysis from the extracted resume text. "
            "This usually happens when the PDF has very little readable text (for example, an image scan). "
            "Please upload a text-based PDF resume or add more details and try again."
        )

    if not isinstance(data.get("resume_score"), int):
        data["resume_score"] = 0

    if not isinstance(data.get("domain"), str) or not data.get("domain", "").strip():
        data["domain"] = "AI/ML"

    if not isinstance(data.get("skill_analysis"), dict):
        data["skill_analysis"] = {
            "skills": [],
            "analysis": "You are good to go.",
        }

    if not isinstance(data.get("suggested_projects"), list):
        data["suggested_projects"] = []

    if not isinstance(data.get("coding_profiles_analysis"), dict):
        data["coding_profiles_analysis"] = {
            "leetcode_insight": "No LeetCode insight available.",
            "codeforces_insight": "No Codeforces insight available.",
            "github_insight": "No GitHub insight available.",
            "overall_profile_signal": "insufficient-data",
            "analysis": "Coding profile insights are not available.",
            "suggestions": [],
        }
    else:
        cpa = data["coding_profiles_analysis"]
        if not isinstance(cpa.get("suggestions"), list):
            cpa["suggestions"] = []
        else:
            cpa["suggestions"] = [
                item.strip() for item in cpa["suggestions"]
                if isinstance(item, str) and item.strip()
            ]

    return data


def _persist_coding_profiles_snapshot(user_id: str, payload: dict, fallback_profiles: dict | None = None) -> None:
    """
    Best-effort persistence for coding profile metrics + AI insights.
    Does not raise to caller so resume flow remains stable if table is absent.
    """
    try:
        candidates = payload.get("candidates") if isinstance(payload.get("candidates"), dict) else {}
        resume_json = candidates.get("resume_json") if isinstance(candidates.get("resume_json"), dict) else {}
        usernames = resume_json.get("coding_profile_usernames") if isinstance(resume_json.get("coding_profile_usernames"), dict) else {}

        profiles = {}
        if isinstance(resume_json.get("coding_profiles"), dict):
            profiles = resume_json["coding_profiles"]
        elif isinstance(fallback_profiles, dict):
            profiles = fallback_profiles

        insights = payload.get("coding_profiles_analysis") if isinstance(payload.get("coding_profiles_analysis"), dict) else {}

        row = {
            "user_id": int(user_id),
            "leetcode_username": usernames.get("leetcode") or (profiles.get("leetcode") or {}).get("username"),
            "codeforces_handle": usernames.get("codeforces") or (profiles.get("codeforces") or {}).get("handle"),
            "github_username": usernames.get("github") or (profiles.get("github") or {}).get("username"),
            "leetcode_stats": profiles.get("leetcode"),
            "codeforces_stats": profiles.get("codeforces"),
            "github_stats": profiles.get("github"),
            "overall_profile_signal": insights.get("overall_profile_signal"),
            "coding_profiles_analysis": insights,
            "source": "resume-upload",
        }

        supabase.table("candidate_coding_profiles_analysis").insert(row).execute()
    except Exception:
        # Optional persistence only.
        return



class ManualResumePayload(BaseModel):
    basic: dict
    skills: list[str] | None = None
    education: dict | None = None
    certificates: list[dict] | None = None
    projects: list[dict] | None = None
    placements: list[dict] | None = None


@router.post("/build")
def build_resume(payload: ManualResumePayload, request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    details = payload.model_dump()

    # Convert the structured data into a text format for the LLM
    resume_text = ""
    if details.get("basic"):
        resume_text += "BASIC INFO:\n" + "\n".join(f"{k}: {v}" for k, v in details["basic"].items()) + "\n\n"
    if details.get("skills"):
        resume_text += "SKILLS:\n" + ", ".join(details["skills"]) + "\n\n"
    if details.get("education"):
        resume_text += "EDUCATION:\n" + "\n".join(f"{k}: {v}" for k, v in details["education"].items()) + "\n\n"
    if details.get("projects"):
        resume_text += "PROJECTS:\n"
        for p in details["projects"]:
            resume_text += f"- {p.get('project_name', '')}: {p.get('project_description', '')}\n"
        resume_text += "\n"
    if details.get("certificates"):
        resume_text += "CERTIFICATES:\n"
        for c in details["certificates"]:
            resume_text += f"- {c.get('certificate_name', '')} from {c.get('certificate_issuer', '')}\n"
        resume_text += "\n"

    try:
        saved_handles = _load_saved_coding_profile_usernames(user_id)
        coding_profiles, coding_profile_context, resolved_handles = _build_coding_profile_context(
            source_text=resume_text,
            basic_info=details.get("basic", {}),
            saved_handles=saved_handles,
        )

        _upsert_user_coding_profile_usernames(user_id, resolved_handles)

        response = invoke_structured_with_retry(
            f"{prompt}{coding_profile_context}\n\n resume_text:{resume_text}"
        )
        json_response = response.model_dump()

        # Ensure resume_json is populated from the original payload for storage
        json_response['resume_json'] = {
            "basic": details.get("basic", {}),
            "education": details.get("education", {}),
            "certificates": details.get("certificates", []),
            "projects": details.get("projects", []),
            "placements": details.get("placements", []),
            "skills": details.get("skills", []),
            "coding_profiles": coding_profiles,
            "coding_profile_usernames": {
                "leetcode": resolved_handles.get("leetcode") or None,
                "codeforces": resolved_handles.get("codeforces") or None,
                "codechef": resolved_handles.get("codechef") or None,
                "github": resolved_handles.get("github") or None,
            },
        }

        json_response = _sanitize_resume_payload(json_response)

        supabase.rpc(
            "upsert_full_resume",
            {
                "p_user_id": user_id,
                "data": json_response,
            },
        ).execute()
        _persist_coding_profiles_snapshot(user_id, json_response, coding_profiles)

        # Return the analysis part to the user
        list_keys = [
            "analysis",
            "resume_score",
            "skill_analysis",
            "suggested_projects",
            "coding_profiles_analysis",
        ]
        ai_analysis = {k: json_response.get(k) for k in list_keys}
        ai_analysis["coding_profiles"] = coding_profiles
        ai_analysis["coding_profile_usernames"] = {
            "leetcode": resolved_handles.get("leetcode") or None,
            "codeforces": resolved_handles.get("codeforces") or None,
            "codechef": resolved_handles.get("codechef") or None,
            "github": resolved_handles.get("github") or None,
        }

        return {
            "message": "Resume details saved and analyzed successfully",
            "data": ai_analysis,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    leetcode_username: str = Form(""),
    codeforces_handle: str = Form(""),
    codechef_username: str = Form(""),
    github_username: str = Form(""),
):
    user_id=request.cookies.get("user_id")
    start_time=time.time()
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name
    try:
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()
        full_text = "\n".join(page.page_content for page in pages)
        cleaned_text = clean_resume_text(full_text)

        if not _has_minimum_resume_text(cleaned_text):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not extract enough readable text from the uploaded PDF. "
                    "Please upload a text-based resume PDF (not a scanned image PDF), "
                    "or use the Build Resume flow."
                ),
            )

        saved_handles = _load_saved_coding_profile_usernames(user_id)
        coding_profiles, coding_profile_context, resolved_handles = _build_coding_profile_context(
            source_text=cleaned_text,
            basic_info={
                "leetcode": leetcode_username,
                "codeforces": codeforces_handle,
                "codechef": codechef_username,
                "github": github_username,
            },
            saved_handles=saved_handles,
        )

        _upsert_user_coding_profile_usernames(user_id, resolved_handles)

        response = invoke_structured_with_retry(
            f"{prompt}{coding_profile_context}\n\n resume_text:{cleaned_text}"
        )
        json_response = response.model_dump()
        logger.info("Upload: raw analysis preview: %s", str(json_response.get("analysis", ""))[:200])
        logger.info("Upload: resume_score=%s, domain=%s", json_response.get("resume_score"), json_response.get("domain"))

        if isinstance(json_response.get("candidates"), dict):
            candidate = json_response["candidates"]
            if not isinstance(candidate.get("resume_json"), dict):
                candidate["resume_json"] = {}
            candidate["resume_json"]["coding_profiles"] = coding_profiles
            candidate["resume_json"]["coding_profile_usernames"] = {
                "leetcode": resolved_handles.get("leetcode") or None,
                "codeforces": resolved_handles.get("codeforces") or None,
                "codechef": resolved_handles.get("codechef") or None,
                "github": resolved_handles.get("github") or None,
            }

        json_response = _sanitize_resume_payload(json_response)
        supabase.rpc(
            "upsert_full_resume",
            {
                "p_user_id":user_id,
                "data": json_response
            }
        ).execute()
        _persist_coding_profiles_snapshot(user_id, json_response, coding_profiles)
        #return {"message": "Resume uploaded and processed successfully", "data": json_response}
        list_keys=[
            "analysis",
            "resume_score",
            "skill_analysis",
            "suggested_projects",
            "coding_profiles_analysis",
        ]
        ai_analysis={}
        for k in json_response.keys():
            if k in list_keys:
                ai_analysis[k]=json_response[k]
        ai_analysis["coding_profiles"] = coding_profiles
        ai_analysis["coding_profile_usernames"] = {
            "leetcode": resolved_handles.get("leetcode") or None,
            "codeforces": resolved_handles.get("codeforces") or None,
            "codechef": resolved_handles.get("codechef") or None,
            "github": resolved_handles.get("github") or None,
        }
        end_time=time.time()
        latency=end_time-start_time
        #print(json_response)
        return {"message": "Resume uploaded and processed successfully", "data": ai_analysis, "processing_time": latency}
    except Exception as e:
        logger.exception("Resume upload failed for user_id=%s: %s", user_id, str(e)[:500])
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.remove(tmp_path)
##------------------------------------------------------------------------------------------------------------------
# def validate_resume(text: str) -> bool:
#     resume_keywords = [
#         "education",
#         "experience",
#         "skills",
#         "employment",
#         "profile",
#         "projects",
#         "certification",
#     ]
#     text_lower = text.lower()
#     return any(keyword in text_lower for keyword in resume_keywords)
