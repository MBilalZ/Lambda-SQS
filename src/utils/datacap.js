const axios = require('axios');
const { encode } = require('./index');
const logger = require('../config/logger');

/**
 * 
 * @param {*} mid The Merchant ID for the academy, will be part of the 
 * @param {*} apiPrivateKey The private ID , will come from transaction. Testing one: OSKO3ZLm-ytiQ0WM3aqs1cUXAp-x4POJUTA_-ZezG8-yQluCpYa81kyyOatSxxxCMkTAoOzORWXwrgWIJRwPGw
 * @param {*} path Path to complete sale: /credit/sale
 * @param {*} payload {
        Token: token, //Comes from the transaction last payment attempt thatw as successfull
        Amount: totalAmount.toFixed(2), //Comes from the recurrence attribute of the transaction
        InvoiceNo: invoiceNo, //Comes from the last payment attempt, increment last number 
        RefNo: invoiceNo, //Same as invoice
        RecurringData: recurringData, //Comes from the transaction last payment attempt thatw as successfull
      }
 * @returns return value from Datacap
 */

async function postDatacap(mid, apiPrivateKey, path, payload) {
  const url = process.env.DATA_CAP_BASE_URL + path;
  logger.info(url);
  logger.info('Posting payload to[' + url + ']: ');
  logger.info(payload);
  logger.info('Posting with key: ' + mid + ':' + apiPrivateKey);
  const authorization =
    'Basic ' + encode.encodeBase64(mid + ':' + apiPrivateKey); //This is an external library, add new one or import via NPM
  logger.info(
    'Using Authorization header with MID[' + mid + ']: ',
    authorization
  );
  //console.log("Encoded Auth key: ", authorization);
  let options = {
    method: 'POST',
    url: url,
    data: payload,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'BJJLINK/2.0.4',
      Accept: 'application/json',
      Authorization: authorization,
    },
    json: true, // Automatically stringifies the body to JSON
  };

  return new Promise(async function (resolve, reject) {
    try {
      let response = await axios(options);
      logger.info('Success response from datacap: ', response);
      resolve(response);
    } catch (error) {
      logger.error('Error posting to datacap: ').error(error.status);
      logger.info(error.response.data);
      resolve(error?.response);
    }
  });
}
module.exports = {
  postDatacap,
};
