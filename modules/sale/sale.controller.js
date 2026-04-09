import { ApiResponse } from "../../utils/ApiResponse.js";
import { materializeSaleFromCart } from "./sale.service.js";

export const createSaleFromCartController = async (req, res) => {
  try {
    const result = await materializeSaleFromCart(req.params.cartId, req.user._id);

    res.status(result.saleCreated ? 201 : 200).json(
      new ApiResponse(
        {
          sale: result.sale,
          cart: result.cart,
          inventoryAdjusted: result.inventoryAdjusted,
          saleCreated: result.saleCreated,
        },
        result.saleCreated
          ? "Sale snapshot created successfully"
          : "Sale snapshot already exists",
        result.saleCreated ? 201 : 200
      )
    );
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiResponse(null, error.message, error.statusCode || 500));
  }
};
