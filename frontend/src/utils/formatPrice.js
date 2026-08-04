export const formatPrice = (price) => {
  const value = Number(price || 0);

  return Number.isInteger(value)
    ? value
    : value.toFixed(2);
};