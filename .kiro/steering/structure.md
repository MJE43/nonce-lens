# Project Structure & Organization

## Repository Layout

```
pump-analyzer/
├── pump-api/                 # FastAPI backend application
├── pump-frontend/            # React frontend application
├── docs/                     # Project documentation
├── .kiro/                    # Kiro AI assistant configuration
└── README.md                 # Project overview
```

## Backend Structure (pump-api/)

```
pump-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── db.py                # Database connection and setup
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # Settings and configuration
│   ├── engine/
│   │   ├── __init__.py
│   │   └── pump.py          # Core Pump analysis algorithms
│   ├── models/
│   │   ├── __init__.py
│   │   ├── runs.py          # SQLModel definitions for runs/hits
│   │   └── live_streams.py  # SQLModel definitions for live streams
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── runs.py          # Run analysis endpoints
│   │   ├── verify.py        # Single nonce verification
│   │   └── live_streams.py  # Live stream ingestion/query endpoints
│   └── schemas/
│       ├── __init__.py
│       ├── runs.py          # Pydantic request/response models
│       └── live_streams.py  # Live stream API schemas
├── tests/
│   ├── test_pump_engine.py  # Engine algorithm tests
│   ├── test_api_e2e.py      # End-to-end API tests
│   └── test_live_streams.py # Live streams functionality tests
├── .env                     # Environment configuration
├── .env.example             # Environment template
├── requirements.txt         # Python dependencies
├── pytest.ini              # Test configuration
└── pump.db                  # SQLite database file
```

## Frontend Structure (pump-frontend/)

```
pump-frontend/
├── src/
│   ├── main.tsx             # Application entry point
│   ├── App.tsx              # Root component with routing
│   ├── index.css            # Global styles and Tailwind imports
│   ├── lib/
│   │   ├── api.ts           # API client configuration
│   │   └── utils.ts         # Utility functions
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components (header, nav)
│   │   └── shared/          # Reusable business components
│   ├── pages/
│   │   ├── RunsList.tsx     # Runs listing page
│   │   ├── NewRun.tsx       # Create new run page
│   │   ├── RunDetail.tsx    # Run details and results
│   │   ├── LiveStreamsList.tsx    # Live streams listing
│   │   └── LiveStreamDetail.tsx   # Stream detail and monitoring
│   ├── hooks/
│   │   ├── useRuns.ts       # Run management hooks
│   │   ├── useLiveStreams.ts      # Live streams hooks
│   │   └── useStreamTail.ts       # Real-time updates hook
│   └── types/
│       ├── api.ts           # API response type definitions
│       └── index.ts         # Shared type definitions
├── public/                  # Static assets
├── dist/                    # Build output directory
├── node_modules/            # Dependencies
├── .env.example             # Environment template
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── components.json          # shadcn/ui configuration
```

## Key Architectural Patterns

### Backend Organization

**Router-Based Feature Modules**
- Each major feature area has its own router (runs, verify, live_streams)
- Routers are imported and included in main.py
- Clear separation between different API concerns

**Layered Architecture**
- **Models**: SQLModel classes for database schema
- **Schemas**: Pydantic models for API validation
- **Routers**: FastAPI endpoints and request handling
- **Engine**: Core business logic and algorithms

**Database Layer**
- Single db.py file manages connection and table creation
- Models define relationships and constraints
- Async database operations throughout

### Frontend Organization

**Page-Based Routing**
- Each major view is a separate page component
- Pages handle route-level logic and data fetching
- Clear navigation structure between features

**Component Hierarchy**
- **Pages**: Route-level components with data fetching
- **Components**: Reusable UI and business logic components
- **UI**: Low-level design system components (shadcn/ui)
- **Hooks**: Custom logic for data management and side effects

**Type Safety**
- Shared type definitions in types/ directory
- API types mirror backend Pydantic schemas
- End-to-end type safety from database to UI

## File Naming Conventions

### Backend (Python)
- **snake_case** for all Python files and directories
- **PascalCase** for SQLModel and Pydantic class names
- **UPPER_CASE** for constants and environment variables
- Test files prefixed with `test_`

### Frontend (TypeScript/React)
- **PascalCase** for React components and pages
- **camelCase** for hooks, utilities, and variables
- **kebab-case** for CSS classes and file assets
- **UPPER_CASE** for environment variables

## Import Patterns

### Backend Imports
```python
# Relative imports within app
from .models.runs import Run, Hit
from .schemas.runs import RunCreate, RunDetail
from .engine.pump import scan_pump, ENGINE_VERSION

# External dependencies
from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, select
```

### Frontend Imports
```typescript
// React and external libraries
import React from 'react'
import { useQuery } from '@tanstack/react-query'

// Internal imports with @ alias
import { Button } from '@/components/ui/button'
import { useRuns } from '@/hooks/useRuns'
import type { RunDetail } from '@/types/api'
```

## Configuration Management

### Environment Variables
- Backend: `.env` file with DATABASE_URL, CORS settings, tokens
- Frontend: `.env` file with VITE_API_BASE for API endpoint
- Both include `.env.example` templates for setup

### Build Configuration
- Backend: `requirements.txt` for dependencies, `pytest.ini` for testing
- Frontend: `package.json` scripts, `vite.config.ts` for build settings
- TypeScript: Strict mode enabled with path aliases

## Data Flow Patterns

### Request Flow
1. Frontend makes API request via TanStack Query
2. FastAPI router receives and validates request
3. Business logic in engine/ or direct database operations
4. Response formatted via Pydantic schemas
5. Frontend updates UI with returned data

### Real-time Updates
1. Frontend polls `/tail` endpoints with since_id parameter
2. Backend returns incremental updates since last poll
3. Frontend merges new data with existing state
4. UI updates automatically via React state changes

This structure supports the local-first, single-user architecture while maintaining clear separation of concerns and enabling future enhancements like the live streams feature.