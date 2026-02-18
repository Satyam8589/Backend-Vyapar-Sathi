import mongoose from "mongoose";
import { Store } from "../../../../models";

describe("Store model", () => {
  test("successfully creates a store with valid data", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.name).toBe("Main Branch");
    expect(doc.phone).toBe("9999999999");
  });

  test("applies expected defaults for new stores", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
    });

    expect(doc.isActive).toBe(true);
    expect(doc.businessType).toBe("retail");
    expect(doc.settings.lowStockThreshold).toBe(10);
    expect(doc.settings.expiryAlertDays).toBe(7);
    expect(doc.settings.currency).toBe("INR");
    expect(doc.address.country).toBe("India");
  });

  test("rejects invalid 10-digit phone numbers", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "12345",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.phone).toBeDefined();
    expect(error.errors.phone.message).toBe(
      "Please provide a valid 10-digit phone number",
    );
  });

  test("rejects when store name is missing", () => {
    const doc = new Store({
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.name.message).toBe("Store name is required");
  });

  test("rejects when owner is missing", () => {
    const doc = new Store({
      name: "Main Branch",
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.owner).toBeDefined();
    expect(error.errors.owner.message).toBe("Store owner is required");
  });

  test("rejects when ownerFirebaseUid is missing", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.ownerFirebaseUid).toBeDefined();
    expect(error.errors.ownerFirebaseUid.message).toBe(
      "Owner Firebase UID is required",
    );
  });

  test("rejects when address.fullAddress is missing", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        city: "Mumbai",
      },
      phone: "9999999999",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors["address.fullAddress"]).toBeDefined();
  });

  test("rejects when phone is missing", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.phone).toBeDefined();
    expect(error.errors.phone.message).toBe("Phone number is required");
  });

  test("accepts valid email address", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      email: "store@example.com",
    });

    const error = doc.validateSync();

    expect(error).toBeUndefined();
    expect(doc.email).toBe("store@example.com");
  });

  test("rejects invalid email address", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      email: "invalid-email",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.email).toBeDefined();
    expect(error.errors.email.message).toBe(
      "Please provide a valid email address",
    );
  });

  test("rejects store name exceeding 100 characters", () => {
    const longName = "A".repeat(101);
    const doc = new Store({
      name: longName,
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.name.message).toBe(
      "Store name cannot exceed 100 characters",
    );
  });

  test("rejects description exceeding 500 characters", () => {
    const longDescription = "A".repeat(501);
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      description: longDescription,
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.description).toBeDefined();
    expect(error.errors.description.message).toBe(
      "Description cannot exceed 500 characters",
    );
  });

  test("accepts valid business types", () => {
    const validTypes = ["retail", "wholesale", "both", "service", "other"];

    validTypes.forEach((type) => {
      const doc = new Store({
        name: "Main Branch",
        owner: new mongoose.Types.ObjectId(),
        ownerFirebaseUid: "firebase-uid-123",
        address: {
          fullAddress: "123 Market Road",
        },
        phone: "9999999999",
        businessType: type,
      });

      const error = doc.validateSync();
      expect(error).toBeUndefined();
      expect(doc.businessType).toBe(type);
    });
  });

  test("rejects invalid business type", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      businessType: "invalid-type",
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.businessType).toBeDefined();
  });

  test("rejects negative low stock threshold", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      settings: {
        lowStockThreshold: -5,
      },
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors["settings.lowStockThreshold"]).toBeDefined();
    expect(error.errors["settings.lowStockThreshold"].message).toBe(
      "Low stock threshold cannot be negative",
    );
  });

  test("rejects negative expiry alert days", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      settings: {
        expiryAlertDays: -1,
      },
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors["settings.expiryAlertDays"]).toBeDefined();
    expect(error.errors["settings.expiryAlertDays"].message).toBe(
      "Expiry alert days cannot be negative",
    );
  });

  test("accepts valid currency codes", () => {
    const validCurrencies = ["INR", "USD", "EUR", "GBP"];

    validCurrencies.forEach((currency) => {
      const doc = new Store({
        name: "Main Branch",
        owner: new mongoose.Types.ObjectId(),
        ownerFirebaseUid: "firebase-uid-123",
        address: {
          fullAddress: "123 Market Road",
        },
        phone: "9999999999",
        settings: {
          currency: currency,
        },
      });

      const error = doc.validateSync();
      expect(error).toBeUndefined();
      expect(doc.settings.currency).toBe(currency);
    });
  });

  test("rejects invalid currency code", () => {
    const doc = new Store({
      name: "Main Branch",
      owner: new mongoose.Types.ObjectId(),
      ownerFirebaseUid: "firebase-uid-123",
      address: {
        fullAddress: "123 Market Road",
      },
      phone: "9999999999",
      settings: {
        currency: "INVALID",
      },
    });

    const error = doc.validateSync();

    expect(error).toBeDefined();
    expect(error.errors["settings.currency"]).toBeDefined();
  });
});
