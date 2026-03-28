from fastapi import FastAPI

app = FastAPI(title="CaisseFlow Pro Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
