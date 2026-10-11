

export const ApiResponse = class ApiResponse {
    constructor(data, message = "Success", statusCode = 200) {
        this.success = statusCode < 400;
        this.data = data;
        this.message = message;
        this.statusCode = statusCode;
    }
};