'use strict';

let constants = require('../constants');
let request = require('request');
let fs = require('fs');
let verbose = require('./verbose');

// for some reason amazon v2.0 RVS is 1.0....
let VER = '1.0';
let SECRET = '{sharedSecret}';
let UID = '{userId}';
let RID = '{receiptId}';
let ERRORS = {
	VALIDATION: {
		400: 'The transaction represented by this Purchase Token is no longer valid.',
		404: 'Unknown operation exception.',
		496: 'Invalid sharedSecret',
		497: 'Invalid User ID',
		498: 'Invalid Purchase Token',
		499: 'The Purchase Token was created with credentials that have expired, use renew to generate a valid purchase token.',
		500: 'There was an Internal Server Error'
	},
	RENEW: {
		400: 'Bad Request',
		404: 'Unknown operation exception.',
		496: 'Invalid sharedSecret',
		497: 'Invalid User ID',
		498: 'Invalid Purchase Token',
		500: 'There is an Internal Server Error'
	}
};

let VALIDATION_PATH = 'https://appstore-sdk.amazon.com/version/' +
	VER + '/verifyReceiptId/developer/' + SECRET + '/user/' + UID + '/receiptId/' + RID;
let RENEW_PATH = 'https://appstore-sdk.amazon.com/version/' +
	VER + '/renew/developer/' + SECRET + '/user/' + UID + '/receiptId/' + RID;

let S_VAL_PATH = VALIDATION_PATH;
let S_R_PATH = RENEW_PATH;

let NAME = '<Amazon>';

let config;

module.exports.readConfig = function (configIn) {
	config = configIn;
	verbose.setup(config);
};

module.exports.setup = function (cb) {
	if (!config || !config.secret) {
		return cb();
	}
	fs.exists(config.secret, function (exists) {
		let secret = '';
		if (!exists) {
			// use the string value literally
			secret = config.secret;
			VALIDATION_PATH = VALIDATION_PATH.replace(SECRET, config.secret);
			RENEW_PATH = RENEW_PATH.replace(SECRET, config.secret);
			verbose.log(NAME, 'Secret:', config.secret);
			return cb();
		}
		// assume it as a file path
		fs.readFile(config.secret, 'UTF-8', function (error, val) {
			if (error) {
				return cb(error);
			}
			secret = val.replace(/(\r|\n)/g, '');
			VALIDATION_PATH = VALIDATION_PATH.replace(SECRET, secret);
			RENEW_PATH = RENEW_PATH.replace(SECRET, secret);
			verbose.log(NAME, 'Secret:', secret);
			cb();
		});
	});
};

/*
receipt: {
	userId: <user ID amazon in-app-purchase-server responds with>
	receiptId: <receipt ID from amazon>
}
*/
module.exports.validatePurchase = function (dSecret, receipt, cb) {
	let rpath = RENEW_PATH;
	let path;

	// override secret with dSecret to allow dynamically fed secret to validate
	if (dSecret) {
		verbose.log(NAME, 'Use dynamically fed secret:', dSecret);
		rpath = S_R_PATH.replace(SECRET, dSecret);
		let vpath = S_VAL_PATH.replace(SECRET, dSecret);
		path = vpath.replace(UID, receipt.userId);
	} else {
		path = VALIDATION_PATH.replace(UID, receipt.userId);
	}
	path = path.replace(RID, receipt.receiptId);
	verbose.log(NAME, 'Validate:', path, receipt);
	send(path, ERRORS.VALIDATION, function (error, res) {
		if (error) {
			if (res === 499) {
				// must be renewed and re-tried
				let renew = rpath.replace(UID, receipt.userId);
				renew = renew.replace(RID, receipt.receiptId);
				verbose.log(NAME, 'Purchase must be renewed (' + res + '):', renew);
				send(renew, ERRORS.RENEW, function (error, renewed) {
					if (error) {
						let renewedErrorRes = {
							status: renewed,
							message: ERRORS.RENEW[renewed] || 'Unkown'
						};
						verbose.log(NAME, 'Failed to renew purchase:', renewedErrorRes);
						return cb(error, renewedErrorRes);
					}
					let renewedReceipt = {
						receiptId: renewed.purchaseToken,
						userId: receipt.userId
					};
					verbose.log(NAME, 'Purchase renewed:', renewedReceipt);
					module.exports.validatePurchase(renewedReceipt, cb);
				});
				return;
			}

			let errorRes = {
				status: res,
				message: ERRORS.VALIDATION[res] || 'Unknown'
			};
			verbose.log(NAME, 'Validation failed:', errorRes);
			return cb(error, errorRes);
		}
		verbose.log(NAME, 'Validation successful:', res);
		cb(null, res);
	});
};

module.exports.getPurchaseData = function (purchase) {
	if (!purchase || !purchase.purchaseToken) {
		return null;
	}
	let obj = {};
	obj.transactionId = purchase.receiptId;
	obj.productId = purchase.productId;
	obj.purchaseData = purchase.productType;
	obj.quantity = 1;
	obj.purchaseDate = purchase.purchaseDate || Date.now();
	obj.expirationDate = purchase.cancelDate || 0;
	return [obj];
};

function send(path, errorMap, cb) {
	request.get(path, function (error, response, body) {
		let errorMsg = errorMap[response.statusCode];
		if (errorMsg) {
			return cb(new Error(errorMsg + ': ' + path), response.statusCode);
		}
		if (error) {
			error.message += ': ' + path;
			return cb(error);
		}
		let res = JSON.parse(body);
		res.status = 0;
		res.service = constants.SERVICES.AMAZON;
		cb(null, res);
	});
}
