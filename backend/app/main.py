from fastapi import FastAPI

app = FastAPI(title="Morphe API")

@app.get("/")
def root():
    return {"status": "Morphe is alive"}
