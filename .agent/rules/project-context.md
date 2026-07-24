# Project Context and Architecture Rules

## 1. Tech Stack
- **Backend:** Node.js (REST API architecture)
- **Frontend:** React (Integrated with Gravity UI component library)
- **Database:** Microsoft SQL Server (MS SQL)

## 2. Current Project State (Completed Modules)
The following core building blocks are successfully set up and operational:
- **Authentication & Authorization:** 
  - Login / Register flows are fully implemented.
  - Role-Based Access Control (RBAC) mechanism is active.
- **Data Management:** 
  - Basic CRUD (Create, Read, Update, Delete) operations are written and connected to the database.

## 3. Future Development Goals (Priority Tasks)
The primary focus areas for the AI agent are:

1. **Home Page:**
   - Design and build the main landing/welcome page layout and routing architecture.
2. **Frontend Enhancements:**
   - Develop new UI components aligned with the Gravity UI design system.
   - Refine existing screens for better User Experience (UX) and visual consistency.
3. **Finance Page Module:**
   - Implement UI and API integrations for fetching, displaying, and managing financial data.
   - Develop data analysis and reporting interfaces.

## 4. Guidelines for the AI Agent
- **Component Standards:** Prioritize native Gravity UI components and design patterns for all frontend tasks.
- **Security & Authorization:** Ensure all new API endpoints and page routes maintain the existing **Role-Based** authorization logic with proper permission checks.
- **Database Compatibility:** Write all raw database queries compliant with MS SQL Server syntax (T-SQL).
- **Modularity:** Strictly maintain clean separation between the frontend (`frontend/`) and backend (`backend/`) layers; avoid tightly coupled or messy code.