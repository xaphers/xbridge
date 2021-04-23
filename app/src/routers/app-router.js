const Router = require("express").Router();
const Magento = require("../business-logic/magento");

Router.get("/xbridge", (req, res) => {
    res.locals.title = "Shopsuki xBridge";
    res.locals.desc = "By using this app, you should know how to use it.";
    res.render("index");
    res.end();
});

Router.post("/xbridge/api/booking/getavailableslots", async (req, res) => {
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

Router.get("/xbridge/api/orders/getorders", async (req, res) => {
    const magento = new Magento();
    try {
        // if(magento.ValidateToken(Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString('ascii'))){
            await magento
            .GetOrders(req.query)
            .then((result) => {
                res.send(result);
            })
            .catch((err) => {
                throw err;
            });
        // }
    } catch (err) {
        res.locals.error = err;
        res.status(err.status || 500);
        res.render("error");
    } finally {
        res.end();
    }
});

Router.post("/xbridge/api/orders/amendorder", async (req, res) => {
    const magento = new Magento();

    try {
        if (req.body) {
            await magento
                .AmendOrder(req.body)
                .then((result) => {
                    res.send(result);
                })
                .catch((err) => {
                    throw err;
                });
        } else {
            throw "Invalid input parameters.";
        }
    } catch (err) {
        res.locals.error = err;
        res.status(err.status || 500);
        res.render("error");
    } finally {
        res.end();
    }
});

Router.post("/xbridge/api/sms/send", async (req, res) => {
    const magento = new Magento();
    try {
        if (req.body.GUID && req.body.ORDER_ID) {
            magento.SendMessage(req.body);
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
