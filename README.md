# Backend-Vyapar-Sathi

🧠 Vyapar Sathi – Store-Wise Multi-Store Inventory Management System
What It Is
A web-based retail POS & inventory management system for small/medium store owners — built progressively in 3 levels.

📦 Level 1 – Single Store Inventory System
Module	Key Features
Auth	Firebase Authentication
Store Setup	Create one store with name & details
Product Management	Add/Edit/Delete products with barcode, name, quantity, price, expiry
Sales Module	Scan barcode → Add to cart → Auto-calculate total → Confirm sale → Auto-reduce stock → Store sale record
Dashboard	Total products, stock qty, today's sales, low stock alerts, expiry alerts, daily sales chart
✅ Fully usable as a basic POS system

📦 Level 2 – Multi-Store with Separate Dashboards
Module	Key Features
Multi-Store	Create multiple stores under one account, store selection screen
Data Isolation	Each store gets its own inventory, sales records, dashboard — zero data mixing
Store Dashboard	Store-specific sales, inventory, alerts, charts
Enhanced Alerts	Low stock threshold, expiry-within-X-days, store-wise notifications
✅ Demonstrates scalable architecture & proper data modeling

📦 Level 3 – Smart POS with Payment Integration
Module	Key Features
Advanced Barcode	Mobile camera scanning, fast scan-to-cart, multi-item scan
Cart System	Add/remove items, increase/decrease qty, real-time total
Payments	Cash, Online, Store-specific QR code, payment confirmation before inventory update
Sales Analytics	Daily/weekly/monthly reports, top-selling products, trends graph, revenue comparison
Role-Based Access	Owner role, Counter staff role with restricted access
Report Export	Download sales reports in PDF/CSV
Scalability	Modular backend, clean API structure, proper DB relationships
✅ Production-ready, industry-level smart retail POS

🔄 Complete Product Flow
User Login → Create/Select Store → Add Products (Barcode) → Sell (Scan → Cart → Payment → Confirm) → Inventory Auto-Updates → Store-Wise Dashboard Updates

## Product Image Upload

Product images are uploaded separately to Cloudinary before the product is saved.

### Required environment variables

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Flow

1. The frontend selects an image from the device gallery or camera.
2. The image is sent to `POST /api/product/upload-image` as multipart form data.
3. The backend uploads the file to Cloudinary and returns the `secure_url`.
4. The frontend stores that URL in the add-product form and submits it with the existing JSON `add_product` request.
5. If no image is uploaded, the product still saves normally.

🏗️ Build Strategy
Backend first → Backend-Vyapar-Sathi (current repo)
Frontend later → Separate repository
Then connect via APIs