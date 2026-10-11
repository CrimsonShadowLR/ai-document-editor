from .bootstrap import app
from .routers.models_router import router as models_router
from .routers.suggestions_router import router as suggestions_router
from .routers.usage_router import router as usage_router

app.include_router(models_router)
app.include_router(suggestions_router)
app.include_router(usage_router)
