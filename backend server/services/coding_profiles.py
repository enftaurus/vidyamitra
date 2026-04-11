"""
Coding profile fetchers for LeetCode, Codeforces, and GitHub.

Design goals:
- production-safe: never raise to callers; return None for platform failures
- reusable: provide extraction helpers for URL/handle parsing
- useful for AI: include structured metrics for prompt enrichment
"""

import hashlib
import os
import random
import re
import string
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import requests


CF_API_KEY = os.getenv("CF_API") 
CF_SECRET = os.getenv("CF_SECRET") 
GH_TOKEN = os.getenv("GITHUB_TOKEN", "")

REQUEST_TIMEOUT = 15
HEADERS = {"User-Agent": "VidyaMitra-CareerPlatform/1.0"}

LEETCODE_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?leetcode\.com/(?:u/|profile/)?([A-Za-z0-9_-]{1,64})(?:/|$)",
    re.IGNORECASE,
)
CODEFORCES_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?codeforces\.com/(?:profile/)?([A-Za-z0-9_.-]{1,64})(?:/|$)",
    re.IGNORECASE,
)
GITHUB_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9-]{1,39})(?:/|$)",
    re.IGNORECASE,
)


LC_STATS_QUERY = """
query getUserStats($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
  }
  userContestRanking(username: $username) {
    rating
    attendedContestsCount
  }
}
"""


LC_STREAK_QUERY = """
query getUserCalendar($username: String!) {
  matchedUser(username: $username) {
    userCalendar {
      streak
    }
  }
}
"""


def _normalize_handle(value: str, url_pattern: re.Pattern[str], max_len: int) -> str:
    if not value:
        return ""

    value = value.strip()
    url_match = url_pattern.search(value)
    if url_match:
        return url_match.group(1)

    value = value.lstrip("@").strip().strip("/")
    if "/" in value:
        value = value.split("/")[0]

    value = re.sub(r"[^A-Za-z0-9_.-]", "", value)
    return value[:max_len]


def _extract_handle_from_text(text: str, url_pattern: re.Pattern[str]) -> str:
    if not text:
        return ""
    match = url_pattern.search(text)
    return match.group(1) if match else ""


def extract_platform_handles(
    leetcode_username: str = "",
    codeforces_handle: str = "",
    github_username: str = "",
    text: str = "",
) -> dict[str, str]:
    """
    Normalize explicit platform inputs and optionally auto-detect handles from text.
    Priority: explicit input > regex extraction from text.
    """
    lc = _normalize_handle(leetcode_username, LEETCODE_URL_RE, max_len=64) or _extract_handle_from_text(
        text, LEETCODE_URL_RE
    )
    cf = _normalize_handle(codeforces_handle, CODEFORCES_URL_RE, max_len=64) or _extract_handle_from_text(
        text, CODEFORCES_URL_RE
    )
    gh = _normalize_handle(github_username, GITHUB_URL_RE, max_len=39) or _extract_handle_from_text(
        text, GITHUB_URL_RE
    )
    return {"leetcode": lc, "codeforces": cf, "github": gh}


def _post_leetcode_graphql(query: str, username: str) -> Optional[dict[str, Any]]:
    try:
        response = requests.post(
            "https://leetcode.com/graphql",
            json={"query": query, "variables": {"username": username}},
            headers={
                **HEADERS,
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com",
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("errors"):
            return None
        return payload.get("data") or {}
    except Exception:
        return None


def get_leetcode_stats(username: str) -> Optional[dict]:
    """
    Fetch LeetCode stats using GraphQL.
    Returns None when user is not found or API fails.
    """
    username = _normalize_handle(username, LEETCODE_URL_RE, max_len=64)
    if not username:
        return None

    stats_data = _post_leetcode_graphql(LC_STATS_QUERY, username)
    if not stats_data:
        return None

    user = stats_data.get("matchedUser")
    if not user:
        return None

    counts = {"all": 0, "easy": 0, "medium": 0, "hard": 0}
    submission_stats = {
        "all": {"accepted": 0, "submissions": 0},
        "easy": {"accepted": 0, "submissions": 0},
        "medium": {"accepted": 0, "submissions": 0},
        "hard": {"accepted": 0, "submissions": 0},
    }

    for item in user.get("submitStatsGlobal", {}).get("acSubmissionNum", []):
        difficulty = str(item.get("difficulty", "")).lower()
        if difficulty not in counts:
            continue
        accepted_count = int(item.get("count") or 0)
        submitted_count = int(item.get("submissions") or 0)
        counts[difficulty] = accepted_count
        submission_stats[difficulty] = {
            "accepted": accepted_count,
            "submissions": submitted_count,
        }

    contest = stats_data.get("userContestRanking") or {}
    contest_rating = contest.get("rating")

    result = {
        "username": username,
        "total_solved": counts["all"],
        "easy": counts["easy"],
        "medium": counts["medium"],
        "hard": counts["hard"],
        "contest_rating": round(contest_rating) if isinstance(contest_rating, (int, float)) else None,
        "submission_stats": submission_stats,
        "streak_days": None,
    }

    streak_data = _post_leetcode_graphql(LC_STREAK_QUERY, username)
    if streak_data:
        streak = (streak_data.get("matchedUser") or {}).get("userCalendar", {}).get("streak")
        if isinstance(streak, int):
            result["streak_days"] = streak

    return result


def _cf_signed_params(method: str, params: dict[str, Any], api_key: str, secret: str) -> dict[str, Any]:
    signed = dict(params)
    signed["apiKey"] = api_key
    signed["time"] = str(int(time.time()))

    random_prefix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    sorted_query = "&".join(f"{k}={signed[k]}" for k in sorted(signed))
    sign_source = f"{random_prefix}/{method}?{sorted_query}#{secret}"
    signature = hashlib.sha512(sign_source.encode("utf-8")).hexdigest()
    signed["apiSig"] = f"{random_prefix}{signature}"
    return signed


def _cf_call(method: str, params: dict[str, Any], api_key: str, secret: str) -> Optional[Any]:
    unsigned_params = dict(params)
    attempts: list[dict[str, Any]] = []

    # Try signed first when credentials are provided, then always fall back to unsigned.
    if api_key and secret:
        attempts.append(_cf_signed_params(method, unsigned_params, api_key, secret))
    attempts.append(unsigned_params)

    for query_params in attempts:
        try:
            response = requests.get(
                f"https://codeforces.com/api/{method}",
                params=query_params,
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()

            payload = response.json()
            if payload.get("status") == "OK":
                return payload.get("result")
        except Exception:
            continue

    return None


def get_codeforces_stats(
    handle: str,
    api_key: str = CF_API_KEY,
    secret: str = CF_SECRET,
) -> Optional[dict]:
    """
    Fetch Codeforces rating details and contest participation.
    Returns None when user is not found or API fails.
    """
    handle = _normalize_handle(handle, CODEFORCES_URL_RE, max_len=64)
    if not handle:
        return None

    info_result = _cf_call("user.info", {"handles": handle}, api_key, secret)
    if not info_result or not isinstance(info_result, list):
        return None

    user = info_result[0]
    rating_result = _cf_call("user.rating", {"handle": handle}, api_key, secret)
    contests = rating_result if isinstance(rating_result, list) else []

    status_result = _cf_call(
        "user.status",
        {"handle": handle, "from": 1, "count": 1000},
        api_key,
        secret,
    )
    submissions = status_result if isinstance(status_result, list) else []

    solved_problems: set[str] = set()
    for sub in submissions:
        if sub.get("verdict") != "OK":
            continue
        problem = sub.get("problem") or {}
        contest_id = problem.get("contestId")
        index = problem.get("index")
        if contest_id is not None and index:
            solved_problems.add(f"{contest_id}-{index}")
            continue
        name = problem.get("name")
        if isinstance(name, str) and name.strip():
            solved_problems.add(name.strip())

    ranked_positions = [
        int(c.get("rank"))
        for c in contests
        if isinstance(c, dict) and isinstance(c.get("rank"), int)
    ]
    best_rank = min(ranked_positions) if ranked_positions else None

    display_name = " ".join(
        [part for part in [user.get("firstName"), user.get("lastName")] if isinstance(part, str) and part.strip()]
    ).strip()

    return {
        "handle": handle,
        "name": display_name,
        "rating": int(user.get("rating") or 0),
        "max_rating": int(user.get("maxRating") or 0),
        "rank": user.get("rank") or "unrated",
        "max_rank": user.get("maxRank") or "unrated",
        "contribution": int(user.get("contribution") or 0),
        "friends": int(user.get("friendOfCount") or 0),
        "organization": user.get("organization") or None,
        "contests": len(contests),
        "contests_participated": len(contests),
        "best_rank": best_rank,
        "total_submissions": len(submissions),
        "problems_solved": len(solved_problems),
    }


def get_github_stats(username: str) -> Optional[dict]:
    """
    Fetch GitHub public profile stats with repository/language breakdown.
    Returns None when user is not found or API fails.
    """
    username = _normalize_handle(username, GITHUB_URL_RE, max_len=39)
    if not username:
        return None

    headers = {**HEADERS, "Accept": "application/vnd.github+json"}
    if GH_TOKEN:
        headers["Authorization"] = f"Bearer {GH_TOKEN}"

    try:
        user_response = requests.get(
            f"https://api.github.com/users/{username}",
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        if user_response.status_code == 404:
            return None
        user_response.raise_for_status()
        user_data = user_response.json()

        repos_response = requests.get(
            f"https://api.github.com/users/{username}/repos",
            params={"per_page": 100, "sort": "updated"},
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        repos = repos_response.json() if repos_response.status_code == 200 else []
        if not isinstance(repos, list):
            repos = []

        language_breakdown: dict[str, int] = {}
        total_stars = 0
        for repo in repos:
            language = repo.get("language")
            if language:
                language_breakdown[language] = language_breakdown.get(language, 0) + 1
            total_stars += int(repo.get("stargazers_count") or 0)

        sorted_languages = sorted(
            language_breakdown.items(), key=lambda item: item[1], reverse=True
        )

        return {
            "username": username,
            "repo_count": int(user_data.get("public_repos") or 0),
            "language_breakdown": [
                {"language": language, "repos": count} for language, count in sorted_languages
            ],
            "top_languages": [language for language, _ in sorted_languages[:8]],
            "followers": int(user_data.get("followers") or 0),
            "following": int(user_data.get("following") or 0),
            "total_stars": total_stars,
        }
    except Exception:
        return None


def fetch_all_coding_profiles(
    leetcode_username: str = "",
    codeforces_handle: str = "",
    github_username: str = "",
    source_text: str = "",
) -> dict:
    """
    Fetch all available coding profiles concurrently.
    If an account is missing or a platform fails, that platform returns None.
    """
    handles = extract_platform_handles(
        leetcode_username=leetcode_username,
        codeforces_handle=codeforces_handle,
        github_username=github_username,
        text=source_text,
    )

    results = {"leetcode": None, "codeforces": None, "github": None}
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {}
        if handles["leetcode"]:
            futures["leetcode"] = executor.submit(get_leetcode_stats, handles["leetcode"])
        if handles["codeforces"]:
            futures["codeforces"] = executor.submit(
                get_codeforces_stats,
                handles["codeforces"],
                CF_API_KEY,
                CF_SECRET,
            )
        if handles["github"]:
            futures["github"] = executor.submit(get_github_stats, handles["github"])

        for platform, future in futures.items():
            try:
                results[platform] = future.result(timeout=REQUEST_TIMEOUT + 5)
            except Exception:
                results[platform] = None

    return results


def format_coding_profiles_for_prompt(profiles: dict) -> str:
    """Render coding profile data into prompt context for resume analysis."""
    if not profiles or not any(profiles.values()):
        return ""

    lines = [
        "",
        "CODING PROFILE DATA (factor this into resume_score, skill_analysis, and suggested_projects):",
    ]

    leetcode = profiles.get("leetcode")
    if leetcode:
        lines.append(f"- LeetCode username: {leetcode.get('username')}")
        lines.append(
            "  solved: "
            f"total={leetcode.get('total_solved', 0)}, "
            f"easy={leetcode.get('easy', 0)}, "
            f"medium={leetcode.get('medium', 0)}, "
            f"hard={leetcode.get('hard', 0)}"
        )
        lines.append(
            "  contest_rating: "
            f"{leetcode.get('contest_rating')}"
            if leetcode.get("contest_rating") is not None
            else "  contest_rating: null"
        )
        if leetcode.get("streak_days") is not None:
            lines.append(f"  streak_days: {leetcode.get('streak_days')}")

    codeforces = profiles.get("codeforces")
    if codeforces:
        lines.append(f"- Codeforces handle: {codeforces.get('handle')}")
        lines.append(
            "  rating: "
            f"current={codeforces.get('rating', 0)}, "
            f"max={codeforces.get('max_rating', 0)}, "
            f"rank={codeforces.get('rank', 'unrated')}, "
            f"contests={codeforces.get('contests', 0)}"
        )
        lines.append(
            "  activity: "
            f"submissions={codeforces.get('total_submissions', 0)}, "
            f"solved={codeforces.get('problems_solved', 0)}, "
            f"best_rank={codeforces.get('best_rank')}"
        )

    github = profiles.get("github")
    if github:
        lines.append(f"- GitHub username: {github.get('username')}")
        lines.append(
            "  repos/languages: "
            f"repos={github.get('repo_count', 0)}, "
            f"top_languages={', '.join(github.get('top_languages', [])) or 'none'}"
        )

    lines.append("Use this data as evidence of DSA strength, competitive coding rigor, and practical project exposure.")
    return "\n".join(lines) + "\n"
