'use strict';

// i am only doing this to minimize the risk of dependencies...

module.exports.forEach = function (list, handler, done) {
	// counter of finished tasks
	let counter = 0;
	let len = list.length;

	if (!len) {
		return done();
	}

	let iterator = function (i, list, handler, done) {
		let item = list[i];
		handler(item, function (error) {
			if (error) {
				return done(error);
			}
			counter += 1;
			if (counter === len) {
				done();
			}
		});
	};
	for (let i = 0; i < len; i++) {
		iterator(i, list, handler, done);
	}
};

module.exports.each = module.exports.forEach;

module.exports.eachSeries = function (list, handler, done) {

	if (!list.length) {
		return done();
	}

	iteratorSeries(0, list, handler, done);
};

module.exports.parallel = function (list, done) {
	let counter = 0;
	let len = list.length;

	done = done || function () {};

	if (!len) {
		return done();
	}

	let iterator = function (i, list, done) {
		let handler = list[i];
		handler(function (error) {
			if (error) {
				return done(error);
			}
			counter += 1;
			if (counter === len) {
				done();
			}
		});
	};
	for (let i = 0; i < len; i++) {
		iterator(i, list, done);
	}
};

module.exports.series = function (list, done) {

	if (!list.length) {
		return done();
	}

	handlerSeries(0, list, done);
};

function iteratorSeries(i, list, handler, done) {
	let item = list[i];
	handler(item, function (error) {
		if (error) {
			return done(error);
		}
		i += 1;
		if (i === list.length) {
			return done();
		}
		iteratorSeries(i, list, handler, done);
	});
}

function handlerSeries(i, list, done) {
	let handler = list[i];
	handler(function (error) {
		if (error) {
			return done(error);
		}
		i += 1;
		if (i === list.length) {
			return done();
		}
		handlerSeries(i, list, done);
	});
}
