#!/usr/bin/env node

//Modules
const Express = require("express");
const CreateError = require("http-errors");
const Path = require("path");
const AppRouter = require("./app/src/routers/app-router");
const Cors = require("cors");
const Passport = require("passport");

// Express
const Server = Express();

// View engine setup
Server.set("views", Path.join(__dirname, "/app/src/views"));
Server.set("styles", Path.join(__dirname, "/app/src/styles"));
Server.set("view engine", "pug");

// Routers
Server.use(
    Cors({
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

Server.use(Express.json()); // for parsing application/json
Server.use(Express.urlencoded({ extended: true }));

//Routers
Server.use(AppRouter);

// Catch 404 and forward to error handler
Server.use(function (req, res, next) {
    next(CreateError(404));
});

// Error handlers
Server.use(function (err, req, res, next) {
    res.locals.error = err;
    res.status(err.status || 500);
    res.render("error");
});

// Start Server
const port = process.env.port || 8000;
Server.listen(port);
console.log(`Server started on: ${port}`);
