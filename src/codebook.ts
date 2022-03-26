type CodebookSetArgs<Name extends string = string, Value = any> = Record<Name, Value>;
interface CodebookSet {
	blocks: HTMLElement[],
	args: CodebookSetArgs,
}

const selectors = Object.freeze({
	block: '.js-codebook__block',
	set: '.js-codebook__set',

	inert: '.js-codebook__inert',
} as const);

const dataAttributes = Object.freeze({
	set: 'data-codebook-set',
	index: 'data-codebook-index',

	log: 'data-codebook-log',
	html: 'data-codebook-html',
} as const);

const defaultSetName = 'default';

// Create a single textarea element for decoding HTML
const $textarea = document.createElement('textarea');

/**
 * Run all Codebook blocks in all Codebook sets in order, with any specified external arguments made available.
 */
export function run(args?: CodebookSetArgs): Promise<void[]> {
	return new Promise((resolve, reject) => {
		const sets = _createCodeSets(args);
		const promises: Promise<any>[] = [];

		for (let setName in sets) {
			const set = sets[setName];

			promises.push(_runSet(set));
		}

		Promise.all(promises)
			.then(resolve)
			.catch(reject);
	});
}

/**
 * Run all blocks in a specific Codebook set, with any specified external arguments made available.
 */
export async function runSet(setName: string, args?: CodebookSetArgs): Promise<void>
/**
 * Run all blocks in the default Codebook set, with any specified external arguments made available.
 */
export async function runSet(args?: CodebookSetArgs): Promise<void>
export async function runSet(setNameOrArgs?: string | CodebookSetArgs, argsParam?: CodebookSetArgs): Promise<void> {
	let setName: string;
	let args: CodebookSetArgs | undefined = undefined;

	// Figure out which arguments were passed.
	if (typeof setNameOrArgs === 'string') {
		setName = setNameOrArgs;
		if (argsParam) {
			args = argsParam;
		}
	 } else {
		// If no set name was specified, use the default set name.
		setName = defaultSetName;
		if (setNameOrArgs) {
			args = setNameOrArgs;
		}
	}

	const sets = _createCodeSets(args);

	if (setName in sets) {
		const set = sets[setName];

		return _runSet(set);
	} else {
		throw new RangeError(`Codebook: Cannot run unrecognised set '${setName}'`);
	}
}

/**
 * Adjust the indentation of Codebook sets so it appears correctly when viewed on a page.
 */
export function tidy() {
	const $blocks = document.querySelectorAll(`${selectors.block}, ${selectors.inert}`);

	for (let $block of $blocks) {
		const code = $block.innerHTML;
		// Look for tab indentation only
		const match = code.match(/^(\t*)\S/m);

		if (match) {
			const indentation = match[1];
			const level = indentation.length;
			const pattern = new RegExp(`^\\t{${level}}`, 'gm');

			$block.innerHTML = code.replace(pattern, '').trim();
		}
	};
}

/**
 * Gathers all Codebook sets, and sorts blocks within their sets according to their index where applicable.
 */
function _createCodeSets(args?: CodebookSetArgs) {
	const sets = _gatherSetBlocks(args);

	// Loop through created sets and sort their blocks by index
	for (let setName in sets) {
		const set = sets[setName];
		_sortCodeBlocks(set);
	};

	return sets;
}

/**
 * Gathers all Codebook blocks according to the order in which they appear in the markup,
 * and adds them to the set they belong to.
 */
function _gatherSetBlocks(args?: CodebookSetArgs): Record<string, CodebookSet> {
	const $blocks = document.querySelectorAll<HTMLElement>(selectors.block);
	const setNames: string[] = [];
	const sets: Record<string, CodebookSet> = {};

	// Loop through all elements and add them to the right set
	for (let $block of $blocks) {
		const setName = _getSetName($block);
		let set: CodebookSet;

		if (setNames.includes(setName)) {
			set = sets[setName];
		} else {
			setNames.push(setName);

			set = _createNewSet(args);
			sets[setName] = set;
		}

		set.blocks.push($block);
	};

	return sets;
}

/**
 * Sorts Codebook blocks according to their index data attribute, if they have one.
 */
function _sortCodeBlocks(set: CodebookSet) {
	// If any blocks have an explicit index, sort them
	set.blocks.sort(($blockA, $blockB) => {
		const iA = $blockA.getAttribute(dataAttributes.index);
		const iB = $blockB.getAttribute(dataAttributes.index);

		if (iA === iB) {
			return 0; // Leave the order unchanged
		} else if (iA !== null && iB === null) {
			return -1; // Put $blockA first
		} else if (iA === null && iB !== null) {
			return +1; // Put $blockB first
		} else {
			// Neither index is null
			return (+iA!) - (+iB!); // Put the code with the lower index first
		}
	});
}

/**
 * Creates a new Codebook set.
 */
function _createNewSet(args?: CodebookSetArgs): CodebookSet {
	args = args || {};

	return {
		blocks: [],
		args: Object.assign({}, args),
	};
}

/**
 * Clears a set's logs, then runs each block within it with the `log` and `html` utility functions available.
 */
function _runSet(set: CodebookSet) {
	const code = set.blocks.reduce(_combineCode, '');

	_clearLogs(set);

	const args = set.args;
	const [argNames, argValues] = _spreadArgs(args);

	console.log(argNames);
	if (
		argNames.includes('_log') ||
		argNames.includes('_$log') ||
		argNames.includes('log') ||
		argNames.includes('_html') ||
		argNames.includes('_$html') ||
		argNames.includes('html')
	) {
		throw new Error(`Codebook: The following argument names are reserved and cannot be used:\n'_log', '_$log', 'log', '_html', '_$html', 'html'`);
	}

	const fnFactory = Function.apply(null, argNames.concat(['_log', '_html', `
		return async () => {
			'use strict';

			let _$log = null;
			let log = function () {};

			let _$html = null;
			let html = function () {};

			${code}
		};
	`]));

	const fn: () => Promise<any> = fnFactory.apply(null, argValues.concat([_logOutput, _htmlOutput]));

	return fn();
}

/**
 * Clears the contents of all log elements for each block in a given Codebook set.
 */
function _clearLogs(set: CodebookSet) {
	for (let $block of set.blocks) {
		const logId = $block.getAttribute(dataAttributes.log);

		if (logId) {
			const $log = document.getElementById(`${logId}`);

			if ($log) {
				$log.innerHTML = '';
			}
		}
	}
}

/**
 * Converts a CodebookSetArgs object into separate arrays of its arguments' names and values.
 */
function _spreadArgs<Name extends string, Value extends any> (args: CodebookSetArgs<Name, Value>): [Name[], Value[]] {
	const names: Name[] = Object.keys(args) as Name[];
	const values: Value[] = Object.values(args);

	return [
		names,
		values,
	];
}

/**
 * To be used with `Array.prototype.reduce`, combines the code for all blocks within
 * a Codebook set and ensures the special `log` and `html` functions always have correct values.
 */
function _combineCode(allCode: string, $newCode: HTMLElement) {
	let newCode = _decodeHtml($newCode.textContent || '');

	const logId = $newCode.getAttribute(dataAttributes.log);
	if (logId) {
		newCode = `
			_$log = document.getElementById('${logId}');
			log = function (...output) {
				_log(_$log, ...output);
			};

			${newCode}

			log = function () {};
		`;
	}

	const htmlId = $newCode.getAttribute(dataAttributes.html);
	if (htmlId) {
		newCode = `
			_$html = document.getElementById('${htmlId}');
			html = function (output) {
				_html(_$html, output);
			};

			${newCode}

			html = function () {};
		`;
	}

	const combinedCode = `${allCode}\n${newCode}`;

	return combinedCode;
}

/**
 * Read the name of a Codebook block's set.
 */
function _getSetName($block: HTMLElement): string {
	let setName = $block.getAttribute(dataAttributes.set);

	if (!setName) {
		const $parent = $block.closest(selectors.set);

		if ($parent) {
			setName = $parent.getAttribute(dataAttributes.set);
		}

		if (!setName) {
			setName = defaultSetName;
		}
	}

	return setName;
}

/**
 * A helper function used to create the special `log` function, allowing values inside
 * Codebook blocks to be logged to that block's log element.
 */
function _logOutput($log: HTMLElement, ...output: any[]) {
	if ($log) {
		output.forEach((outputEl) => {
			let outputString: string;

			if (outputEl instanceof Date) {
				function padZeroes(num: number, minLength = 2): string {
					let numStr = num.toString();

					while (numStr.length < minLength) {
						numStr = `0${numStr}`;
					}

					return numStr;
				}

				const year = outputEl.getFullYear();
				const month = padZeroes(outputEl.getMonth() + 1);
				const day = padZeroes(outputEl.getDate());

				outputString = `${year}-${month}-${day}`;

				if (outputEl.getHours() || outputEl.getMinutes() || outputEl.getSeconds()) {
					const hours = padZeroes(outputEl.getHours());
					const minutes = padZeroes(outputEl.getMinutes());
					const seconds = padZeroes(outputEl.getSeconds());
					outputString += ` ${hours}:${minutes}:${seconds}`;
				}
			} else if (typeof outputEl === 'object') {
				outputString = JSON.stringify(outputEl, null, '\t');
			} else if (typeof outputEl === 'string') {
				outputString = outputEl;
			} else {
				// Can't rely on everything having a `toString` method, so use type coercion.
				outputString = '' + outputEl;
			}

			$log.innerHTML += `${outputString}\n`;
		});
	}
}

/**
 * A helper function used to create the special `html` function, allowing values inside
 * Codebook blocks to be logged to that block's html element.
 */
function _htmlOutput($html: HTMLElement, output: string) {
	if ($html) {
		$html.innerHTML = output;
	}
}

/**
 * Decode HTML entities in a string by applying it as the value
 * of an HTMLTextAreaElement then reading it back again.
 */
function _decodeHtml(htmlString: string): string {
	// We don't want to see things like =&gt; in code when we really mean =>
	$textarea.innerHTML = htmlString;

	const decodedString = $textarea.value;

	return decodedString;
}
