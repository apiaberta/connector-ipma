module.exports = {
  apps: [
    {
      name: 'apiaberta-ipma',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        MONGO_URI: 'mongodb://localhost:27017/apiaberta-ipma'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
}
