import { getGRNs, getGRNById } from './grn.service.js';

export const getGRNsController = async (req, res) => {
    try {
        const { storeId } = req.params;
        const filters = req.query;
        const grns = await getGRNs(storeId, filters);
        res.status(200).json({ success: true, data: grns });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getGRNByIdController = async (req, res) => {
    try {
        const { storeId, id } = req.params;
        const grn = await getGRNById(storeId, id);
        res.status(200).json({ success: true, data: grn });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};
