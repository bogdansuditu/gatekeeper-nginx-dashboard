# Project Operational Rules

## Execution & Environment Constraint (STRICT)
- **DOCKER-ONLY RUNTIME:** The application, its backend services, database, frontend, workers, build steps, and tests must **ONLY run inside Docker containers**.
- **NO HOST OS EXECUTION:** Nothing will run directly on the user's host OS (no node, npm, python, pip, or direct dev servers running directly on the host machine). All execution and runtime must occur strictly within Docker containers or docker-compose services.
- **PORTABILITY:** The setup must rely solely on Docker and Docker Compose with clean volume mounts (`/data`) as specified in `PRD.md`.
