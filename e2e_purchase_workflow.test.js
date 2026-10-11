import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import Store from "./models/store.model.js";
import User from "./models/user.model.js";
import Seller from "./models/seller.model.js";
import Product from "./models/product.model.js";
import Inventory from "./models/inventory.model.js";

// Services
import { createPurchaseOrder, approvePurchaseOrder, receivePurchaseOrderItems } from "./modules/purchaseOrder/purchaseOrder.service.js";
import { createPurchaseReturn } from "./modules/purchase/purchase.service.js";
import { recordPurchasePayment } from "./modules/purchase/purchasePayment.service.js";
import { getSellerPerformanceByIdService } from "./modules/seller/seller.performance.service.js";
import { getReorderSuggestions } from "./modules/purchase/purchaseReorder.service.js";

const runTest = async () => {
  let storeId;
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to DB.");

    // 1. Setup Store and User
    const user = new User({
      name: "E2E Test User",
      email: `e2e_${Date.now()}@test.com`,
      password: "password123",
      role: "StoreOwner",
      isVerified: true,
      firebaseUid: `e2e_firebase_${Date.now()}`
    });
    await user.save();

    const store = new Store({
      name: "E2E Test Store",
      owner: user._id,
      ownerFirebaseUid: user.firebaseUid,
      phone: "1234567890",
      address: {
        fullAddress: "123 E2E Street"
      },
      currency: "INR",
      timezone: "Asia/Kolkata"
    });
    await store.save();
    storeId = store._id.toString();
    console.log("1. Store & User created:", storeId);

    // 2. Create Supplier
    const supplier = new Seller({
      name: "E2E Supplier",
      phone: "1234567890",
      email: `supplier_${Date.now()}@test.com`,
      store: storeId,
      status: "active"
    });
    await supplier.save();
    console.log("2. Supplier created:", supplier._id.toString());

    // 3. Create Product
    const product = new Product({
      name: "E2E Test Product",
      sku: `SKU-${Date.now()}`,
      category: "Test",
      buyingPrice: 100,
      sellingPrice: 150,
      quantity: 0,
      store: storeId,
      createdBy: user._id
    });
    await product.save();
    
    const inventory = new Inventory({
      product: product._id,
      store: storeId,
      quantity: 0,
      minStockLevel: 50,
      sellingPrice: 150,
      purchasePrice: 100
    });
    await inventory.save();
    console.log("3. Product & Inventory created:", product._id.toString());

    // 4. Create Purchase Order
    const poData = {
      seller: supplier._id,
      items: [
        {
          product: product._id,
          name: product.name,
          quantity: 100,
          unitPrice: 100,
          totalPrice: 10000
        }
      ],
      expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
      subTotal: 10000,
      grandTotal: 10000,
      notes: "E2E Test PO"
    };
    const po = await createPurchaseOrder(storeId, poData);
    console.log("4. PO Created:", po._id.toString());

    // Approve PO
    await approvePurchaseOrder(storeId, po._id);
    console.log("4a. PO Approved.");

    // 5. Create GRN (Receives items and creates Purchase & Stock Update)
    // receivePurchaseOrderItems(storeId, poId, receiveData, userId, notes)
    const receiveData = [
        {
            productId: product._id.toString(),
            receivedQuantity: 90,
            acceptedQuantity: 90,
            rejectedQuantity: 0
        }
    ];
    
    const receiveResult = await receivePurchaseOrderItems(storeId, po._id, receiveData, user._id, "Received 90 items");
    const grn = receiveResult.grn;
    const purchase = receiveResult.purchase;
    console.log("5. GRN Created:", grn._id.toString(), "Purchase Created:", purchase._id.toString());

    // Check Stock
    const updatedProd = await Product.findById(product._id);
    if (updatedProd.quantity !== 90) {
      throw new Error(`Stock mismatch: Expected 90, got ${updatedProd.quantity}`);
    }
    console.log("5a. Stock updated correctly.");

    // 6. Record Payment on the linked Purchase
    const paymentData = {
      amount: 4000,
      paymentMethod: "Bank Transfer",
      referenceNo: "REF-123",
      paymentDate: new Date().toISOString(),
      notes: "Partial payment"
    };
    const payment = await recordPurchasePayment(storeId, purchase._id, user._id, paymentData);
    console.log("6. Payment recorded. Payment ID:", payment._id.toString());

    // 7. Purchase Return (Return 10 items)
    const returnData = {
      items: [
        {
          product: product._id,
          quantity: 10,
          unitPrice: 100,
          reason: "Damaged"
        }
      ],
      refundAmount: 1000,
      notes: "Return test"
    };
    const pReturn = await createPurchaseReturn(purchase._id, storeId, returnData);
    console.log("7. Purchase Return Created:", pReturn._id.toString());

    // Check Stock after return
    const prodAfterReturn = await Product.findById(product._id);
    if (prodAfterReturn.quantity !== 80) {
      throw new Error(`Stock mismatch after return: Expected 80, got ${prodAfterReturn.quantity}`);
    }
    console.log("7a. Stock updated correctly after return.");

    // 8. Supplier Performance
    const performance = await getSellerPerformanceByIdService(storeId, supplier._id);
    console.log("8. Supplier Performance fetched successfully.");

    // 9. Smart Reorder
    const suggestions = await getReorderSuggestions(storeId);
    console.log("9. Smart Reorder Suggestions:", suggestions.summary?.productsToReorder || 0);

    console.log("\n✅ E2E TEST COMPLETED SUCCESSFULLY.");

  } catch (error) {
    console.error("\n❌ E2E TEST FAILED:", error);
  } finally {
    if (storeId) {
      // Cleanup can be done here if needed
    }
    process.exit(0);
  }
};

runTest();
