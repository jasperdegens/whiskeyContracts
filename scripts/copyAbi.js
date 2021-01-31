const fs = require('fs-extra');

fs.copy('./artifacts/contracts/', './../frontend/whiskey-coin/src/contracts', err => {
    console.log(err);
});