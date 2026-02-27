import google.generativeai as genai

# 🔴 Hardcoded API key (ONLY for local testing)
genai.configure(api_key="AIzaSyCd1ibHRGkRn86DpNEMnr3mH1VoUTCmh7M")

# Load model
model = genai.GenerativeModel("gemini-2.5-flash-lite")

# Generate response
response = model.generate_content("Explain FastAPI in simple terms.")

print(response.text)