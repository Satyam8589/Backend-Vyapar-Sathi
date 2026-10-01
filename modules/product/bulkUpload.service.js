import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product, MasterProduct, Inventory } from "../../models/index.js";
import { ApiError } from "../../utils/ApiError.js";
import mongoose from "mongoose";

/**
 * Target form fields available in Vyapar Sathi
 */
export const TARGET_FIELDS = [
  { key: "name", label: "Product Name", required: true },
  { key: "barcode", label: "Barcode / SKU / EAN", required: false },
  { key: "category", label: "Category", required: true },
  { key: "buyingPrice", label: "Buying Price", required: true },
  { key: "sellingPrice", label: "Selling Price / Rate", required: true },
  { key: "quantity", label: "Quantity / Stock", required: true },
  { key: "unit", label: "Unit (e.g., Pcs, Kg)", required: false },
  { key: "brand", label: "Brand / Manufacturer", required: false },
  { key: "expDate", label: "Expiry Date", required: false },
];

/**
 * Heuristic/Regex-based fallback for column matching if AI service is unavailable
 */

function fallbackHeaderMapping(headers = []) {
  const mapping = {
    name: null,
    barcode: null,
    category: null,
    buyingPrice: null,
    sellingPrice: null,
    quantity: null,
    unit: null,
    brand: null,
    expDate: null,
  };

  headers.forEach((h) => {
    if (!h) return;
    const headerStr = String(h).trim().toLowerCase();

    if (!mapping.name && /(name|product|item|title|description)/i.test(headerStr)) {
      mapping.name = h;
    } else if (!mapping.barcode && /(barcode|ean|upc|code|sku)/i.test(headerStr)) {
      mapping.barcode = h;
    } else if (!mapping.category && /(category|type|group|dept)/i.test(headerStr)) {
      mapping.category = h;
    } else if (!mapping.buyingPrice && /(cost|buying|purchase)/i.test(headerStr)) {
      mapping.buyingPrice = h;
    } else if (!mapping.sellingPrice && /(price|rate|mrp|amount|selling)/i.test(headerStr) && !/(cost|buying|purchase)/i.test(headerStr)) {
      mapping.sellingPrice = h;
    } else if (!mapping.quantity && /(qty|quantity|stock|count|avail|balance)/i.test(headerStr)) {
      mapping.quantity = h;
    } else if (!mapping.unit && /(unit|pack|size|uom)/i.test(headerStr)) {
      mapping.unit = h;
    } else if (!mapping.brand && /(brand|company|make|mfr)/i.test(headerStr)) {
      mapping.brand = h;
    } else if (!mapping.expDate && /(exp|expiry|best before|validity|use by|expiration|mfd\/exp)/i.test(headerStr)) {
      mapping.expDate = h;
    }
  });

  return mapping;
}

/**
 * Analyzes Excel column headers and sample rows using Gemini AI
 */
export const analyzeExcelHeadersWithGemini = async (headers = [], sampleRows = []) => {
  if (!headers || headers.length === 0) {
    throw new ApiError("Headers array cannot be empty", 400);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    console.warn("[BulkUpload AI] No GEMINI_API_KEY found. Falling back to heuristic mapping.");
    return {
      mapping: fallbackHeaderMapping(headers),
      source: "heuristic_fallback",
      confidence: 0.7,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
You are an intelligent data-mapping assistant for Vyapar Sathi inventory management system.
Analyze the provided Excel column headers and the first few sample rows.
Map each column header to our target form fields:

Target Form Fields:
- name: Product Name / Item Title / Item Name
- barcode: Barcode / UPC / EAN / Item Code / SKU
- category: Category / Product Group / Department
- buyingPrice: Cost Price / Buying Price / Purchase Rate
- sellingPrice: Selling Price / Sale Rate / MRP / Price
- quantity: Stock Quantity / Qty / Available Stock / Count
- unit: Unit of measure (Pieces, Kg, Liters, Boxes, Pcs)
- brand: Brand / Manufacturer / Company
- expDate: Expiry Date / Best Before

Excel Column Headers:
${JSON.stringify(headers)}

Sample Rows (first 3 rows):
${JSON.stringify(sampleRows)}

Output Format Requirements:
Return a JSON object with this exact shape:
{
  "mapping": {
    "name": "Matched Excel Header String or null",
    "barcode": "Matched Excel Header String or null",
    "category": "Matched Excel Header String or null",
    "buyingPrice": "Matched Excel Header String or null",
    "sellingPrice": "Matched Excel Header String or null",
    "quantity": "Matched Excel Header String or null",
    "unit": "Matched Excel Header String or null",
    "brand": "Matched Excel Header String or null",
    "expDate": "Matched Excel Header String or null"
  },
  "confidence": 0.95
}
Do not return any extra text outside the JSON object.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return {
      mapping: parsed.mapping || fallbackHeaderMapping(headers),
      source: "gemini_ai",
      confidence: parsed.confidence || 0.9,
    };
  } catch (error) {
    console.error("[BulkUpload AI Error]:", error.message);
    return {
      mapping: fallbackHeaderMapping(headers),
      source: "heuristic_fallback",
      confidence: 0.7,
      aiError: error.message,
    };
  }
};

/**
 * Sanitizes numeric and text input values from parsed Excel rows
 */
function cleanNumber(val, defaultVal = 0) {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : Math.max(0, val);

  let str = String(val).trim().replace(/,/g, "");
  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return defaultVal;

  const parsed = parseFloat(match[0]);
  return isNaN(parsed) ? defaultVal : Math.max(0, parsed);
}

function cleanString(val, defaultVal = null) {
  if (val === null || val === undefined) return defaultVal;
  const str = String(val).trim();
  return str.length > 0 ? str : defaultVal;
}

/**
 * Parse Excel dates robustly (handles Date objects, Excel Serial Numbers like 45231, DD/MM/YYYY, MM/YYYY, and text dates)
 */
function parseExcelDate(val) {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  if (typeof val === "number") {
    if (val > 25000 && val < 60000) {
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      return isNaN(jsDate.getTime()) ? null : jsDate;
    }
  }

  let str = String(val).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmy) {
    let p1 = parseInt(dmy[1], 10);
    let p2 = parseInt(dmy[2], 10);
    let yr = parseInt(dmy[3], 10);
    if (yr < 100) yr += 2000;

    if (p1 > 12) {
      const d = new Date(yr, p2 - 1, p1);
      if (!isNaN(d.getTime())) return d;
    } else if (p2 > 12) {
      const d = new Date(yr, p1 - 1, p2);
      if (!isNaN(d.getTime())) return d;
    } else {
      const d = new Date(yr, p2 - 1, p1);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Month-Year: MM/YYYY or MM-YYYY or MMM-YYYY or MMM YYYY
  const my = str.match(/^([a-zA-Z]{3,9}|\d{1,2})[./\-\s]+(\d{2,4})$/);
  if (my) {
    let mStr = my[1];
    let yr = parseInt(my[2], 10);
    if (yr < 100) yr += 2000;
    let monthIdx = -1;
    if (/^\d+$/.test(mStr)) {
      monthIdx = parseInt(mStr, 10) - 1;
    } else {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      monthIdx = months.findIndex(m => mStr.toLowerCase().startsWith(m));
    }
    if (monthIdx >= 0 && monthIdx < 12) {
      const d = new Date(yr, monthIdx, 1);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Day-MonthName-Year: 28-Sep-2026 or 28 Sep 2026
  const dmyText = str.match(/^(\d{1,2})[./\-\s]+([a-zA-Z]{3,9})[./\-\s]+(\d{2,4})$/);
  if (dmyText) {
    let day = parseInt(dmyText[1], 10);
    let mStr = dmyText[2];
    let yr = parseInt(dmyText[3], 10);
    if (yr < 100) yr += 2000;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let monthIdx = months.findIndex(m => mStr.toLowerCase().startsWith(m));
    if (monthIdx >= 0 && monthIdx < 12) {
      const d = new Date(yr, monthIdx, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Standard ISO fallback
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

/**
 * Processes bulk inventory insertion/updating logic:
 * 1. Checks MasterProduct (Global Catalog). If not found & has barcode, creates it in MasterProduct.
 * 2. Checks Store Product (Local Store). If found, updates quantity, price & expDate according to stockUpdateMode.
 * 3. If not found in Store Product, creates Store Product & Inventory entries.
 */
export const executeBulkProductUpload = async ({ storeId, userId, rows, columnMapping, stockUpdateMode = "add" }) => {
  if (!storeId) throw new ApiError("Store ID is required", 400);
  if (!userId) throw new ApiError("User ID is required", 400);
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new ApiError("Rows data must be a non-empty array", 400);
  }

  const results = {
    total: rows.length,
    success: 0,
    updated: 0,
    failed: 0,
    masterAdded: 0,
    errors: [],
  };

  const nameCol = columnMapping.name;
  const barcodeCol = columnMapping.barcode;
  const categoryCol = columnMapping.category;
  const buyingPriceCol = columnMapping.buyingPrice;
  const sellingPriceCol = columnMapping.sellingPrice;
  const quantityCol = columnMapping.quantity;
  const unitCol = columnMapping.unit;
  const brandCol = columnMapping.brand;
  const expDateCol = columnMapping.expDate;

  if (!nameCol || !sellingPriceCol || !buyingPriceCol || !quantityCol) {
    throw new ApiError(
      "Missing critical mappings. 'Product Name', 'Buying Price', 'Selling Price', and 'Quantity' must be mapped.",
      400
    );
  }

  // Pre-deduplicate rows in uploaded batch by Barcode / Name to prevent unique constraint race conditions
  const aggregatedMap = new Map();

  for (let idx = 0; idx < rows.length; idx++) {
    const rawRow = rows[idx];
    const rawName = cleanString(rawRow[nameCol]);
    const rawBarcode = cleanString(rawRow[barcodeCol]);

    if (!rawName) {
      results.failed++;
      results.errors.push({ rowNumber: idx + 2, product: "Empty Row", error: "Row missing product name" });
      continue;
    }

    const sellingPrice = cleanNumber(rawRow[sellingPriceCol], -1);
    const buyingPrice = cleanNumber(rawRow[buyingPriceCol], -1);
    if (sellingPrice < 0 || buyingPrice < 0) {
      results.failed++;
      results.errors.push({ rowNumber: idx + 2, product: rawName, error: "Invalid or missing selling/buying price" });
      continue;
    }

    const qty = cleanNumber(rawRow[quantityCol], 0);
    const category = cleanString(rawRow[categoryCol], "General");
    const unit = cleanString(rawRow[unitCol], "Pieces");
    const brand = cleanString(rawRow[brandCol], null);
    const expDate = parseExcelDate(rawRow[expDateCol]);

    const key = rawBarcode ? `barcode:${rawBarcode}` : `name:${rawName.toLowerCase()}`;

    if (aggregatedMap.has(key)) {
      const existing = aggregatedMap.get(key);
      existing.quantity += qty;
      existing.sellingPrice = sellingPrice; 
      existing.buyingPrice = buyingPrice;
      if (expDate) existing.expDate = expDate;
    } else {
      aggregatedMap.set(key, {
        rowNumber: idx + 2,
        name: rawName,
        barcode: rawBarcode,
        category,
        sellingPrice,
        buyingPrice,
        quantity: qty,
        unit,
        brand,
        expDate,
      });
    }
  }

  // Process aggregated items
  for (const [key, item] of aggregatedMap.entries()) {
    try {
      // Step 1: Global Store (MasterProduct) Check & Addition
      let masterProd = null;
      if (item.barcode) {
        masterProd = await MasterProduct.findOne({ barcode: item.barcode });
        if (!masterProd) {
          try {
            masterProd = await MasterProduct.create({
              barcode: item.barcode,
              name: item.name,
              brand: item.brand,
              category: item.category,
              quantity: item.unit,
              source: "bulk_excel_upload",
            });
            results.masterAdded++;
          } catch (mErr) {
            // In case of parallel insertion duplicate barcode
            masterProd = await MasterProduct.findOne({ barcode: item.barcode });
          }
        }
      }

      // Step 2: Store Product Check & Upsert
      let storeProd = null;
      if (item.barcode) {
        storeProd = await Product.findOne({ store: storeId, barcode: item.barcode, isActive: true });
      }

      if (!storeProd) {
        storeProd = await Product.findOne({
          store: storeId,
          name: { $regex: new RegExp(`^${item.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}$`, "i") },
          isActive: true,
        });
      }

      if (storeProd) {
        // Product already exists in this store -> Determine new quantity based on stockUpdateMode
        const finalQuantity = stockUpdateMode === "replace" || stockUpdateMode === "set"
          ? item.quantity
          : storeProd.quantity + item.quantity;

        storeProd.quantity = finalQuantity;
        storeProd.sellingPrice = item.sellingPrice;
        storeProd.buyingPrice = item.buyingPrice;
        if (item.expDate) {
          storeProd.expDate = item.expDate;
        }
        if (item.barcode && !storeProd.barcode) {
          storeProd.barcode = item.barcode;
        }
        await storeProd.save();

        // Update Inventory table and recalculate stock status flags (isLowStock / isOutOfStock)
        let inv = await Inventory.findOne({ store: storeId, product: storeProd._id });
        if (inv) {
          inv.quantity = finalQuantity;
          inv.sellingPrice = item.sellingPrice;
          await inv.save();
        } else {
          inv = new Inventory({
            store: storeId,
            product: storeProd._id,
            quantity: finalQuantity,
            sellingPrice: item.sellingPrice,
          });
          await inv.save();
        }

        results.updated++;
      } else {
        // Product does not exist in store -> Add to Store Product & Inventory
        const newProd = await Product.create({
          name: item.name,
          brand: item.brand || masterProd?.brand || null,
          barcode: item.barcode,
          category: item.category || masterProd?.category || "General",
          sellingPrice: item.sellingPrice,
          buyingPrice: item.buyingPrice,
          quantity: item.quantity,
          unit: item.unit,
          expDate: item.expDate,
          store: storeId,
          createdBy: userId,
        });

        const newInv = new Inventory({
          store: storeId,
          product: newProd._id,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
        });
        await newInv.save();

        results.success++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ rowNumber: item.rowNumber, product: item.name, error: err.message });
    }
  }

  return results;
};
