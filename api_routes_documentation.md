# Vyapar Sathi Backend API Documentation

All API endpoints are prefixed with `/api`. Most routes are protected and require a valid Firebase Authentication token to be passed in the `Authorization: Bearer <token>` header. 

---

## 1. System / General
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Checks application and database connection health (useful for uptime monitoring). | No |

---

## 2. Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Registers a new user. | Yes (Firebase Token) |
| `POST` | `/api/auth/login` | Logs in an existing user. | Yes (Firebase Token) |
| `GET` | `/api/auth/profile` | Retrieves the authenticated user's profile information. | Yes |

---

## 3. User (`/api/user`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/user/:id` | Retrieves details of a specific user by their ID. | Yes |

---

## 4. Store Management (`/api/store`)

### General Store Operations
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/store/all` | Retrieves all stores associated with the authenticated user. | Yes |
| `POST` | `/api/store/create` | Creates a new store. | Yes |
| `GET` | `/api/store/:storeId` | Retrieves details of a specific store. | Yes |
| `PUT` | `/api/store/:storeId` | Updates details of a specific store. | Yes (Owner/Admin) |
| `DELETE` | `/api/store/:storeId` | Deletes a specific store. | Yes (Owner) |

### Store Roles *(Requires Store Ownership)*
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/store/:storeId/roles/` | Gets all roles available in the store. | Yes (Owner) |
| `POST` | `/api/store/:storeId/roles/` | Creates a new role for the store. | Yes (Owner) |
| `POST` | `/api/store/:storeId/roles/seed` | Seeds default roles (e.g., Manager, Cashier) for the store. | Yes (Owner) |
| `PUT` | `/api/store/:storeId/roles/:roleId` | Updates a specific role's permissions. | Yes (Owner) |
| `DELETE` | `/api/store/:storeId/roles/:roleId`| Deletes a specific role. | Yes (Owner) |

### Store Employees *(Requires Store Ownership)*
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/store/:storeId/employees/accept/:employeeId` | An employee accepts an invite to join the store. | Yes |
| `GET` | `/api/store/:storeId/employees/` | Lists all employees in the store. | Yes (Owner) |
| `POST` | `/api/store/:storeId/employees/` | Invites a new employee to the store. | Yes (Owner) |
| `PUT` | `/api/store/:storeId/employees/:employeeId` | Updates an employee's details or role. | Yes (Owner) |
| `DELETE` | `/api/store/:storeId/employees/:employeeId` | Removes an employee from the store. | Yes (Owner) |

---

## 5. Product Management (`/api/product` or `/api/products`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/product/resolve/:barcode` | Resolves product details globally by barcode (via external APIs). | No |
| `POST` | `/api/product/upload-image` | Uploads an image for a product. | Yes |
| `GET` | `/api/product/all` | Retrieves all products in a store. | Yes |
| `GET` | `/api/product/barcode/:barcode` | Retrieves a specific product from inventory by its barcode. | Yes |
| `POST` | `/api/product/add_product` | Adds a new product to the store's inventory. | Yes |
| `GET` | `/api/product/master/:barcode` | Looks up a barcode in the shared master catalog (internal DB lookup).| Yes |
| `POST` | `/api/product/master` | Saves a manually entered product to the shared master catalog. | Yes |
| `GET` | `/api/product/:id` | Gets a specific product by its ID. | Yes |
| `PUT` | `/api/product/:id` | Updates a specific product's details. | Yes |
| `DELETE` | `/api/product/:id` | Deletes a specific product from the store. | Yes |

---

## 6. Point of Sale & Cart (`/api/cart`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/cart/create` | Creates a new shopping cart session. | Yes |
| `PATCH` | `/api/cart/:cartId/start-scan` | Initializes a scanning session for a cart. | Yes |
| `GET` | `/api/cart/:cartId/product/:barcode` | Retrieves product details by barcode to add to the cart. | Yes |
| `POST` | `/api/cart/:cartId/items` | Adds an item (product) to the cart. | Yes |
| `POST` | `/api/cart/:cartId/payment` | Processes a payment for the cart. | Yes |
| `PATCH` | `/api/cart/:cartId/confirm-payment` | Confirms the payment and finalizes the cart. | Yes |
| `GET` | `/api/cart/store/:storeId/history` | Gets the billing and cart history for a specific store. | Yes |

---

## 7. Sales (`/api/sales`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/sales/from-cart/:cartId` | Generates a final sale record from a completed cart. | Yes |

---

## 8. AI Copilot & Insights (`/api/ai`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/ai/:storeId/forecast` | Retrieves AI-driven sales forecasts for the store. | Yes |
| `GET` | `/api/ai/:storeId/restock` | Retrieves AI recommendations for restocking inventory. | Yes |
| `GET` | `/api/ai/:storeId/insights` | Gets general AI insights and tips for the store. | Yes |
| `GET` | `/api/ai/:storeId/summary` | Gets an AI-generated summary of store performance. | Yes |
| `GET` | `/api/ai/:storeId/product/:productId` | Gets specific AI insights for a single product. | Yes |
| `POST` | `/api/ai/:storeId/copilot` | Sends a standard query to the AI Copilot. | Yes |
| `POST` | `/api/ai/:storeId/copilot/stream` | Sends a query to the AI Copilot (returns a streaming response).| Yes |

---

## 9. Invites (`/api/invite`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/invite/:token` | Previews an invite link. | No |
| `POST` | `/api/invite/:token/accept` | Accepts an invite to join a store. | Yes |
| `POST` | `/api/invite/:token/decline` | Declines an invite to join a store. | Yes |

---

## 10. Analytics (`/api/analytics`)
> [!NOTE]
> These endpoints require specific permissions like `REPORTS_VIEW_SALES` as they expose sensitive business data.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/analytics/store/:storeId/summary` | Retrieves a high-level summary of store analytics. | Yes |
| `GET` | `/api/analytics/store/:storeId/trends` | Retrieves sales trends over time. | Yes |
| `GET` | `/api/analytics/store/:storeId/categories`| Retrieves performance metrics broken down by product categories. | Yes |
| `GET` | `/api/analytics/store/:storeId/products/top` | Retrieves the top-performing (best-selling) products. | Yes |
| `GET` | `/api/analytics/store/:storeId/products/slow-moving` | Retrieves slow-moving products that aren't selling well. | Yes |
| `GET` | `/api/analytics/store/:storeId/products/:productId/overview`| Retrieves a detailed analytical overview for a single product. | Yes |
