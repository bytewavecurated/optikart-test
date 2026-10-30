module.exports = function override(config, env) {
  // Suppress all deprecation warnings
  config.ignoreWarnings = [
    {
      message: /onAfterSetupMiddleware/i,
    },
    {
      message: /onBeforeSetupMiddleware/i,
    },
    {
      message: /DEP0060/i,
    },
    {
      message: /setupMiddleagers/i,
    },
    /deprecation/i,
    /deprecated/i,
  ];

  return config;
};
