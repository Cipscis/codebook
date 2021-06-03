const selectors = Object.freeze({
	code: '.js-codebook__code',
	source: '.js-codebook__source',
	style: '.js-codebook__style',
	set: '.js-codebook__set',
});

const dataSelectors = Object.freeze({
	set: 'data-codebook-set',
	index: 'data-codebook-index',

	log: 'data-codebook-log',
	chart: 'data-codebook-chart',
});

const module = {
	run: function (args) {
		args = args || {};

		module._tidyCode();

		let sets = module._createCodeSets(args);

		if (sets[null]) {
			// Code without a set runs first, and is available to all sets
			module._runNullSet(sets[null]);
		}

		for (let setName in sets) {
			if (setName === null) {
				continue;
			}

			let set = sets[setName];

			module._runSet(set);
		}
	},

	_tidyCode: function () {
		// Adjust indentation so it appears correctly on the page
		let $code = document.querySelectorAll(`${selectors.code}, ${selectors.source}, ${selectors.style}`);

		$code.forEach($el => {
			let code = $el.innerHTML;
			// Look for tab indentation only
			let match = code.match(/^(\t*)\S/m);

			if (match) {
				let indentation = match[1];
				let level = indentation.length;
				let pattern = new RegExp(`^\\t{${level}}`, 'gm');

				$el.innerHTML = code.replace(pattern, '').trim();
			}
		});
	},

	_createCodeSets: function (args) {
		let $code = document.querySelectorAll(`${selectors.code}, ${selectors.source}`);
		let setNames = [];
		let sets = {};

		$code.forEach($el => {
			let setName = module._getSetName($el);
			let set;
			if (setNames.indexOf(setName) === -1) {
				setNames.push(setName);

				set = module._newSet(args);
				sets[setName] = set;
			} else {
				set = sets[setName];
			}

			if ($el.matches(selectors.source)) {
				set.source.push($el);
			} else {
				set.code.push($el);
			}
		});

		for (let setName in sets) {
			let set = sets[setName];

			// If any sets have an explicit index, sort them
			set.code.sort(($codeA, $codeB) => {
				let iA = $codeA.getAttribute(dataSelectors.index);
				let iB = $codeB.getAttribute(dataSelectors.index);

				if (iA === iB) {
					return 0; // Leave the order unchanged
				} else if (iA !== null && iB === null) {
					return -1; // Put $codeA first
				} else if (iA === null && iB !== null) {
					return +1; // Put $codeB first
				} else {
					// Neither index is null
					return iA - iB; // Put the code with the lower index first
				}
			});
		};

		return sets;
	},

	_newSet: function (args) {
		return {
			source: [],
			code: [],
			args,
		};
	},

	_runNullSet: function (set) {
		// Null sets have no log or chart functions, or "source" snippets

		let code = set.code.reduce(module._combineCode, '');

		let nullFn = new Function (code);

		nullFn();
	},

	_runSet: function (set) {
		let code = set.code.reduce(module._combineCode, '');
		let source = set.source.reduce(module._combineCode, '');
		let args = set.args;

		let argNames = [];
		let argValues = [];
		for (let argName in args) {
			let arg = args[argName];

			argNames.push(argName);
			argValues.push(arg);
		}

		// TODO: Uncouple from Charter etc.
		// TODO: Allow custom arguments to be passed through
		let fileLoadedFnFactory = Function.apply(null, argNames.concat(['_log', '_chart', `
			return function (_data) {
				'use strict';

				let _$log = null;
				let log = function () {};

				let _$chart = null;
				let chart = function () {};

				if (_data) {
					var rows = _data.rows;
					var cols = _data.cols;
					var enums = _data.enums;
					var aliases = _data.aliases;
				}

				${code}
			}
		`]));

		let fileLoadedFn = fileLoadedFnFactory.apply(null, argValues.concat([module._logOutput, module._chartOutput]));

		// TODO: Uncouple from Charter etc.
		// TODO: Allow some blocks to be delayed until after a Promise resolves
		if (source) {
			let loadSrcFn = new Function ('analyseData', source);
			loadSrcFn(fileLoadedFn);
		} else {
			fileLoadedFn();
		}
	},

	_combineCode: function (allCode, $newCode) {
		let newCode = module._decodeHtml($newCode.innerHTML);

		let logId = $newCode.getAttribute(dataSelectors.log);
		if (logId) {
			newCode = `
				_$log = document.getElementById('${logId}');
				log = function (...output) {
					_log(output, _$log);
				};

				${newCode}

				log = function () {};
			`;
		}

		let chartId = $newCode.getAttribute(dataSelectors.chart);
		if (chartId) {
			newCode = `
				_$chart = document.getElementById('${chartId}');
				chart = function (output) {
					_chart(output, _$chart);
				};

				${newCode}

				chart = function () {};
			`;
		}

		let combinedCode = `${allCode}\n${newCode}`;

		return combinedCode;
	},

	_getSetName: function ($el) {
		let setName = $el.getAttribute(dataSelectors.set);

		if (!setName) {
			let $parent = $el.closest(selectors.set);

			if ($parent) {
				setName = $parent.getAttribute(dataSelectors.set);
			}
		}

		return setName;
	},

	_logOutput: function (output, $log) {
		if ($log) {
			if (Array.isArray(output)) {
				output.forEach(el => module._logOutput(el, $log));
				return;
			}

			let outputString;

			if (output instanceof Date) {
				outputString = `${output.getFullYear()}-${output.getMonth() + 1}-${output.getDate()}`;

				if (output.getHours() || output.getMinutes() || output.getSeconds()) {
					outputString += ` ${output.getHours()}:${output.getMinutes()}:${output.getSeconds()}`;
				}
			} else if (typeof output === 'object') {
				outputString = JSON.stringify(output, null, '\t');
			} else {
				outputString = output;
			}

			$log.innerHTML += `${outputString}\n`;
		}
	},

	_chartOutput: function (output, $chart) {
		if ($chart) {
			$chart.innerHTML = output;
		}
	},

	_decodeHtml: function (htmlString) {
		// We don't want to see things like =&gt; in code when we really mean =>

		let $textarea = document.createElement('textarea');
		$textarea.innerHTML = htmlString;

		let decodedString = $textarea.value;

		return decodedString;
	}
};

const codebook = {
	run: module.run,
};

export default codebook;
