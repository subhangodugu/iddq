import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.database.session import engine, Base, SessionLocal
from backend.app.database.models import Project, Dataset
from backend.app.api import projects, datasets, analyses, die, wafer, models, defects, stream

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    Base.metadata.create_all(bind=engine)
    
    # Initialize default project and auto-register sample datasets if present
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.id == 1).first()
        if not proj:
            proj = Project(
                id=1,
                name="Semiconductor IDDQ Optimization Benchmark",
                description="Production benchmark project with 12 lots, 60 wafers, and 32,400 die"
            )
            db.add(proj)
            db.commit()

        die_ds = db.query(Dataset).filter(Dataset.project_id == 1, Dataset.file_type == "die_data").first()
        if not die_ds:
            from backend.app.api.datasets import load_sample_datasets
            load_sample_datasets(1, db)
    except Exception as e:
        print(f"[Startup Warning] Could not auto-populate sample datasets: {e}")
    finally:
        db.close()
        
    prober_task = asyncio.create_task(stream.prober_loop())
    try:
        yield
    finally:
        prober_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise AI-assisted semiconductor IDDQ test-analysis and test-time optimization platform.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
app.include_router(datasets.router, prefix=settings.API_V1_PREFIX)
app.include_router(analyses.router, prefix=settings.API_V1_PREFIX)
app.include_router(die.router, prefix=settings.API_V1_PREFIX)
app.include_router(wafer.router, prefix=settings.API_V1_PREFIX)
app.include_router(models.router, prefix=settings.API_V1_PREFIX)
app.include_router(defects.router, prefix=settings.API_V1_PREFIX)
app.include_router(stream.router, prefix=settings.API_V1_PREFIX)

@app.get("/api/health", tags=["health"])
def health_check():
    db = SessionLocal()
    try:
        ds_count = db.query(Dataset).count()
        proj_count = db.query(Project).count()
        db_ok = True
    except Exception:
        ds_count, proj_count, db_ok = 0, 0, False
    finally:
        db.close()
        
    return {
        "status": "healthy" if db_ok else "degraded",
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database_connected": db_ok,
        "projects_count": proj_count,
        "valid_datasets_count": ds_count
    }
