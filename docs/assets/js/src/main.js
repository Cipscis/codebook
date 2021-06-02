// Using import from '/filename', Webpack will
// bundle files from outside the docs directory
// even though it is the root for the server
// both locally and on GitHub Pages

import foo from '/main.js';

foo('example code goes here');
