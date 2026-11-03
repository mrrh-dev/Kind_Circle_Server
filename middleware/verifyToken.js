import { createRemoteJWKSet, jwtVerify } from 'jose';

const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const publicKeys = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res
      .status(401)
      .send({
        message: 'Please log in to continue. No access token was sent.',
      });
  }

  let payload;
  try {
    const result = await jwtVerify(token, publicKeys, {
      issuer: clientUrl,
      audience: clientUrl,
    });
    payload = result.payload;
  } catch (error) {
    return res
      .status(401)
      .send({
        message: 'Your session has expired or is invalid. Please log in again.',
      });
  }

  if (!payload.email) {
    return res
      .status(401)
      .send({
        message: 'Your access token has no email. Please log in again.',
      });
  }

  req.user = {
    id: payload.id || payload.sub,
    email: String(payload.email).toLowerCase(),
    name: payload.name || 'Community member',
    image: payload.image || '',
  };
  next();
};
