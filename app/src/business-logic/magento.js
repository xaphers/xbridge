const FileSystem = require("fs");
const axios = require("axios");
const MagentoApi = require("./magento-api");
const MagentoAccess = require("../data-access/magento-access");

class App {
    constructor() {}

    ValidateToken(token) {
        const TOKEN = Buffer.from(token.split(" ")[1], "base64").toString("ascii");
        try {
            if (
                TOKEN ===
                process.env.AUTH0_CLIENT_ID +
                    "&" +
                    process.env.AUTH0_CLIENT_SECRET
            ) {
                return true;
            }
        } catch (err) {
            throw err;
        }
    }

    ValidateCredentials(credentials) {
        try {
            if (
                credentials.username ==
                    appconfig.shopsukiAdminCredentials.username &&
                credentials.password ==
                    appconfig.shopsukiAdminCredentials.password
            ) {
                return true;
            }
        } catch (err) {
            throw err;
        }
    }

    async GetAvailableSlots(deliverydate) {
        const magentoAccess = new MagentoAccess();
        let response;

        try {
            await magentoAccess
                .GetAvailableSlots(deliverydate)
                .then((result) => {
                    response = {
                        available_slots: 120 - +result.reserved_slots,
                    };
                })
                .catch((err) => {
                    throw err;
                });
        } catch (err) {
            throw err;
        }

        return response;
    }

    async GetOrders(params) {
        const magentoAccess = new MagentoAccess();

        let response;

        try {
            if (params.orderHeadId) {
                await magentoAccess
                    .GetOrders(params.orderHeadId)
                    .then((result) => {
                        response = result;
                        if (result.length > 0) {
                            console.log(response);
                        }
                    })
                    .catch((err) => {
                        throw err;
                    });
            }
        } catch (err) {
            throw err;
        }

        return response;
    }

    async AmendOrder(order_items) {
        const magentoAccess = new MagentoAccess();
        let response = [];
        let status = [];

        try {
            for (const order_item of order_items) {
                await magentoAccess
                    .GetItem(order_item.PRODUCT_ORIN)
                    .then(async (item) => {
                        order_item.ITEM = item[0];

                        if (order_item.IS_FULFILLED === "FULFILLED") {
                            if (order_item.IS_ADDED) {
                                await magentoAccess
                                    .AddOrderItem(order_item)
                                    .then((result) => {
                                        status.push([
                                            order_item.ORDER_BODY_ID,
                                            result,
                                        ]);
                                        if (result.affectedRows == 1) {
                                            response.push({
                                                ROW_ID: order_item.ROW_ID,
                                                ORDER_BODY_ID: result.insertId,
                                            });
                                        }
                                    })
                                    .catch((err) => {
                                        throw err;
                                    });
                            } else {
                                await magentoAccess
                                    .UpdateOrderItem(order_item)
                                    .then((result) => {
                                        status.push([
                                            order_item.ORDER_BODY_ID,
                                            result,
                                        ]);
                                        if (result) {
                                            console.log(result);
                                        }
                                        // response = result
                                    })
                                    .catch((err) => {
                                        throw err;
                                    });
                            }
                        } else {
                            await magentoAccess
                                .CancelOrderItem(order_item)
                                .then((result) => {
                                    status.push([
                                        order_item.ORDER_BODY_ID,
                                        result,
                                    ]);
                                    if (result) {
                                        console.log(result);
                                    }
                                    // response = result
                                })
                                .catch((err) => {
                                    throw err;
                                });
                        }
                    })
                    .catch((err) => {
                        throw err;
                    });
            }

            await magentoAccess
                .GetOrderTotal(order_items[0].ORDER_HEAD_ID)
                .then(async (orderTotal) => {
                    await magentoAccess
                        .UpdateOrder(
                            order_items[0].ORDER_HEAD_ID,
                            orderTotal[0].grand_total,
                            orderTotal[0].subtotal
                        )
                        .catch((err) => {
                            throw err;
                        });
                })
                .catch((err) => {
                    throw err;
                });
        } catch (err) {
            throw err;
        }
        console.log(status);
        return response;
    }

    async SendMessage(params) {
        const magentoAccess = new MagentoAccess();

        try {
            setTimeout(() => {
                magentoAccess
                    .GetOrderInfo(params.ORDER_ID)
                    .then(async (order) => {
                        console.log(order);
                        if (order.length > 0) {
                            await axios({
                                method: "post",
                                baseURL: "http://192.168.32.178",
                                url: "/SMSWorx/api/smsworx/send_message",
                                proxy: false,
                                data: {
                                    GUID: params.GUID,
                                    Message: `Good Day Ka-Suki ${order[0].firstname}! \n\nYour current order #${order[0].increment_id} is now being processed. \nThank you. \n\n-Shopsuki`,
                                    PhoneNo: [`${order[0].telephone}`],
                                    Username: "SHOPSUKI_ADMIN",
                                },
                            })
                                .then(function (response) {
                                    console.log(response);
                                })
                                .catch(function (error) {
                                    console.log(error);
                                });
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            }, 30000);
        } catch (err) {
            throw err;
        }
    }
}

module.exports = App;
