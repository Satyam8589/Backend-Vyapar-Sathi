import { analyzeExcelHeadersWithGemini, executeBulkProductUpload, TARGET_FIELDS } from "./bulkUpload.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Endpoint to analyze Excel headers and map them to form fields using Gemini AI
 */
export const analyzeBulkHeadersController = async (req, res) => {
  try {
    const { headers, sampleRows } = req.body;

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      throw new ApiError("Headers must be a non-empty array", 400);
    }

    const result = await analyzeExcelHeadersWithGemini(headers, sampleRows || []);

    return res.status(200).json(
      new ApiResponse(
        {
          mapping: result.mapping,
          targetFields: TARGET_FIELDS,
          source: result.source,
          confidence: result.confidence,
        },
        "Headers analyzed successfully using Gemini AI",
        200
      )
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json(new ApiResponse(null, error.message, statusCode));
  }
};

/**
 * Endpoint to execute bulk insertion/update of products into Global Master and Store Inventory
 */
export const executeBulkUploadController = async (req, res) => {
  try {
    const { storeId, rows, columnMapping, stockUpdateMode } = req.body;
    const userId = req.user?._id;

    if (!storeId) throw new ApiError("storeId is required", 400);
    if (!rows || !Array.isArray(rows)) throw new ApiError("rows must be an array of objects", 400);
    if (!columnMapping || typeof columnMapping !== "object") {
      throw new ApiError("columnMapping must be an object matching form fields to excel headers", 400);
    }

    const result = await executeBulkProductUpload({
      storeId,
      userId,
      rows,
      columnMapping,
      stockUpdateMode: stockUpdateMode || "add",
    });

    return res.status(200).json(
      new ApiResponse(result, `Bulk upload completed: ${result.success} added, ${result.updated} updated, ${result.masterAdded} synced to master store.`, 200)
    );
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json(new ApiResponse(null, error.message, statusCode));
  }
};
