module.exports = {
  apps : [{
    name: 'SpotcareAPI',
    script: 'app.js',

    // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
    args: 'one two',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    time:true,
    env_kiosk: {
      NODE_ENV: 'kioskprod'
    },
    env_dev: {
      NODE_ENV: 'devbackend'
    },
    env_staging: {
      NODE_ENV: 'staging'
    },
    env_production: {
      NODE_ENV: 'prod'
    }
  },
  {
    name: 'Batch',
    script: 'batch.js',

    // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
    args: 'one two',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    time:true,
    env_kiosk: {
      NODE_ENV: 'kioskprod'
    },
    env_dev: {
      NODE_ENV: 'devbackend'
    },
    env_staging: {
      NODE_ENV: 'staging'
    },
    env_production: {
      NODE_ENV: 'prod'
    }
  }
  ],

  deploy : {
    production : {
      user : 'node',
      host : '212.83.163.1',
      ref  : 'origin/master',
      repo : 'git@github.com:repo.git',
      path : '/var/www/production',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
