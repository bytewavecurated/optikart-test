module.exports = function override(config, env) {
  // Suppress deprecation warnings
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
  ];

  return config;
};
