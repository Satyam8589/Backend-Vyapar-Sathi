import Store from "../../models/store.model.js";
import { ApiError } from "../../utils/ApiError.js";
import Product from "../../models/product.model.js";
import Employee from "../../models/employee.model.js";
import Role from "../../models/role.model.js";
import mongoose from "mongoose";

/**
 * Service to Create a new Store
 */
const createStore = async (storeData) => {
  try {
    if (!storeData.name || !storeData.owner) {
      throw new ApiError("Store name and owner ID are required", 400);
    }

    if (!storeData.address?.fullAddress) {
      throw new ApiError("Full address is required", 400);
    }

    if (!storeData.phone) {
      throw new ApiError("Phone number is required", 400);
    }

    const existingStore = await Store.findOne({
      owner: storeData.owner,
      name: storeData.name,
      isActive: true,
    });

    if (existingStore) {
      throw new ApiError(
        "A store with this name already exists for this owner",
        409,
      );
    }

    // Logic for permanent chronological shop number
    const totalStoreCountEver = await Store.countDocuments({ 
      owner: storeData.owner
    });
    
    storeData.seqNumber = totalStoreCountEver + 1;

    const store = await Store.create(storeData);
    return store;
  } catch (error) {
    throw error;
  }
};

/**
 * Service to get a single Store by ID
 */
const getStore = async (storeId) => {
  try {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new ApiError("Store not found", 404);
    }
    return store;
  } catch (error) {
    throw error;
  }
};

/**
 * Service to update Store details
 */
const updateStore = async (storeId, storeData) => {
  try {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new ApiError("Store not found", 404);
    }
    store.set(storeData);
    await store.save();
    return store;
  } catch (error) {
    throw error;
  }
};

/**
 * Service to soft-delete a Store
 */
const deleteStore = async (storeId) => {
  try {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new ApiError("Store not found", 404);
    }
    store.isActive = false;
    await store.save();
    return store;
  } catch (error) {
    throw error;
  }
};

/**
 * Service to get all stores for a user (Owned + Employee) with aggregated stats
 */
const getUserStores = async (userId) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Get stores owned by the user
    const ownedStores = await Store.aggregate([
      {
        $match: {
          owner: userObjectId,
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "store",
          as: "products",
        },
      },
      {
        $addFields: {
          totalProducts: {
            $size: {
              $filter: {
                input: "$products",
                as: "p",
                cond: { $eq: ["$$p.isActive", true] },
              },
            },
          },
          totalInventoryValue: {
            $reduce: {
              input: {
                $filter: {
                  input: "$products",
                  as: "p",
                  cond: { $eq: ["$$p.isActive", true] },
                },
              },
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $multiply: [
                      "$$this.price",
                      { $ifNull: ["$$this.quantity", 0] },
                    ],
                  },
                ],
              },
            },
          },
          userRole: "Owner",
          permissions: [], 
          isEmployee: false
        },
      },
      { $sort: { createdAt: 1 } }, 
      { $project: { products: 0 } },
    ]);

    // Ensure seqNumbers are populated for older stores if missing (Parallelized)
    await Promise.all(ownedStores.map(async (store) => {
      if (!store.seqNumber) {
        const rank = await Store.countDocuments({
          owner: store.owner,
          createdAt: { $lt: store.createdAt }
        });
        store.seqNumber = rank + 1;
      }
    }));

    // 2. Get stores where user is an active employee
    const activeEmployeeRecords = await Employee.find({ 
      user: userObjectId, 
      status: "active" 
    }).select("store role").populate("role");

    const employeeStoreIds = activeEmployeeRecords
      .map(r => r.store)
      .filter(id => id);

    let employeeStores = [];
    if (employeeStoreIds.length > 0) {
      employeeStores = await Store.aggregate([
        {
          $match: {
            _id: { $in: employeeStoreIds },
            isActive: true,
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "store",
            as: "products",
          },
        },
        {
          $addFields: {
            totalProducts: {
              $size: {
                $filter: {
                  input: "$products",
                  as: "p",
                  cond: { $eq: ["$$p.isActive", true] },
                },
              },
            },
            totalInventoryValue: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$products",
                    as: "p",
                    cond: { $eq: ["$$p.isActive", true] },
                  },
                },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $multiply: [
                        "$$this.price",
                        { $ifNull: ["$$this.quantity", 0] },
                      ],
                    },
                  ],
                },
              },
            },
            isEmployee: true
          },
        },
        { $project: { products: 0 } },
      ]);

      // Attach roles, permissions and sync seqNumber for employee view
      const employeeStoresWithRanking = await Promise.all(employeeStores.map(async (store) => {
        const record = activeEmployeeRecords.find(r => r.store.toString() === store._id.toString());
        
        let displaySeq = store.seqNumber;
        
        if (!displaySeq) {
          const rank = await Store.countDocuments({
            owner: store.owner,
            createdAt: { $lt: store.createdAt }
          });
          displaySeq = rank + 1;
        }

        return {
          ...store,
          seqNumber: displaySeq,
          userRole: record.role?.name || "Employee",
          permissions: record.role?.permissions || [],
        };
      }));

      employeeStores = employeeStoresWithRanking;
    }

    // Combine and deduplicate
    const allStores = [...ownedStores, ...employeeStores];
    const uniqueStores = Array.from(new Map(allStores.map(s => [s._id.toString(), s])).values());

    return uniqueStores;
  } catch (error) {
    throw error;
  }
};

/**
 * Legacy Alias for backward compatibility with older tests
 */
const getStoresByOwner = getUserStores;

export {
  createStore,
  getStore,
  updateStore,
  deleteStore,
  getUserStores,
  getStoresByOwner
};
