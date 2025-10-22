import jwt from "jsonwebtoken";

// Generate access token with 24-hour expiration
export const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRY || '24h' }
  );
};

// Generate refresh token (for future use)
export const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
  );
};

// Verify and decode JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken
};
