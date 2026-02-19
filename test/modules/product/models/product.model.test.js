import mongoose from "mongoose";
import { Product } from "../../../../models";

describe("Product model", () => {
  test("successfully creates a product with valid data", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      quantity: 10,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.name).toBe("Test Product");
    expect(doc.category).toBe("Electronics");
    expect(doc.price).toBe(999);
    expect(doc.quantity).toBe(10);
  });

  test("applies expected defaults for new products", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(doc.isActive).toBe(true);
    expect(doc.quantity).toBe(0);
    expect(doc.unit).toBe("Pieces");
  });

  test("rejects when product name is missing", () => {
    const doc = new Product({
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.name.message).toBe("Product name is required");
  });

  test("rejects when category is missing", () => {
    const doc = new Product({
      name: "Test Product",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.category).toBeDefined();
    expect(error.errors.category.message).toBe("Product category is required");
  });

  test("rejects when price is missing", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.price).toBeDefined();
    expect(error.errors.price.message).toBe("Price is required");
  });

  test("rejects when store reference is missing", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.store).toBeDefined();
    expect(error.errors.store.message).toBe("Store reference is required");
  });

  test("rejects when createdBy reference is missing", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.createdBy).toBeDefined();
  });

  test("rejects negative price", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: -100,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.price).toBeDefined();
    expect(error.errors.price.message).toBe("Price cannot be negative");
  });

  test("accepts zero price", () => {
    const doc = new Product({
      name: "Free Product",
      category: "Electronics",
      price: 0,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.price).toBe(0);
  });

  test("rejects negative quantity", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      quantity: -10,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.quantity).toBeDefined();
    expect(error.errors.quantity.message).toBe("Quantity cannot be negative");
  });

  test("accepts zero quantity", () => {
    const doc = new Product({
      name: "Out of Stock Product",
      category: "Electronics",
      price: 999,
      quantity: 0,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.quantity).toBe(0);
  });

  test("successfully creates product with barcode", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      barcode: "123456789",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.barcode).toBe("123456789");
  });

  test("allows product without barcode", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.barcode).toBeUndefined();
  });

  test("trims whitespace from name", () => {
    const doc = new Product({
      name: "  Test Product  ",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(doc.name).toBe("Test Product");
  });

  test("trims whitespace from category", () => {
    const doc = new Product({
      name: "Test Product",
      category: "  Electronics  ",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(doc.category).toBe("Electronics");
  });

  test("trims whitespace from barcode", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      barcode: "  123456789  ",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(doc.barcode).toBe("123456789");
  });

  test("trims whitespace from unit", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      unit: "  Boxes  ",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(doc.unit).toBe("Boxes");
  });

  test("successfully creates product with custom unit", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Groceries",
      price: 50,
      unit: "Kilograms",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.unit).toBe("Kilograms");
  });

  test("successfully creates product with expiry date", () => {
    const expiryDate = new Date("2025-12-31");
    const doc = new Product({
      name: "Perishable Product",
      category: "Food",
      price: 100,
      expDate: expiryDate,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.expDate).toEqual(expiryDate);
  });

  test("allows product without expiry date", () => {
    const doc = new Product({
      name: "Non-Perishable Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.expDate).toBeUndefined();
  });

  test("successfully creates product with all fields", () => {
    const expiryDate = new Date("2025-12-31");
    const storeId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const doc = new Product({
      name: "Complete Product",
      category: "Electronics",
      price: 1999,
      quantity: 50,
      unit: "Boxes",
      barcode: "987654321",
      expDate: expiryDate,
      store: storeId,
      createdBy: userId,
      isActive: true,
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.name).toBe("Complete Product");
    expect(doc.category).toBe("Electronics");
    expect(doc.price).toBe(1999);
    expect(doc.quantity).toBe(50);
    expect(doc.unit).toBe("Boxes");
    expect(doc.barcode).toBe("987654321");
    expect(doc.expDate).toEqual(expiryDate);
    expect(doc.store).toEqual(storeId);
    expect(doc.createdBy).toEqual(userId);
    expect(doc.isActive).toBe(true);
  });

  test("validates store field must be ObjectId", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: "invalid-id",
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.store).toBeDefined();
  });

  test("validates createdBy field must be ObjectId", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: "invalid-id",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.createdBy).toBeDefined();
  });

  test("accepts large price values", () => {
    const doc = new Product({
      name: "Expensive Product",
      category: "Luxury",
      price: 99999999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.price).toBe(99999999);
  });

  test("accepts large quantity values", () => {
    const doc = new Product({
      name: "Bulk Product",
      category: "Wholesale",
      price: 10,
      quantity: 1000000,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.quantity).toBe(1000000);
  });

  test("accepts decimal price values", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 99.99,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.price).toBe(99.99);
  });

  test("can set isActive to false", () => {
    const doc = new Product({
      name: "Inactive Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      isActive: false,
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.isActive).toBe(false);
  });

  test("product has timestamps", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(doc.schema.paths.createdAt).toBeDefined();
    expect(doc.schema.paths.updatedAt).toBeDefined();
  });

  test("validates expDate must be a valid date", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      expDate: "invalid-date",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.expDate).toBeDefined();
  });

  test("product references can be populated", () => {
    const storeId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      store: storeId,
      createdBy: userId,
    });

    expect(doc.store).toEqual(storeId);
    expect(doc.createdBy).toEqual(userId);
    expect(doc.schema.paths.store.options.ref).toBe("Store");
    expect(doc.schema.paths.createdBy.options.ref).toBe("User");
  });

  test("empty string barcode is allowed", () => {
    const doc = new Product({
      name: "Test Product",
      category: "Electronics",
      price: 999,
      barcode: "",
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.barcode).toBe("");
  });

  test("product with very long name", () => {
    const longName = "A".repeat(1000);
    const doc = new Product({
      name: longName,
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.name).toBe(longName);
  });

  test("product with special characters in name", () => {
    const doc = new Product({
      name: "Test Product @ #$%^&*()",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.name).toBe("Test Product @ #$%^&*()");
  });

  test("product with unicode characters in name", () => {
    const doc = new Product({
      name: "Test Product 测试产品 🎉",
      category: "Electronics",
      price: 999,
      store: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.name).toBe("Test Product 测试产品 🎉");
  });
});
