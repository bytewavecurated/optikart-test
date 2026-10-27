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
      message: /setupMiddlewares/i,
    },
    /deprecation/i,
    /deprecated/i,
  ];

  // Add devServer configuration to use setupMiddlewares instead of deprecated options
  if (env === 'development') {
    config.devServer = {
      ...config.devServer,
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined.');
        }

        // Apply any custom middleware here if needed
        return middlewares;
      },
    };
  }

  return config;
};
