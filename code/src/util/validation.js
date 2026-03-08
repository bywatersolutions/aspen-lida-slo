/**
 * Validation utility functions
 */

/**
 * Check if a string is a valid URL
 * @param {string} string - The string to validate
 * @returns {boolean} - True if valid URL, false otherwise
 */
export const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    return false;
  }
};