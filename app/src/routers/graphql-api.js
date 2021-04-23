const Router = require("express").Router();
const Magento = require("../business-logic/magento");

Router.get("/", (req, res) => {
    res.locals.title = "Welcome to NodeJS Server";
    res.locals.desc = "By using this app, you should know how to use it.";
    res.render("index");
    res.end();
});

Router.post("/shopsuki/api/booking/getavailableslots", async (req, res) => {
    const magento = new Magento();

    try {
        if (req.body.delivery_date) {
            await magento
                .GetAvailableSlots(req.body.delivery_date)
                .then((result) => {
                    res.send(result);
                })
                .catch((err) => {
                    throw err;
                });
        } else {
            throw "Invalid parameter/s.";
        }
    } catch (err) {
        res.locals.error = err;
        res.status(err.status || 500);
        res.render("error");
    } finally {
        res.end();
    }
});

module.exports = Router;
