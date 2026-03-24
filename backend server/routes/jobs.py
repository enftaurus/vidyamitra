from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import json
import os
import html

from services.db_client import supabase
from services.leaderboard import register_quick_apply

router = APIRouter(prefix="/jobs", tags=["jobs"])


class QuickApplyPayload(BaseModel):
	job_id: int


class JobResumePayload(BaseModel):
	job_id: int


class ResumeBasic(BaseModel):
	name: str | None = Field(default=None)
	email: str | None = Field(default=None)
	phone: str | None = Field(default=None)
	location: str | None = Field(default=None)
	target_role: str | None = Field(default=None)


class ResumeEducation(BaseModel):
	degree: str | None = Field(default=None)
	institution: str | None = Field(default=None)
	start_year: str | None = Field(default=None)
	end_year: str | None = Field(default=None)
	gpa: str | None = Field(default=None)


class ResumeExperience(BaseModel):
	company: str | None = Field(default=None)
	role: str | None = Field(default=None)
	duration: str | None = Field(default=None)
	points: list[str] = Field(default_factory=list)


class ResumeProject(BaseModel):
	project_name: str | None = Field(default=None)
	description: str | None = Field(default=None)
	tech_stack: list[str] = Field(default_factory=list)
	project_link: str | None = Field(default=None)


class ResumeCertification(BaseModel):
	name: str | None = Field(default=None)
	issuer: str | None = Field(default=None)
	date: str | None = Field(default=None)


class TailoredResumeOutput(BaseModel):
	basic: ResumeBasic
	professional_summary: str = Field(default="")
	skills: list[str] = Field(default_factory=list)
	education: list[ResumeEducation] = Field(default_factory=list)
	experience: list[ResumeExperience] = Field(default_factory=list)
	projects: list[ResumeProject] = Field(default_factory=list)
	certifications: list[ResumeCertification] = Field(default_factory=list)
	feasible: bool = Field(default=True)
	feasibility_reason: str = Field(default="")
	fit_note: str = Field(default="")


def _safe(value: str | None, fallback: str = "-") -> str:
	if value is None:
		return fallback
	text = str(value).strip()
	return text if text else fallback


def _list_html(items: list[str]) -> str:
	if not items:
		return "<li>-</li>"
	return "".join(f"<li>{html.escape(_safe(item))}</li>" for item in items)


def _render_classic_elegant(resume: dict, job: dict) -> str:
	basic = resume.get("basic") or {}
	education = resume.get("education") or []
	experience = resume.get("experience") or []
	projects = resume.get("projects") or []
	certifications = resume.get("certifications") or []
	skills = resume.get("skills") or []

	education_html = "".join(
		f"""
		<div class=\"item\">
		  <div class=\"item-head\">{html.escape(_safe(item.get('degree')))}</div>
		  <div class=\"item-sub\">{html.escape(_safe(item.get('institution')))} • {html.escape(_safe(item.get('start_year')))} - {html.escape(_safe(item.get('end_year')))}</div>
		  <div class=\"item-sub\">GPA: {html.escape(_safe(item.get('gpa')))}</div>
		</div>
		"""
		for item in education
	) or "<div class=\"item\">-</div>"

	experience_html = "".join(
		f"""
		<div class=\"item\">
		  <div class=\"item-head\">{html.escape(_safe(item.get('role')))} — {html.escape(_safe(item.get('company')))}</div>
		  <div class=\"item-sub\">{html.escape(_safe(item.get('duration')))}</div>
		  <ul>{_list_html(item.get('points') or [])}</ul>
		</div>
		"""
		for item in experience
	) or "<div class=\"item\">-</div>"

	projects_html = "".join(
		f"""
		<div class=\"item\">
		  <div class=\"item-head\">{html.escape(_safe(item.get('project_name')))}</div>
		  <div>{html.escape(_safe(item.get('description')))}</div>
		  <div class=\"item-sub\">Tech: {html.escape(', '.join((item.get('tech_stack') or [])) or '-')}</div>
		  <div class=\"item-sub\">{html.escape(_safe(item.get('project_link')))}</div>
		</div>
		"""
		for item in projects
	) or "<div class=\"item\">-</div>"

	certifications_html = "".join(
		f"<li>{html.escape(_safe(item.get('name')))} — {html.escape(_safe(item.get('issuer')))} ({html.escape(_safe(item.get('date')) )})</li>"
		for item in certifications
	) or "<li>-</li>"

	return f"""
<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>{html.escape(_safe(basic.get('name'), 'Resume'))}</title>
  <style>
    body {{ font-family: Georgia, 'Times New Roman', serif; margin: 0; background: #f8f8f8; color: #1f2937; }}
    .sheet {{ max-width: 900px; margin: 18px auto; background: #fff; border: 1px solid #d1d5db; padding: 28px 34px; }}
    .header {{ border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 16px; }}
    h1 {{ margin: 0; font-size: 30px; letter-spacing: 0.5px; }}
    .meta {{ margin-top: 4px; font-size: 14px; color: #374151; }}
    .section {{ margin-top: 16px; }}
    .section h2 {{ font-size: 15px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }}
    .item {{ margin-bottom: 10px; font-size: 14px; }}
    .item-head {{ font-weight: 700; }}
    .item-sub {{ color: #4b5563; font-size: 13px; }}
    ul {{ margin: 6px 0 0 18px; padding: 0; }}
    li {{ margin-bottom: 4px; }}
    .job-fit {{ background: #f3f4f6; border-left: 4px solid #111827; padding: 10px; font-size: 14px; }}
    @media print {{ .sheet {{ margin: 0; border: none; }} body {{ background: #fff; }} }}
  </style>
</head>
<body>
  <div class=\"sheet\">
    <div class=\"header\">
      <h1>{html.escape(_safe(basic.get('name'), 'Candidate Name'))}</h1>
      <div class=\"meta\">{html.escape(_safe(basic.get('email')))} • {html.escape(_safe(basic.get('phone')))} • {html.escape(_safe(basic.get('location')))}</div>
      <div class=\"meta\">Target Role: {html.escape(_safe(basic.get('target_role'), _safe(job.get('title'))))}</div>
    </div>

    <div class=\"section\"><h2>Professional Summary</h2><div>{html.escape(_safe(resume.get('professional_summary')))}</div></div>
    <div class=\"section\"><h2>Skills</h2><ul>{_list_html(skills)}</ul></div>
    <div class=\"section\"><h2>Experience</h2>{experience_html}</div>
    <div class=\"section\"><h2>Projects</h2>{projects_html}</div>
    <div class=\"section\"><h2>Education</h2>{education_html}</div>
    <div class=\"section\"><h2>Certifications</h2><ul>{certifications_html}</ul></div>
    <div class=\"section\"><h2>Role Fit</h2><div class=\"job-fit\">{html.escape(_safe(resume.get('fit_note')))}</div></div>
  </div>
</body>
</html>
"""


def _render_classic_split(resume: dict, job: dict) -> str:
	basic = resume.get("basic") or {}
	education = resume.get("education") or []
	experience = resume.get("experience") or []
	projects = resume.get("projects") or []
	certifications = resume.get("certifications") or []
	skills = resume.get("skills") or []

	left_education = "".join(
		f"<div class=\"mini\"><strong>{html.escape(_safe(item.get('degree')))}</strong><br>{html.escape(_safe(item.get('institution')))}<br>{html.escape(_safe(item.get('start_year')))} - {html.escape(_safe(item.get('end_year')))}</div>"
		for item in education
	) or "<div class=\"mini\">-</div>"

	left_certs = "".join(
		f"<li>{html.escape(_safe(item.get('name')))}</li>"
		for item in certifications
	) or "<li>-</li>"

	right_experience = "".join(
		f"""
		<div class=\"item\">
		  <div class=\"item-head\">{html.escape(_safe(item.get('role')))} — {html.escape(_safe(item.get('company')))}</div>
		  <div class=\"item-sub\">{html.escape(_safe(item.get('duration')))}</div>
		  <ul>{_list_html(item.get('points') or [])}</ul>
		</div>
		"""
		for item in experience
	) or "<div class=\"item\">-</div>"

	right_projects = "".join(
		f"""
		<div class=\"item\">
		  <div class=\"item-head\">{html.escape(_safe(item.get('project_name')))}</div>
		  <div>{html.escape(_safe(item.get('description')))}</div>
		  <div class=\"item-sub\">{html.escape(_safe(item.get('project_link')))}</div>
		</div>
		"""
		for item in projects
	) or "<div class=\"item\">-</div>"

	return f"""
<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>{html.escape(_safe(basic.get('name'), 'Resume'))}</title>
  <style>
    body {{ margin: 0; background: #f3f4f6; font-family: 'Palatino Linotype', Palatino, serif; color: #111827; }}
    .sheet {{ max-width: 950px; margin: 18px auto; background: #fff; border: 1px solid #d1d5db; }}
    .header {{ padding: 22px 28px; border-bottom: 1px solid #d1d5db; }}
    .header h1 {{ margin: 0; font-size: 30px; }}
    .meta {{ color: #374151; font-size: 13px; margin-top: 6px; }}
    .content {{ display: grid; grid-template-columns: 280px 1fr; }}
    .left {{ border-right: 1px solid #e5e7eb; padding: 18px 16px 20px 20px; background: #fafafa; }}
    .right {{ padding: 18px 22px 24px; }}
    h2 {{ font-size: 14px; text-transform: uppercase; margin: 0 0 8px; letter-spacing: 0.8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }}
    .section {{ margin-bottom: 14px; }}
    .mini {{ font-size: 13px; margin-bottom: 8px; color: #374151; }}
    .item {{ margin-bottom: 10px; font-size: 14px; }}
    .item-head {{ font-weight: 700; }}
    .item-sub {{ color: #4b5563; font-size: 13px; }}
    ul {{ margin: 6px 0 0 18px; padding: 0; }}
    li {{ margin-bottom: 4px; }}
    .fit {{ padding: 8px 10px; border: 1px solid #d1d5db; background: #f9fafb; font-size: 13px; }}
    @media print {{ .sheet {{ margin: 0; border: none; }} body {{ background: #fff; }} }}
  </style>
</head>
<body>
  <div class=\"sheet\">
    <div class=\"header\">
      <h1>{html.escape(_safe(basic.get('name'), 'Candidate Name'))}</h1>
      <div class=\"meta\">{html.escape(_safe(basic.get('email')))} • {html.escape(_safe(basic.get('phone')))} • {html.escape(_safe(basic.get('location')))}</div>
      <div class=\"meta\">Role: {html.escape(_safe(basic.get('target_role'), _safe(job.get('title'))))} @ {html.escape(_safe(job.get('company')))}</div>
    </div>

    <div class=\"content\">
      <aside class=\"left\">
        <div class=\"section\"><h2>Summary</h2><div class=\"mini\">{html.escape(_safe(resume.get('professional_summary')))}</div></div>
        <div class=\"section\"><h2>Skills</h2><ul>{_list_html(skills)}</ul></div>
        <div class=\"section\"><h2>Education</h2>{left_education}</div>
        <div class=\"section\"><h2>Certifications</h2><ul>{left_certs}</ul></div>
      </aside>

      <main class=\"right\">
        <div class=\"section\"><h2>Experience</h2>{right_experience}</div>
        <div class=\"section\"><h2>Projects</h2>{right_projects}</div>
        <div class=\"section\"><h2>Role Fit</h2><div class=\"fit\">{html.escape(_safe(resume.get('fit_note')))}</div></div>
      </main>
    </div>
  </div>
</body>
</html>
"""


def _json_for_prompt(data: dict | list | None) -> str:
	if data is None:
		return "{}"
	try:
		return json.dumps(data, ensure_ascii=False, default=str)
	except Exception:
		return str(data)


@router.get("/")
def get_jobs():
	try:
		response = (
			supabase
			.table("jobs")
			.select("*")
			.execute()
		)
		return response.data
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-apply")
def quick_apply(payload: QuickApplyPayload, request: Request):
	user_id = request.cookies.get("user_id")
	if not user_id:
		raise HTTPException(status_code=401, detail="User not logged in")

	try:
		job_resp = (
			supabase
			.table("jobs")
			.select("id")
			.eq("id", payload.job_id)
			.limit(1)
			.execute()
		)

		if not job_resp.data:
			raise HTTPException(status_code=404, detail="Job not found")

		register_quick_apply(int(user_id), int(payload.job_id))
		return {"success": True, "job_id": int(payload.job_id)}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.post("/build-resume")
def build_job_resume(payload: JobResumePayload, request: Request):
	user_id = request.cookies.get("user_id")
	if not user_id:
		raise HTTPException(status_code=401, detail="User not logged in")

	api_key = os.getenv("RESUME_API") or os.getenv("GOOGLE_API_KEY")
	if not api_key:
		raise HTTPException(status_code=500, detail="Resume model API key is not configured")

	try:
		job_resp = (
			supabase
			.table("jobs")
			.select("*")
			.eq("id", payload.job_id)
			.limit(1)
			.execute()
		)
		if not job_resp.data:
			raise HTTPException(status_code=404, detail="Job not found")
		job = job_resp.data[0]

		profile_resp = supabase.rpc(
			"get_full_candidate_profile",
			{"p_user_id": int(user_id)}
		).execute()
		if not profile_resp.data:
			raise HTTPException(status_code=404, detail="Candidate profile not found")

		profile = profile_resp.data[0] if isinstance(profile_resp.data, list) else profile_resp.data

		model = ChatGoogleGenerativeAI(
			model="gemini-2.5-flash",
			temperature=0.1,
			google_api_key=api_key,
		)
		structured_model = model.with_structured_output(TailoredResumeOutput)

		prompt = f"""
You are an expert ATS resume writer.
Create a truthful, job-targeted resume using ONLY the candidate profile data and job data.

Hard rules:
1) Never invent companies, dates, degrees, links, or achievements.
2) If data is missing, keep fields empty or use concise neutral phrasing.
3) Include ONLY skills that are explicitly required/preferred in the job description or are directly transferable to those requirements.
4) Exclude noisy, generic, or unrelated skills that do not improve fit for this specific role.
5) In the `skills` field, keep a focused ATS-friendly list (max 12 items) ordered by job relevance.
6) Tailor summary, experience points, and project descriptions to highlight only role-relevant evidence from candidate data.
7) Do not mention missing skills as if the candidate has them.
8) Set `feasible` to false when candidate profile/domain is clearly opposite or largely mismatched for the role and ATS edge is poor.
9) If `feasible` is false, set `feasibility_reason` to a short direct warning explaining mismatch.
10) If `feasible` is true, set `feasibility_reason` to a short positive fit reason.
11) Output must strictly follow the provided schema.

JOB DATA:
{_json_for_prompt(job)}

CANDIDATE PROFILE DATA:
{_json_for_prompt(profile)}
"""

		result = structured_model.invoke([HumanMessage(content=prompt)])
		resume_data = result.model_dump()

		template_a = _render_classic_elegant(resume_data, job)
		template_b = _render_classic_split(resume_data, job)

		candidate_name = _safe((resume_data.get("basic") or {}).get("name"), "candidate").lower().replace(" ", "_")
		job_title = _safe(job.get("title"), "job").lower().replace(" ", "_")
		base_name = f"{candidate_name}_{job_title}_resume"

		return {
			"success": True,
			"job_id": payload.job_id,
			"job": {
				"title": job.get("title"),
				"company": job.get("company"),
				"location": job.get("location"),
			},
			"resume": resume_data,
			"templates": {
				"classic_elegant": {
					"label": "Classic Elegant",
					"filename": f"{base_name}_classic_elegant.html",
					"html": template_a,
				},
				"classic_split": {
					"label": "Classic Split",
					"filename": f"{base_name}_classic_split.html",
					"html": template_b,
				},
			},
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
