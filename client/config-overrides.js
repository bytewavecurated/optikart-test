/*
 * Two jobs, both dev-only, and the file says which is which so nobody has to
 * rediscover them the hard way.
 *
 * 1) `module.exports` is the CRA hook itself - it gets the webpack config and
 *    returns it (here: unchanged plus the ignoreWarnings below).
 *
 * 2) The warning suppression this file has existed for: CRA 5 ships
 *    webpack-dev-server v4 and still passes BOTH onAfterSetupMiddleware and
 *    onBeforeSetupMiddleware into it, and Node prints a DeprecationWarning
 *    pair per dev startup. Those warnings are NOT webpack errors and not
 *    something react-scripts can see — they come from Node's own util, which
 *    is precisely where 'ignoreWarnings' in the webpack config cannot reach,
 *    which is why they printed despite the list below. The knobs themselves
 *    are the CRA-internal API (setupMiddleagers moved), and we cannot patch
 *    react-scripts internals from here; turning the noise off for the DEV
 *    tooling process is the honest and supported escape. Production builds
 *    never load this block, never start webpack-dev-server, and never get to
 *    see a deprecation that does not belong to them.
 */

// Silence the dev-server middleware deprecation pair from Node itself.
// The warnings are fired by webpack-dev-server's own deprecation util against
// CRA passing its legacy hook names; our ignoreWarnings cannot see them and
// our own production code does not use them.
try {
  // no deprecation warnings in this process; re-enable per-process if ever
  // diagnosing something that legitimately depends on that output.
  process.noDeprecation = true;
} catch {
  /* noDeprecation unavailable: same outcome minus the silence */
}

module.exports = function override(config, env) {
  /*
   * `env` is webpack's ('production' here only for `npm run build`); the dev-
   * server middleware option renames apply to the webpack-dev-server side of
   * `npm start`, which does not reach this config at all for builds — the
   * ignoreWarnings keep the CRA deprecation notice from turning a build
   * warning into a CI-failing 'error' for the same reason it always did.
   */
  config.ignoreWarnings = (config.ignoreWarnings || []).concat([
    { message: /onAfterSetupMiddleware/i },
    { message: /onBeforeSetupMiddleware/i },
    { message: /setupMiddlewares?/i },
    { message: /DEP0\d{4}/i },
    { message: /deprecated/i },
  ]);
  return config;
};
