/**
 * @description Encodes a given string in Base64 format and prefixes it with "Basic".
 * @param {string} str - The string to be encoded.
 * @returns {string} - The Base64 encoded string with "Basic" prefix.
 */
function encodeBase64(str) {
  // Encode the string to Base64
  const base64Encoded = Buffer.from(str).toString('base64');
  return base64Encoded;
}
module.exports = {
  encodeBase64,
};
