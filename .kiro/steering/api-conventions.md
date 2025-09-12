---
inclusion: fileMatch
fileMatchPattern: ['app/**/*.py', 'pump-api/**/*.py']
---

# API Conventions & Backend Patterns

## FastAPI Router Organization

### Router Structure
Each feature area should have its own router module following this pattern:

```python
# app/routers/feature.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List

from ..db import get_session
from ..models.feature import Model
from ..schemas.feature import CreateSchema, ReadSchema, DetailSchema

router = APIRouter(prefix="/feature", tags=["feature"])

@router.post("/", response_model=ReadSchema, status_code=status.HTTP_201_CREATED)
async def create_item(item: CreateSchema, session: Session = Depends(get_session)):
    # Implementation
    pass

@router.get("/", response_model=List[ReadSchema])
async def list_items(session: Session = Depends(get_session)):
    # Implementation
    pass

@router.get("/{item_id}", response_model=DetailSchema)
async def get_item(item_id: UUID, session: Session = Depends(get_session)):
    # Implementation
    pass
```

### Router Registration
Register routers in [main.py](mdc:pump-api/app/main.py):

```python
from .routers import runs, verify, live_streams

app.include_router(runs.router)
app.include_router(verify.router)
app.include_router(live_streams.router)
```

## HTTP Status Codes

Use appropriate HTTP status codes:

- **200 OK**: Successful GET, PUT, PATCH operations
- **201 Created**: Successful POST operations that create resources
- **204 No Content**: Successful DELETE operations
- **400 Bad Request**: Client error in request format
- **404 Not Found**: Resource does not exist
- **413 Payload Too Large**: Request exceeds size limits (e.g., MAX_NONCES)
- **422 Unprocessable Entity**: Validation errors (FastAPI default for Pydantic validation)
- **429 Too Many Requests**: Rate limiting (live streams ingestion)
- **500 Internal Server Error**: Unexpected server errors

## Error Response Format

Standardize error responses:

```python
from fastapi import HTTPException, status

# Validation error
raise HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail="Invalid difficulty. Must be one of: easy, medium, hard, expert"
)

# Resource not found
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=f"Run with id {run_id} not found"
)

# Business logic error
raise HTTPException(
    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    detail=f"Nonce range {end - start + 1} exceeds maximum of {MAX_NONCES}"
)
```

## Pagination Patterns

Use consistent pagination for list endpoints:

```python
from typing import Optional

@router.get("/items", response_model=ItemListResponse)
async def list_items(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session)
):
    # Get total count
    count_stmt = select(func.count(Item.id))
    total = await session.exec(count_stmt).one()

    # Get paginated results
    stmt = select(Item).offset(offset).limit(limit)
    items = await session.exec(stmt).all()

    return ItemListResponse(
        items=[ItemRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset
    )
```

## Database Session Management

Always use dependency injection for database sessions:

```python
from sqlmodel import Session
from ..db import get_session

async def endpoint_function(session: Session = Depends(get_session)):
    # Use session for database operations
    # Session is automatically managed (opened/closed)
    pass
```

## Query Patterns

### Simple Queries
```python
# Single item by ID
stmt = select(Model).where(Model.id == item_id)
item = await session.exec(stmt).first()
if not item:
    raise HTTPException(status_code=404, detail="Item not found")
```

### Complex Queries with Joins
```python
# Join with related tables
stmt = (
    select(Model, RelatedModel)
    .join(RelatedModel)
    .where(Model.id == item_id)
)
result = await session.exec(stmt).first()
```

### Aggregation Queries
```python
# Count and statistics
stmt = select(
    func.count(Model.id).label("total"),
    func.max(Model.value).label("max_value"),
    func.avg(Model.value).label("avg_value")
).where(Model.active == True)
stats = await session.exec(stmt).first()
```

## Request/Response Validation

### Input Validation
Use Pydantic field validators for complex validation:

```python
from pydantic import field_validator, Field

class CreateRequest(BaseModel):
    difficulty: str = Field(..., description="Difficulty level")
    targets: List[float] = Field(..., min_length=1, description="Target multipliers")

    @field_validator('difficulty')
    @classmethod
    def validate_difficulty(cls, v):
        allowed = {'easy', 'medium', 'hard', 'expert'}
        if v not in allowed:
            raise ValueError(f'difficulty must be one of: {", ".join(allowed)}')
        return v

    @field_validator('targets')
    @classmethod
    def validate_targets(cls, v):
        if not v:
            raise ValueError('targets cannot be empty')
        if any(t <= 0 for t in v):
            raise ValueError('all targets must be positive')
        return v
```

### Response Models
Create separate schemas for different response contexts:

```python
# Minimal schema for lists
class ItemSummary(BaseModel):
    id: UUID
    name: str
    created_at: datetime

# Detailed schema for single item views
class ItemDetail(BaseModel):
    id: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    related_items: List[RelatedItem]
```

## Authentication & Security

### Token Validation
For live streams ingestion:

```python
from fastapi import Header, HTTPException, status

async def validate_ingest_token(x_ingest_token: str = Header(...)):
    settings = get_settings()
    if x_ingest_token != settings.ingest_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ingest token"
        )
    return x_ingest_token
```

### Rate Limiting
Apply rate limiting to sensitive endpoints:

```python
from ..core.rate_limiter import get_rate_limiter

@router.post("/ingest")
async def ingest_bet(
    request: IngestBetRequest,
    session: Session = Depends(get_session),
    token: str = Depends(validate_ingest_token)
):
    # Apply rate limiting
    rate_limiter = get_rate_limiter(settings.ingest_rate_limit)
    client_id = request.antebot_bet_id  # Use bet ID as client identifier

    if not rate_limiter.is_allowed(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded"
        )
```

## Async Patterns

### Database Operations
All database operations should be async:

```python
# Correct - async operations
async def get_items(session: AsyncSession):
    stmt = select(Item)
    result = await session.exec(stmt)
    return result.all()

# Incorrect - blocking operations
def get_items_sync(session: Session):
    stmt = select(Item)
    result = session.exec(stmt)  # Blocks event loop
    return result.all()
```

### Error Handling in Async Context
```python
async def risky_operation():
    try:
        result = await some_async_call()
        return result
    except SpecificException as e:
        logger.error(f"Specific error occurred: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error in risky_operation")
        raise HTTPException(status_code=500, detail="Internal server error")
```

## Performance Considerations

### Efficient Queries
- Use `select()` with specific columns when full objects aren't needed
- Apply `limit()` and `offset()` for pagination
- Use `join()` instead of multiple queries when fetching related data
- Consider indexing for frequently queried columns

### Memory Management
- Process large datasets in batches
- Use streaming responses for large exports
- Avoid loading entire result sets into memory

### Caching
- Cache static configuration data
- Use appropriate cache headers for API responses
- Consider in-memory caching for frequently accessed, rarely changed data

## Testing Patterns

### Router Testing
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_item(client: AsyncClient):
    payload = {"name": "test", "value": 123}
    response = await client.post("/items", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test"
    assert "id" in data
```

### Database Testing
```python
@pytest.mark.asyncio
async def test_database_operation(session: AsyncSession):
    # Create test data
    item = Item(name="test", value=123)
    session.add(item)
    await session.commit()
    await session.refresh(item)

    # Test query
    stmt = select(Item).where(Item.name == "test")
    result = await session.exec(stmt).first()

    assert result is not None
    assert result.value == 123
```

These patterns ensure consistency, maintainability, and performance across the FastAPI backend while following modern async Python practices.
