# 🏢 Vyapar Sathi – Backend Service

> **Enterprise-Ready Multi-Store Retail POS, Inventory & Business Management Engine**  
> Built with **Node.js, Express 5, MongoDB, Redis, BullMQ, WebSockets, and Firebase Admin**.

---

## 📖 Overview

**Backend-Vyapar-Sathi** is the core REST and real-time backend engine powering the **Vyapar Sathi** retail operating system. It provides complete multi-store data isolation, intelligent point-of-sale (POS) cart sessions, purchase orders, goods received notes (GRN), inventory tracking, role-based access control (RBAC), background worker processing, and an integrated reverse-proxy gateway to the **VyaparSathi AI Copilot**.

---

## ⚡ Key Highlights & Architecture

- **Multi-Tenant / Multi-Store Architecture**: Strict store-scoped data isolation across products, inventory, sales, purchases, and analytics.
- **Robust POS & Cart Engine**: Atomic cart checkouts, multi-item barcode scanning, custom payment modes (Cash, UPI, QR, Split), and real-time stock deduction.
- **Procurement & Supply Chain**: Comprehensive lifecycle tracking with **Sellers, Purchase Orders (PO), Goods Received Notes (GRN), and Purchase Returns**.
- **Real-Time WebSockets**: Dedicated WebSocket server (`ws`) authenticated with Firebase tokens for instant alerts, stock notifications, and billing updates.
- **AI Gateway & Proxy**: Built-in reverse proxy routing `/api/ai/*` and WebSocket upgrades (`/ws/voice`) directly to the FastAPI AI microservice.
- **Asynchronous Task Processing**: Powered by **Redis & BullMQ** for background job queues (`aiQueue`, `notificationQueue`) and dedicated workers.
- **Enterprise Security & Rate Limiting**: Dual-tier rate limiting (global 100 req/15m, strict auth 10 req/15m), Firebase token verification, and granular RBAC permissions.
- **Cloud Integrations**:
  - **Cloudinary**: Fast CDN upload and storage for product catalog media.
  - **Resend**: Transactional emails and report summaries.
  - **Pusher Beams**: Mobile and browser push notification delivery.
  - **PDFKit**: Server-side invoice generation.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Runtime** | Node.js (ES Modules) | High performance asynchronous JavaScript engine |
| **Framework** | Express 5.x | Web application framework for routing and middleware |
| **Primary Database** | MongoDB Atlas / Mongoose 9.x | Scalable document database with strict Mongoose schemas |
| **Cache & Message Broker** | Redis / ioredis 6.x | Fast in-memory caching and BullMQ queue backend |
| **Job Queue** | BullMQ 6.x | Distributed background task queues and workers |
| **Authentication** | Firebase Admin SDK | Secure Firebase JWT authentication and token verification |
| **Real-Time Communication** | `ws` (WebSockets) | Bi-directional real-time communication |
| **Reverse Proxy** | `http-proxy-middleware` | Upstream proxy for FastAPI AI Service and voice sockets |
| **Media Storage** | Cloudinary SDK | Cloud image optimization and storage |
| **Transactional Email** | Resend SDK | Reliable email delivery for alerts and reports |
| **Testing** | Jest 30 & Supertest | End-to-end and modular integration test suites |

---

## 📂 Project Structure

```text
Backend-Vyapar-Sathi/
├── config/                     # System configs
│   ├── db.js                   # Mongoose connection & events
│   ├── env.js                  # Environment initialization
│   ├── firebase.js             # Firebase Admin SDK init
│   ├── mail.js                 # Resend email service setup
│   └── redis.js                # Redis client connection
├── middlewares/                # Authentication & security guards
│   ├── auth.middleware.js      # Firebase token verification
│   ├── requireOwner.middleware.js # Store owner authorization
│   ├── requirePermission.middleware.js # Granular RBAC permissions
│   └── requireUser.middleware.js
├── models/                     # Mongoose database models
│   ├── automation.model.js     # Scheduled store triggers & automations
│   ├── buyer.model.js          # Customer profiles & credit history
│   ├── cart.model.js           # POS active cart session & billing
│   ├── employee.model.js       # Store staff & role memberships
│   ├── expense.model.js        # Store operating expenses
│   ├── grn.model.js            # Goods Received Notes
│   ├── masterProduct.model.js  # Global shared barcode catalog
│   ├── notification.model.js   # In-app and push notification logs
│   ├── product.model.js        # Store-specific product catalog
│   ├── purchase.model.js       # Purchase records & supplier invoices
│   ├── purchaseOrder.model.js  # Purchase orders sent to vendors
│   ├── purchaseReturn.model.js # Stock returns to vendors
│   ├── role.model.js           # RBAC roles & customized permissions
│   ├── sale.model.js           # Finalized sales & invoice items
│   ├── seller.model.js         # Supplier & vendor records
│   ├── store.model.js          # Business profile & store metadata
│   └── user.model.js           # Base user account profile
├── modules/                    # Domain-driven feature modules
│   ├── ai/                     # AI copilot forwarding & controllers
│   ├── analytics/              # Aggregations, revenue trends, top items
│   ├── auth/                   # Registration, login, profile routes
│   ├── automation/             # Business automations & webhooks
│   ├── buyer/                  # Customer management & khata
│   ├── cart/                   # POS cart operations & item checkout
│   ├── email/                  # Transactional emails & receipts
│   ├── grn/                    # Goods received receipt processing
│   ├── invite/                 # Staff invite tokens & onboarding
│   ├── notification/           # Notification dispatch & state
│   ├── product/                # Inventory CRUD, master lookup, Cloudinary upload
│   ├── purchase/               # Purchase logging & stock increments
│   ├── purchaseOrder/          # Vendor PO creation & fulfillment
│   ├── sale/                   # Sales order generation & stock deduction
│   ├── seller/                 # Vendor / supplier management
│   ├── store/                  # Store creation, settings, role assignment
│   └── user/                   # User profile data
├── queues/                     # BullMQ task queues
│   ├── aiQueue.js              # Background AI summarization & reports
│   └── notificationQueue.js    # Push & email dispatch queues
├── workers/                    # Distributed BullMQ background workers
│   ├── expressWorker.js        # General background jobs
│   └── notificationWorker.js   # Notification delivery worker
├── utils/                      # Helper utilities (WebSockets, PDF, barcode)
│   └── websocket.js            # Native WebSocket client registry & broadcast
├── app.js                      # Express app setup, rate-limiting & router mounts
├── server.js                   # HTTP server, WebSocket upgrade, AI proxy runner
├── Dockerfile                  # Container build definition
└── package.json
```

---

## 🚦 API Endpoints Reference

All API routes are prefixed with `/api`. Protected endpoints require `Authorization: Bearer <FIREBASE_ID_TOKEN>`.

### 1. Authentication & Users
- `POST /api/auth/register` - Create user profile in MongoDB from Firebase credentials.
- `POST /api/auth/login` - Verify session and load authenticated user profile.
- `GET /api/auth/profile` - Fetch current user info and associated stores.
- `GET /api/user/:id` - Fetch user details by ID.

### 2. Multi-Store Management (`/api/store`)
- `GET /api/store/all` - List all stores owned by or accessible to current user.
- `POST /api/store/create` - Provision a new store.
- `GET /api/store/:storeId` - Retrieve store profile and configuration.
- `PUT /api/store/:storeId` - Update store information (Owner/Admin).
- `DELETE /api/store/:storeId` - Delete store (Owner only).
- `GET /api/store/:storeId/roles` - Retrieve available store RBAC roles.
- `POST /api/store/:storeId/roles/seed` - Initialize default store roles (Manager, Cashier, Stockist).
- `GET /api/store/:storeId/employees` - List employees assigned to the store.
- `POST /api/store/:storeId/employees` - Invite an employee to join store staff.

### 3. Product & Inventory Management (`/api/product`)
- `POST /api/product/upload-image` - Upload product image directly to Cloudinary.
- `GET /api/product/all` - List all active inventory items for the selected store.
- `GET /api/product/barcode/:barcode` - Fetch product by barcode within the store.
- `POST /api/product/add_product` - Add new product with barcode, price, purchase price, category, and expiry.
- `GET /api/product/resolve/:barcode` - Public barcode lookup via external global database.
- `GET /api/product/master/:barcode` - Fast lookup from internal master catalog.
- `PUT /api/product/:id` - Update product attributes and stock levels.
- `DELETE /api/product/:id` - Remove item from store inventory.

### 4. Smart POS Billing & Cart (`/api/cart` & `/api/sales`)
- `POST /api/cart/create` - Initialize a new POS billing cart session.
- `PATCH /api/cart/:cartId/start-scan` - Start barcode scanning mode for cart.
- `POST /api/cart/:cartId/items` - Add product by barcode and quantity to cart.
- `POST /api/cart/:cartId/payment` - Record payment details (Cash/UPI/Card/Credit).
- `PATCH /api/cart/:cartId/confirm-payment` - Confirm payment and mark cart paid.
- `POST /api/sales/from-cart/:cartId` - Convert cart into sale invoice, reduce inventory atomically, and dispatch invoice.
- `GET /api/cart/store/:storeId/history` - Retrieve POS transaction and billing history.

### 5. Procurement & Supply Chain
- **Sellers** (`/api/sellers`): CRUD for suppliers and vendor ledger.
- **Buyers** (`/api/buyers`): Customer management, credit khata, and payment tracking.
- **Purchases** (`/api/purchases`): Stock incoming entries and purchase invoices.
- **Purchase Orders** (`/api/purchase-orders`): Create and track vendor POs.
- **Goods Received Notes** (`/api/grns`): Verify shipments against POs and update physical stock.

### 6. Business Analytics (`/api/analytics`)
*(Requires `REPORTS_VIEW_SALES` permission)*
- `GET /api/analytics/store/:storeId/summary` - Today's sales, weekly revenue, net profit.
- `GET /api/analytics/store/:storeId/trends` - Revenue and transaction volume over time.
- `GET /api/analytics/store/:storeId/categories` - Sales contribution breakdown by category.
- `GET /api/analytics/store/:storeId/products/top` - Best-performing revenue generators.
- `GET /api/analytics/store/:storeId/products/slow-moving` - Deadstock / slow-moving alerts.

### 7. AI Copilot Integration (`/api/ai` & `/ws`)
- `GET /api/ai/:storeId/forecast` - Multi-day sales demand forecasting.
- `GET /api/ai/:storeId/restock` - AI recommended restock quantities.
- `GET /api/ai/:storeId/insights` - Operational store recommendations.
- `POST /api/ai/:storeId/copilot` - General AI Copilot chat query.
- `POST /api/ai/:storeId/copilot/stream` - SSE streaming chat completions.
- `WS /ws/voice` - Full-duplex WebSocket proxy connection directly to AI Voice Agent.

---

## ⚙️ Environment Variables

Create a `.env` file in `Backend-Vyapar-Sathi/` with the following keys:

```env
# Server Configuration
PORT=5000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:3000

# AI Microservice Proxy
AI_SERVICE_URL=http://127.0.0.1:8000

# MongoDB Database Connection
MONGO_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/vyapar-sathi

# Redis Connection (Cache & Queues)
REDIS_URL=redis://default:<password>@<host>:<port>

# Firebase Admin SDK Credentials
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Cloudinary (Product Media Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Resend (Email Delivery)
RESEND_API_KEY=re_your_resend_api_key
MAIL_FROM_ADDRESS=noreply@yourdomain.com

# Pusher Beams (Web & Mobile Push Notifications)
PUSHER_BEAMS_INSTANCE_ID=your_instance_id
PUSHER_BEAMS_SECRET_KEY=your_beams_secret
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.x or v20.x LTS
- **Redis Server**: Local Redis instance or cloud instance (e.g., Redis Cloud)
- **MongoDB**: Local MongoDB or MongoDB Atlas cluster

### 2. Installation
```bash
cd Backend-Vyapar-Sathi
npm install
```

### 3. Running in Development
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

### 4. Running in Production
```bash
npm start
```

### 5. Running Tests
```bash
# Run unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### 6. Docker Build
```bash
docker build -t vyapar-sathi-backend .
docker run -p 5000:5000 --env-file .env vyapar-sathi-backend
```

---

## 🔒 Security & Best Practices

- **Zero Data Leakage**: Store isolation enforced at the database query level with required `storeId` indices.
- **Trust Proxy & DDoS Protection**: Global IP rate limiting prevents brute force and scraping.
- **Graceful Shutdown**: Listens for `SIGTERM` and `SIGINT` signals, closing Redis, MongoDB, and WebSocket connections cleanly before exiting.
- **Sanitized Payloads**: Strict input validation prevents parameter injection.