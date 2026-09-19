import { env } from "../config/env.js";

export const notFoundMiddleware = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
};

export const errorMiddleware = (
  error,
  req,
  res,
  next
) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode =
    error.statusCode || 500;

  const response = {
    success: false,

    message:
      error.message ||
      "Internal server error",

    requestId: req.requestId,

    errors:
      error.errors || [],
  };

  if (env.nodeEnv === "development") {
    response.stack = error.stack;
  }

  return res
    .status(statusCode)
    .json(response);
};