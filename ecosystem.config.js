module.exports = {
  apps: [
    {
      name: 'quiz-challenge',
      script: './src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
    },
  ],
};
