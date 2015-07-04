# mutapipe [![Build Status](https://travis-ci.org/nikaspran/mutapipe.svg?branch=master)](https://travis-ci.org/nikaspran/mutapipe)

A library for creating modifiable streams, useful in Gulp. Inspired by [lazypipe](https://github.com/OverZealous/lazypipe/).

## Installation

```
npm install mutapipe --save
```

## Usage

Supports the same basic API as [lazypipe](https://github.com/OverZealous/lazypipe/).

```js
var mutapipe = require('mutapipe'),
  by = mutapipe.by;

var pipeline = mutapipe()
  .pipe(jshint)
  .pipe(jshint.reporter, 'jshint-stylish');

pipeline = pipeline.replace(by.task(jshint.reporter)).with(jshint.reporter, 'default');
```

For more examples see [tests](lib/mutapipe.spec.js).

## Contributing

Make sure `gulp build` passes, otherwise try to maintain similar code style.

## License

MIT
