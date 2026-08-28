const { Chess } = require('chess.js'); const c = new Chess(); c.loadPgn('[Event "Live Chess"]\n\n1. e4 e5'); console.log(c.history());
