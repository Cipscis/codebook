// Using import from '/filename', Webpack will
// bundle files from outside the docs directory
// even though it is the root for the server
// both locally and on GitHub Pages

import codebook from '/codebook.js';

codebook.tidy();

codebook.runSet('test', {
	testArg: 'test',
});
