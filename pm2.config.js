module.exports = {
    apps: [
      {
        name: 'venice.ai',
        script: 'index.js',
        watch: true,
        env: {
          NODE_ENV: 'development',
        },
        env_production: {
          NODE_ENV: 'production',
        },
      },
    ],
  };
  