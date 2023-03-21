import { errorMessage } from '../../config/config.js';

export const register = (req, res) => {
  try {
    res.status(201).send('User registration');
  } catch (error) {
    errorMessage(error);
  }
};
