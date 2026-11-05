import { createRemoteJWKSet, jwtVerify } from 'jose';
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const publicKeys = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

// Put verifyToken before a route to make it private.
export async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'Please log in to continue.' });
  }

  try {
    const { payload } = await jwtVerify(token, publicKeys, {
      issuer: clientUrl,
      audience: clientUrl,
    });
    // Routes use req.user to know who is logged in
    req.user = {
      email: payload.email,
      name: payload.name,
      image: payload.image,
    };
    next();
  } catch (error) {
    res
      .status(401)
      .send({ message: 'Your session has expired. Please log in again.' });
  }
}
