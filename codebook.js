const selectors = Object.freeze({
	code: '.js-codebook__code',
	set: '.js-codebook__set',

	inert: '.js-codebook__inert',
});

const dataAttributes = Object.freeze({
	set: 'data-codebook-set',
	index: 'data-codebook-index',

	log: 'data-codebook-log',
	html: 'data-codebook-html',
});

// Create a single textarea element for decoding HTML
const $textarea = document.createElement('textarea');

const module = {
	run: function (args) {
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

	runSet: function (setName, args) {
		let sets = module._createCodeSets(args);

		if (setName in sets) {
			let set = sets[setName];

			module._runSet(set);
		}
	},

	tidy: function () {
		// Adjust indentation so it appears correctly on the page
		let $code = document.querySelectorAll(`${selectors.code}, ${selectors.inert}`);

		for (let $el of $code) {
			let code = $el.innerHTML;
			// Look for tab indentation only
			let match = code.match(/^(\t*)\S/m);

			if (match) {
				let indentation = match[1];
				let level = indentation.length;
				let pattern = new RegExp(`^\\t{${level}}`, 'gm');

				$el.innerHTML = code.replace(pattern, '').trim();
			}
		};
	},

	_createCodeSets: function (args) {
		let sets = module._gatherSetBlocks(args);

		// Loop through created sets and sort their blocks by index
		for (let setName in sets) {
			let set = sets[setName];
			module._sortCodeBlocks(set);
		};

		return sets;
	},

	_gatherSetBlocks: function (args) {
		let $code = document.querySelectorAll(selectors.code);
		let setNames = [];
		let sets = {};

		// Loop through all elements and add them to the right set
		for (let $el of $code) {
			let setName = module._getSetName($el);
			let set;
			if (setNames.indexOf(setName) === -1) {
				setNames.push(setName);

				set = module._newSet(args);
				sets[setName] = set;
			} else {
				set = sets[setName];
			}

			set.code.push($el);
		};

		return sets;
	},

	_sortCodeBlocks: function (set) {
		// If any blocks have an explicit index, sort them
		set.code.sort(($codeA, $codeB) => {
			let iA = $codeA.getAttribute(dataAttributes.index);
			let iB = $codeB.getAttribute(dataAttributes.index);

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
	},

	_newSet: function (args) {
		args = args || {};

		return {
			code: [],
			args: Object.assign({}, args),
		};
	},

	_runNullSet: function (set) {
		// TODO: Allow null set to have output methods
		// Null sets have no output methods

		let code = set.code.reduce(module._combineCode, '');

		let nullFn = new Function (code);

		nullFn();
	},

	_runSet: function (set) {
		let code = set.code.reduce(module._combineCode, '');
		let args = set.args;

		let [argNames, argValues] = module._spreadArgs(args);

		let fnFactory = Function.apply(null, argNames.concat(['_log', '_html', `
			return async () => {
				'use strict';

				let _$log = null;
				let log = function () {};

				let _$html = null;
				let html = function () {};

				${code}
			};
		`]));

		let fn = fnFactory.apply(null, argValues.concat([module._logOutput, module._htmlOutput]));

		fn();
	},

	_spreadArgs: function (args) {
		// Takes in an object and spreads it into
		// an array of names and an array of values

		let names = [];
		let values = [];

		for (let name in args) {
			let arg = args[name];

			names.push(name);
			values.push(arg);
		}

		return [
			names,
			values,
		];
	},

	_combineCode: function (allCode, $newCode) {
		let newCode = module._decodeHtml($newCode.innerHTML);

		let logId = $newCode.getAttribute(dataAttributes.log);
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

		let htmlId = $newCode.getAttribute(dataAttributes.html);
		if (htmlId) {
			newCode = `
				_$html = document.getElementById('${htmlId}');
				html = function (output) {
					_html(output, _$html);
				};

				${newCode}

				html = function () {};
			`;
		}

		let combinedCode = `${allCode}\n${newCode}`;

		return combinedCode;
	},

	_getSetName: function ($el) {
		let setName = $el.getAttribute(dataAttributes.set);

		if (!setName) {
			let $parent = $el.closest(selectors.set);

			if ($parent) {
				setName = $parent.getAttribute(dataAttributes.set);
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

	_htmlOutput: function (output, $html) {
		if ($html) {
			$html.innerHTML = output;
		}
	},

	_decodeHtml: function (htmlString) {
		// We don't want to see things like =&gt; in code when we really mean =>
		$textarea.innerHTML = htmlString;

		let decodedString = $textarea.value;

		return decodedString;
	}
};

const codebook = {
	run: module.run,
	runSet: module.runSet,

	tidy: module.tidy,
};

export default codebook;
