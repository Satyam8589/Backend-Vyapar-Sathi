import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    nameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    categorySnapshot: {
      type: String,
      trim: true,
      default: "General",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    unitBuyingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
      unique: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      default: null,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: "Walk-in Customer",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    customerEmail: {
      type: String,
      trim: true,
      default: "",
    },
    items: {
      type: [saleItemSchema],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "At least one sale item is required",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    discount: {
      type: {
        type: String,
        enum: ["fixed", "percent"],
        default: "fixed",
      },
      value: {
        type: Number,
        default: 0,
      },
      amount: {
        type: Number,
        default: 0,
      },
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "paid",
      index: true,
    },
    paymentId: {
      type: String,
      trim: true,
      default: null,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "cash",
    },
    completedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ store: 1, completedAt: -1 });
saleSchema.index({ "items.productId": 1, completedAt: -1 });
saleSchema.index({ store: 1, buyer: 1 });

saleSchema.pre('save', function() {
    if (this.isNew && this.paidAmount === 0 && this.paymentStatus === 'paid') {
       // Backward compatibility for existing logic
       this.paidAmount = this.totalAmount;
    }
    
    if (this.paidAmount >= this.totalAmount) {
        this.paymentStatus = 'paid';
    } else if (this.paidAmount > 0) {
        this.paymentStatus = 'partial';
    } else {
        this.paymentStatus = 'unpaid';
    }
    
    // Automatically calculate due amount
    this.dueAmount = Math.max(0, this.totalAmount - this.paidAmount);
});

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
