/**
 * Capitalize the first letter of each word in a string.
 *
 * @param {string} str
 * @returns {string}
 */
const toTitleCase = (str) => {
    if (!str) return str;
    return str
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

/**
 * Sanitize a raw string field: trim whitespace, return null if empty.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
const sanitize = (value) => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
};

/**
 * Generate a confidence score based on how complete the product data is.
 * Rules:
 *   name + brand + quantity present → 0.9
 *   name + brand present            → 0.75
 *   name only                       → 0.6
 *   else                            → 0.3
 *
 * @param {{ name: string|null, brand: string|null, quantity: string|null }} fields
 * @returns {number}
 */
const computeConfidence = ({ name, brand, quantity }) => {
    if (name && brand && quantity) return 0.9;
    if (name && brand) return 0.75;
    if (name) return 0.6;
    return 0.3;
};

/**
 * Normalize a raw product object from an external API into a standardized format.
 *
 * @param {object} raw  Raw product object (e.g. from OpenFoodFacts)
 * @returns {object}    Normalized product ready for DB insertion
 */
export const normalizeProduct = (raw) => {
    const name = toTitleCase(sanitize(raw.name));
    const brand = toTitleCase(sanitize(raw.brand));
    const quantity = sanitize(raw.quantity);
    const category = toTitleCase(sanitize(raw.category));
    const image = sanitize(raw.image);
    const source = sanitize(raw.source);

    const confidence = computeConfidence({ name, brand, quantity });

    return {
        name,
        brand,
        quantity,
        category,
        image,
        source,
        confidence,
    };
};
