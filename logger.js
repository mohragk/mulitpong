const make_yellow = (str) => '\x1b[33m' + str + '\x1b[0m';
const make_green = (str) => '\x1b[32m' + str + '\x1b[0m';
const dim = (str) => '\x1b[2m' + str + '\x1b[0m';

var Logger = function(prefix) {
    this.prefix = prefix;
}

Logger.prototype.log = function() {
        
    // 1. Convert args to a normal array
    let args = Array.prototype.slice.call(arguments);
        
    // prepend date and time

    // 2. Prepend log prefix log string
    args.unshift(this.prefix + '\t');

    args.unshift(dim( new Date().toISOString() ));
    
        
    // 3. Pass along arguments to console.log
    console.log.apply(console, args);        
}


module.exports = {Logger, make_green, make_yellow, dim};