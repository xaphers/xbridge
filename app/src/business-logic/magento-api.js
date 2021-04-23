const axios = require("axios");

class MagentoApi {
    constructor() {
        if (process.env.APP_ENV === "production") {
            this.shopsukiDomain = process.env.SHOPSUKI_PROD_DOMAIN;
        } else {
            this.shopsukiDomain = process.env.SHOPSUKI_DEV_DOMAIN;
        }
    }

    async GenerateToken(credentials) {
        let token;

        await axios({
            method: "post",
            baseURL: this.shopsukiDomain,
            url: "/rest/default/V1/integration/admin/token",
            proxy: false,
            data: credentials,
        })
            .then(function (response) {
                token = response.data;
            })
            .catch(function (error) {
                console.log(error);
            });

        return token;
    }

    async GetOrders() {
        let token;
        let orders;

        await this.GenerateToken().then((response) => {
            token = response;
        });

        await axios({
            method: "get",
            baseURL: this.shopsukiDomain,
            url: "/rest/default/V1/orders?searchCriteria",
            proxy: false,
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(function (response) {
                console.log(response);
                // orders = response.data
            })
            .catch(function (error) {
                console.log(error);
            });
    }
}

module.exports = MagentoApi;
