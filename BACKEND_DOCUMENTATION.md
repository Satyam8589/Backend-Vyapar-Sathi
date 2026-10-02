# 1. Backend Overview
The Backend-Vyapar-Sathi is the core API server for the VyaparSathi multi-store inventory and business management system. Built on Node.js and Express, it provides secure, RESTful endpoints for managing stores, inventory, users, sales, and purchases. It also serves as a proxy to seamlessly connect the frontend client with the AI Copilot service.

# 2. Backend Architecture
The backend follows a monolithic, modular architecture separated into distinct domains (modules). It acts as the primary gateway for the frontend, handling all business logic, database transactions, and proxying requests to the AI microservice.

# 3. Folder Structure
- `server.js` / `app.js`: Application entry point and Express server setup.
- `config/`: Configuration files (e.g., database connection, Cloudinary).
- `models/`: Mongoose schemas defining the data structure.
- `modules/` / `controllers/` & `routes/`: Grouped by domain (e.g., product, store, sale).
- `middleware/`: Custom middleware for authentication, error handling, and validation.
- `utils/`: Helper functions and standardized API response formats.

# 4. Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Authentication**: JSON Web Tokens (JWT) & bcrypt for password hashing
- **File Storage**: Cloudinary (via Multer for file uploads)
- **Proxy**: http-proxy-middleware (for AI service integration)

# 5. Database Structure & Models
- **User**: Stores credentials, profile info, and roles.
- **Store**: Details about business locations linked to a user.
- **Product**: Inventory items (SKU, price, stock, images).
- **Category / SubCategory**: Hierarchical product classification.
- **Buyer & Seller**: Contact and business info for customers and suppliers.
- **Purchase**: Tracks incoming stock and payments to sellers.
- **Sale**: Tracks outgoing stock and payments from buyers.
- **Payment / Expense**: Financial transactions and business expenses.
- **Cart**: Temporary storage for items being checked out.

## Relationships
- A `Store` has many `Products`, `Categories`, `Sales`, and `Purchases`.
- A `Sale` is linked to a `Store`, a `Buyer`, and multiple `Products`.
- A `Purchase` is linked to a `Store`, a `Seller`, and multiple `Products`.

# 6. Authentication & Authorization
- **Authentication**: Handled via JWT. Users log in and receive a token (usually stored in HTTP-only cookies or passed as a Bearer token).
- **Authorization**: Middleware checks the validity of the JWT and ensures the user has the correct roles/permissions to access specific store resources.

# 7. API Architecture & Endpoints
The REST API uses standard HTTP methods (GET, POST, PUT, DELETE).
- `/api/v1/auth`: Registration, login, logout.
- `/api/v1/stores`: Store management CRUD.
- `/api/v1/products`: Inventory CRUD operations.
- `/api/v1/purchases`: Record purchases and update stock.
- `/api/v1/sales`: Record sales and generate invoices.
- `/api/v1/analytics`: Profit/Loss and performance metrics.
- `/api/v1/copilot`: Proxies requests to the `vyaparSathi-ai-service`.

# 8. Business Logic Flows
- **Inventory Flow**: Adding a product initializes stock.
- **Purchase Flow**: Recording a `Purchase` automatically increases product stock.
- **Sales Flow**: Recording a `Sale` automatically decreases product stock.
- **Payment Flow**: Purchases and Sales calculate total amounts. Pre-save hooks in Mongoose determine payment statuses (e.g., 'paid', 'partial', 'unpaid') based on the amount paid versus the total invoice amount.
- **Profit & Loss Logic**: Aggregates data from Sales (revenue), Purchases (COGS), and Expenses to calculate net profit over a given timeframe.

# 9. AI-Service Communication
The backend utilizes `http-proxy-middleware` and custom HTTP request handlers to forward Copilot requests to the Python AI service. This includes standard JSON responses and Server-Sent Events (SSE) for streaming chat responses back to the frontend without buffering.

# 10. Security & Validation
- **Security**: Routes protected by JWT middleware. Passwords hashed with bcrypt. CORS enabled for frontend domains.
- **Validation**: Incoming requests are validated before hitting controllers (e.g., ensuring required fields are present).
- **Error Handling**: Centralized error handling middleware formats errors consistently.

# 11. Environment Variables
- `PORT`: Server port.
- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: Secret key for signing tokens.
- `CLOUDINARY_*`: Cloudinary API keys.
- `AI_SERVICE_URL`: URL of the Python AI service.
*(Note: Actual secrets are never exposed in the repository).*

# 12. Installation & Running
1. `cd Backend-Vyapar-Sathi`
2. `npm install`
3. Configure `.env` file.
4. `npm start` or `npm run dev`

# 13. Limitations & Future Scope
- **Limitations**: Currently relies heavily on the shared MongoDB instance for all operations.
- **Future Scope**:
  - Implement automated scheduled database backups.
  - Add granular role-based access control (RBAC).
  - Implement rate limiting for public-facing endpoints.
  - Add comprehensive automated testing (Unit/Integration).
