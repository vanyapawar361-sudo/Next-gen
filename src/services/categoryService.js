/**
 * Manages allowed document categories for the company knowledge base.
 */
const ALLOWED_CATEGORIES = [
  'Employee',
  'Admin'
];

module.exports = {
  isValidCategory: (category) => ALLOWED_CATEGORIES.includes(category),
  getCategories: () => ALLOWED_CATEGORIES
};
