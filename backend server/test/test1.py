from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import time

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def fake_stream():

    text = "This is a streaming response from the backend. It is being sent chunk by chunk so the frontend does not wait."

    for word in text.split():
        yield word + " "
        time.sleep(0.2)   # simulate delay

@app.get("/stream")
def stream():
    return StreamingResponse(fake_stream(), media_type="text/plain")