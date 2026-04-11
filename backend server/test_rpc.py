import asyncio
from services.db_client import supabase

def test_rpc():
    data = {
        "candidates": {
            "phone": "123",
            "bio": "bio",
            "resume_json": {},
            "domain_id": 1
        },
        "education": [],
        "projects": [],
        "skills": [
            {"skill_name": "Python"}
        ],
        "certificates": [
            {
                "certificate_name": "AWS",
                "certificate_issuer": "Amazon",
                "certificate_date": "2024-01-01"
            }
        ]
    }
    
    # Try inserting for user 999999
    try:
        res = supabase.rpc("upsert_full_resume", {"p_user_id": 999999, "data": data}).execute()
        print("Success:", res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_rpc()
