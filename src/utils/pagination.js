export const paginateQuery = async (Model, query = {}, options = {}) => {
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 10;
  const sort = options.sort || '-createdAt';
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Model.find(query).sort(sort).skip(skip).limit(limit),
    Model.countDocuments(query)
  ]);

  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};
