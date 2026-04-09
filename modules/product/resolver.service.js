import { MasterProduct } from "../../models/index.js";
import { fetchFromOpenDatabases } from "./openfood.service.js";
import { normalizeProduct } from "./normalizer.service.js";

/**
 * Try all external sources in priority order and return the first hit.
 *
 * Priority:
 *   1. Open*Facts family (food → beauty → pet) — fully open, no rate limits
 *      Covers grocery, household, beauty products across all regions including India
 *
 * @param {string} barcode
 * @returns {Promise<object|null>} Raw product object ready for normalization
 */
const fetchFromExternalSources = async (barcode) => {
    return await fetchFromOpenDatabases(barcode);
};

/**
 * Resolve a product by barcode.
 *
 * Flow:
 *  1. Validate barcode format (12–13 digits)
 *  2. Check MongoDB cache (MasterProduct)
 *  3. Try external sources (Open*Facts family)
 *  4. Normalize the raw response
 *  5. Persist normalized data to DB
 *  6. Return the saved document, or null if not found anywhere
 *
 * @param {string} barcode
 * @returns {Promise<object|null>}
 * @throws {Error} for invalid barcode format
 */
export const resolveBarcode = async (barcode) => {
    // 1. Validate
    if (!/^\d{12,13}$/.test(barcode)) {
        throw new Error("Invalid barcode format. Must be 12 or 13 digits.");
    }

    // 2. Check DB cache first
    const cached = await MasterProduct.findOne({ barcode });
    if (cached) {
        console.log(`[Resolver] Cache hit for barcode ${barcode} (source: ${cached.source})`);
        return cached;
    }

    console.log(`[Resolver] Cache miss for barcode ${barcode}. Querying external sources…`);

    // 3. Try all external sources
    const raw = await fetchFromExternalSources(barcode);

    if (!raw) {
        console.log(`[Resolver] Barcode ${barcode} not found in any external source.`);
        return null;
    }

    // 4. Normalize
    const normalized = normalizeProduct(raw);

    // 5. Save to DB (only normalized structure, never raw API response)
    const saved = await MasterProduct.create({
        barcode,
        ...normalized,
    });

    console.log(`[Resolver] Saved barcode ${barcode} to DB (source: ${saved.source}, confidence: ${saved.confidence})`);

    return saved;
};

