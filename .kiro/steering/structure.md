---
inclusion: always
---

# Project Structure & Code Organization

## Directory Structure Rules

**Backend (backend/)**
- Use `backend/` as root directory (not `pump-api/`)
- Follow layered architecture: `app/models/`, `app/routers/`, `app/schemas/`, `app/engine/`
- Place tests in `backend/tests/` with `test_` prefix
- Database file: `backend/pump.db` (SQLite)

**Frontend (frontend/)**
- Use `frontend/` as root directory (not `pump-frontend/`)
- Components in `src/components/` with feature-based subdirectories
- Pages in `src/pages/` for route-level components
- Custom hooks in `src/hooks/`
- API types in `src/types/`

## File Naming & Code Style

### Backend (Python)
- **snake_case** for files, functions, variables
- **PascalCase** for classes (SQLModel, Pydantic)
- **UPPER_CASE** for constants and env vars
- Relative imports: `from .models.runs import Run`
- Async/await throughout for database operations

### Frontend (TypeScript/React)
- **PascalCase** for components and pages
- **camelCase** for hooks, utilities, variables
- **kebab-case** for CSS classes
- Use `@/` alias for internal imports: `import { Button } from '@/components/ui/button'`
- Strict TypeScript with end-to-end type safety

## Architecture Patterns

### Backend Patterns
- **Router-based features**: Separate routers for runs, verify, live_streams
- **Dependency injection**: Use FastAPI's DI for database sessions
- **Layered separation**: Models (SQLModel) → Schemas (Pydantic) → Routers (FastAPI)
- **Single database file**: `db.py` handles connection and table creation

### Frontend Patterns
- **Page-based routing**: Pages handle data fetching, components handle UI
- **TanStack Query**: Use for all API calls with caching
- **Component composition**: Reusable UI components with clear props
- **Custom hooks**: Encapsulate data fetching and business logic

### Data Flow
- Frontend → TanStack Query → FastAPI Router → Business Logic → Database
- Real-time updates via `/tail` endpoints with `since_id` polling
- Type safety from database models to UI components

## Key Conventions

### API Design
- RESTful endpoints with clear resource naming
- Pydantic validation for all requests/responses
- Consistent error handling with HTTP status codes
- Rate limiting for ingestion endpoints

### Component Organization
- Feature-based component directories (e.g., `live-streams/`)
- Separate UI components from business logic
- Use shadcn/ui for base components
- Custom hooks for reusable logic

### Testing Strategy
- Backend: pytest with async support, test all layers
- Frontend: Vitest with React Testing Library
- Integration tests for critical workflows
- Test file naming: `test_*.py` or `*.test.ts`

### Environment Configuration
- Use `.env` files with `.env.example` templates
- Backend: DATABASE_URL, CORS_ORIGINS, INGEST_TOKEN
- Frontend: VITE_API_BASE for API endpoint
- Never commit actual `.env` files

## Development Workflow

### Adding New Features
1. Backend: Create model → schema → router → tests
2. Frontend: Create types → hooks → components → pages
3. Maintain type safety across the stack
4. Update both `.env.example` files if new config needed

### File Placement Rules
- New backend endpoints: `app/routers/`
- Database models: `app/models/`
- API schemas: `app/schemas/`
- Business logic: `app/engine/`
- Frontend components: `src/components/[feature]/`
- Reusable hooks: `src/hooks/`
- Type definitions: `src/types/`
