// Using import from '/filename', Webpack will
// bundle files from outside the docs directory
// even though it is the root for the server
// both locally and on GitHub Pages

import * as codebook from '@cipscis/codebook';

codebook.tidy();

codebook.run({
	testArg: 'test',
});

document.querySelector('.js-run-test-set')?.addEventListener('click', () => codebook.runSet('test', { testArg: 'test' }));
document.querySelector('.js-run-all-sets')?.addEventListener('click', () => codebook.run({ testArg: 'test' }));
