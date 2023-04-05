import jwt from 'jsonwebtoken';

export const authorizationUser = async (req, res, next) => {
  const token = req.headers['authorization']?.split('Bearer ')[1];
  if (!token) return res.status(401).send({ error: 'You are not authorized.' });
  try {
    const { user } = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.userInfo = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'You are not authorized.' });
  }
};