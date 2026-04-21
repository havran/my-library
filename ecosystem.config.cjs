module.exports = {
  apps: [
    {
      name: "my-library",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "server/index.ts",
      cwd: "/home/havran/my-library",
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      max_memory_restart: "512M",
      kill_timeout: 5000,
      out_file: "/home/havran/.local/share/my-library/logs/server-out.log",
      error_file: "/home/havran/.local/share/my-library/logs/server-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
