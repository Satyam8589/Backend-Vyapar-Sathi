import mongoose from "mongoose";
import Store from "../../../../modules/store/models/store.model.js";

describe("Store model", () => {
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
});
