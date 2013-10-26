/*global env: true, expect: true, runs: true, waits: true */
var fs = require('jsdoc/fs');
var path = require('jsdoc/path');
var util = require('util');

var hasOwnProp = Object.prototype.hasOwnProperty;

var myGlobal = require('jsdoc/util/global');

var jasmineAll = require('./lib/jasmine');
var jasmine = jasmineAll.jasmine;

var jasmineNode = ( require('./reporter') )(jasmine);

var reporter = null;
jasmine.initialize = function(done, verbose) {
    var jasmineEnv = jasmine.getEnv();

    if (reporter !== null) {
        // If we've run before, we need to reset the runner
        jasmineEnv.currentRunner_ = new jasmine.Runner(jasmineEnv);
        // And clear the reporter
        jasmineEnv.reporter.subReporters_.splice(jasmineEnv.reporter.subReporters_.indexOf(reporter));
    }

    var reporterOpts = {
        print: util.print,
        color: env.opts.nocolor === true ? false : true,
        onComplete: done
    };

    reporter = env.opts.verbose ? new jasmineNode.TerminalVerboseReporter(reporterOpts) :
        new jasmineNode.TerminalReporter(reporterOpts);
    jasmineEnv.addReporter(reporter);

    // updateInterval is set to 0 because there were not-fully-understood
    // issues with asynchronous behavior in jasmine otherwise.
    jasmineEnv.updateInterval = 0;

    return jasmineEnv;
};

/**
 * Execute the specs in the specified folder. Helpers in each folder will be
 * added to the environment.  Helpers in parent directories will be available to child
 * directories.
 * @param {string} folder The folder in which the specs are to be found.
 * @param {function?} done Callback function to execute when finished.
 * @param {object} opts Options for executing the specs.
 * @param {boolean} opts.verbose Whether or not to output verbose results.
 * @param {RegExp} opts.matcher A regular expression to filter specs by. Only matching specs run.
 */
jasmine.executeSpecsInFolder = function(folder, done, opts) {
    var fileMatcher = opts.matcher || new RegExp(".(js)$", "i"),
        specs = require('./spec-collection'),
        jasmineEnv = jasmine.initialize(done, opts.verbose);

    // Load the specs
    specs.load(folder, fileMatcher, true);

    var specsList = specs.getSpecs();
    var filename;

    // Add the specs to the context
    for (var i = 0, len = specsList.length; i < len; ++i) {
        filename = specsList[i];
        require(filename.path().replace(/\\/g, '/').
            replace(new RegExp('^' + env.dirname + '/test'), './').
            replace(/\.\w+$/, ''));
    }

    // Run Jasmine
    jasmineEnv.execute();
};

function now() {
    return new Date().getTime();
}

jasmine.asyncSpecWait = function() {
    var wait = this.asyncSpecWait;
    wait.start = now();
    wait.done = false;
    (function innerWait() {
        waits(10);
        runs(function() {
            if (wait.start + wait.timeout < now()) {
                expect('timeout waiting for spec').toBeNull();
            } else if (wait.done) {
                wait.done = false;
            } else {
                innerWait();
            }
        });
    })();
};
jasmine.asyncSpecWait.timeout = 4 * 1000;
jasmine.asyncSpecDone = function() {
    jasmine.asyncSpecWait.done = true;
};

jasmine.getDocSetFromFile = function(filename, parser) {
    var sourceCode = fs.readFileSync( path.join(env.dirname, filename), 'utf8' );
    var runtime = require('jsdoc/util/runtime');
    // TODO: change to runtime-appropriate parser (and/or get a config setting?)
    var testParser = parser || require('jsdoc/src/parser').createParser('esprima');
    //var testParser = parser || require('jsdoc/src/parser').createParser('rhino');
    var indexAll = require('jsdoc/borrow').indexAll;
    var doclets;

    require('jsdoc/src/handlers').attachTo(testParser);

    doclets = testParser.parse('javascript:' + sourceCode);
    indexAll(doclets);

    require('jsdoc/augment').addInherited(doclets);

    // test assume borrows have not yet been resolved
    // require('jsdoc/borrow').resolveBorrows(doclets);

    return {
        doclets: doclets,
        getByLongname: function(longname) {
            return doclets.filter(function(doclet) {
                return (doclet.longname || doclet.name) === longname;
            });
        }
    };
};

// set up jasmine's global functions
Object.keys(jasmine).forEach(function(key) {
    exports[key] = myGlobal[key] = jasmine[key];
});
myGlobal.jasmine = jasmine;
require('./async-callback');
['spyOn', 'it', 'xit', 'expect', 'runs', 'waitsFor', 'beforeEach', 'afterEach', 'describe',
    'xdescribe'].forEach(function(item) {
    myGlobal[item] = jasmineAll[item];
});
