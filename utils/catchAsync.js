const catchAsync = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export default catchAsync;
