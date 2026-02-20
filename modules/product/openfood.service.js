import axios from "axios";

const REQUEST_TIMEOUT_MS = 5000;

// All three Open*Facts databases share the identical API response structure
const OPEN_DATABASES = [
    {
        name: "openfoodfacts",
        label: "OpenFoodFacts",
        baseURL: "https://world.openfoodfacts.org/api/v0/product",
    },
    {
        name: "openbeautyfacts",
        label: "OpenBeautyFacts",
        baseURL: "https://world.openbeautyfacts.org/api/v0/product",
    },
    {
        name: "openpetfoodfacts",
        label: "OpenPetFoodFacts",
        baseURL: "https://world.openpetfoodfacts.org/api/v0/product",
    },
];

/**
 * Query a single Open*Facts database for a barcode.
 * All three databases share the same response envelope.
 *
 * @param {{ name: string, label: string, baseURL: string }} db
 * @param {string} barcode
 * @returns {Promise<object|null>} Simplified raw product or null
 */
const fetchFromSingleOpenDB = async (db, barcode) => {
    try {
        console.log(`[${db.label}] Querying for barcode ${barcode}…`);

        const { data } = await axios.get(`${db.baseURL}/${barcode}.json`, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                "User-Agent": "VyaparSathi/1.0 (contact@vyaparsathi.com)",
                "Accept": "application/json",
            },
            maxRedirects: 5,
        });

        // All Open*Facts return status=0 when product not found
        if (!data || data.status !== 1 || !data.product) {
            console.log(`[${db.label}] Not found for barcode ${barcode}`);
            return null;
        }

        const p = data.product;
        console.log(`[${db.label}] Found: "${p.product_name}" for barcode ${barcode}`);

        return {
            name: p.product_name || null,
            brand: p.brands || null,
            quantity: p.quantity || null,
            category: p.categories || null,
            image: p.image_url || null,
            source: db.name,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === "ECONNABORTED") {
                console.error(`[${db.label}] Timed out for barcode ${barcode}`);
            } else if (error.response) {
                console.error(`[${db.label}] HTTP ${error.response.status} for barcode ${barcode}`);
            } else {
                console.error(`[${db.label}] Network error for barcode ${barcode}:`, error.message);
            }
        } else {
            console.error(`[${db.label}] Unexpected error for barcode ${barcode}:`, error.message);
        }
        return null;
    }
};

/**
 * Try all Open*Facts databases in sequence:
 *   OpenFoodFacts → OpenBeautyFacts → OpenPetFoodFacts
 * Returns the first match found, or null if none have it.
 *
 * @param {string} barcode
 * @returns {Promise<object|null>}
 */
export const fetchFromOpenDatabases = async (barcode) => {
    for (const db of OPEN_DATABASES) {
        const result = await fetchFromSingleOpenDB(db, barcode);
        if (result) return result;
    }
    return null;
};

