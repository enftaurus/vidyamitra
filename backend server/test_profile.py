import httpx
print("Testing profile..")
cookies = {"user_id": "1"} # Let's try user 1
r = httpx.get("http://localhost:8000/profile", cookies=cookies)
print(r.status_code)
print(r.text[:500])
