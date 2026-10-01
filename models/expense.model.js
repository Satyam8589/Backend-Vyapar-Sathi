import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store reference is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Expense title is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Expense category is required'],
        enum: [
            'Rent', 
            'Electricity', 
            'Salary', 
            'Transport', 
            'Maintenance', 
            'Marketing', 
            'Internet', 
            'Packaging', 
            'Other'
        ],
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Expense amount is required'],
        min: [0.01, 'Amount must be greater than 0']
    },
    paymentMethod: {
        type: String,
        required: [true, 'Payment method is required'],
        enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other']
    },
    date: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for faster querying by store and date
expenseSchema.index({ store: 1, date: -1 });

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
