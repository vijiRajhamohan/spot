const express = require('express');
  app = express();
const path = require('path');
if (!process.env.NODE_ENV)
    process.env.NODE_ENV = "dev";
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, `config/env/${process.env.NODE_ENV}.env`) });

const cron = require("node-cron");
const batchConfig = require("./config/batchConfig")

// schedule tasks to be run on the server   
Object.keys(batchConfig).forEach(function (cronKey) {
    cron.schedule(cronKey, function () {
        let tasks = batchConfig[cronKey];
        tasks.forEach(task => {
            try {
                task.execute();
            } catch (e) {
                console.log("Error in ", cronKey, task, e);
            }
        });
    });
})


app.listen(3128);