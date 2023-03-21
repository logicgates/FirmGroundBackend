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
