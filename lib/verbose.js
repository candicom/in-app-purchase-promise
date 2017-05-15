'use strict';

let enabled = false;

module.exports.setup = function (config) {
	enabled = !!(config && config.verbose === true);
};

module.exports.log = function () {
	if (!enabled) {
		return;
	}
	let logs = [];
	logs.push('[' + Date.now() + '][VERBOSE]');
	for (let i in arguments) {
		logs.push(arguments[i]);
	}
	console.log.apply(console, logs);
};
