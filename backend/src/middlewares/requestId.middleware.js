import crypto from "crypto";

export const requestIdMiddleware = (req, res, next) => {
  const incomingRequestId = req.headers["x-request-id"];

  const requestId =
    incomingRequestId || crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader("X-Request-Id", requestId);

  next();
};