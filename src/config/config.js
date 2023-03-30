export const errorMessage = (res, error) => {
  if (error) {
    if (error?.message) return res.status(400).send({ error: error?.message });
    if (error?.errors[0])
      return res.status(400).send({ error: error?.errors[0] });
    for (const element in error.errors) {
      return res.status(400).send({ error: error.errors[element]?.message });
    }
  } else {
    return res
      .status(500)
      .send({ error: 'Something went wrong please try again later.' });
  }
};

export const generateRandomString = (n) => {
  let randomString = '';
  let characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < n; i++) {
    randomString += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return randomString;
};
