from supabase import create_client, Client
import os
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
try:
 supabase: Client = create_client(supabase_url, supabase_key)
except Exception as e:
    print("Error creating Supabase client:", e)