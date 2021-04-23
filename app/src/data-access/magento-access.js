const mariadb = require("mariadb");

class MagentoAccess {
    constructor() {
        this.pool = mariadb.createPool({
            host: process.env.MARIADB_HOST,
            user: process.env.MARIADB_USER,
            password: process.env.MARIADB_PASSWORD,
            database: process.env.MARIADB_DBNAME,
            connectionLimit: process.env.MARIADB_CONNLIMIT,
        });
    }

    GetAvailableSlots(deliverydate) {
        return new Promise(async (resolve, reject) => {
            let conn;
            let result;

            try {
                conn = await this.pool.getConnection();
                result = await conn.query(
                    {
                        namedPlaceholders: true,
                        sql: `
                        SELECT 
                            COUNT(entity_id) reserved_slots
                        FROM 
                            sales_order
                        WHERE
                            status = 'pending'
                        AND
                            JSON_EXTRACT(JSON_EXTRACT(ecomteck_order_custom_attributes,'$.other_information'),'$.delivery_date') = :delivery_date
                        ;`,
                    },
                    {
                        delivery_date: deliverydate,
                        // timeslot: params.timeslot
                    }
                );

                resolve(result[0]);
            } catch (err) {
                console.error(err);
                reject(err);
            } finally {
                if (conn) conn.end();
            }
        });
    }

    GetOrders(orderHeadId) {
        return new Promise(async (resolve, reject) => {
            let conn;
            let orders = [];

            try {
                conn = await this.pool.getConnection();
                const orderHead = await conn.query(
                    {
                        namedPlaceholders: true,
                        sql: `
                        SELECT 
                            so.entity_id,
                            so.increment_id,
                            so.store_name,
                            so.state,
                            so.status,
                            so.shipping_description,
                            JSON_UNQUOTE(JSON_EXTRACT( sop.additional_information, '$.method_title')) payment_method,
                            so.base_discount_amount,
                            so.base_shipping_amount,
                            so.base_subtotal,
                            so.base_grand_total,
                            so.total_qty_ordered,
                            so.customer_is_guest,
                            so.customer_email,
                            so.customer_firstname,
                            so.customer_middlename,
                            so.customer_lastname,
                            so.created_at,
                            so.ecomteck_order_custom_attributes order_attributes
                        FROM 
                            sales_order so,
                            sales_order_payment sop
                        WHERE
                            so.entity_id = sop.parent_id
                        AND
                            so.status = 'pending'
                        AND
                            so.entity_id > :order_id
                        ;`,
                    },
                    {
                        order_id: orderHeadId,
                    }
                );

                for (const ordHd of orderHead) {
                    ordHd.customer_address = await conn.query(
                        {
                            namedPlaceholders: true,
                            sql: `
                            SELECT
                                entity_id,
                                address_type,
                                email,
                                firstname,
                                middlename,
                                lastname,
                                telephone,
                                country_id,
                                region,
                                postcode,
                                city,
                                street
                            FROM 
                                sales_order_address
                            WHERE
                                parent_id = :order_id
                            ;`,
                        },
                        {
                            order_id: ordHd.entity_id,
                        }
                    );

                    ordHd.items = await conn.query(
                        {
                            namedPlaceholders: true,
                            sql: `
                            SELECT
                                item_id,
                                product_id,
                                product_type,
                                sku,
                                (SELECT cpev.value FROM catalog_product_entity_varchar cpev, eav_attribute ea WHERE cpev.attribute_id = ea.attribute_id AND cpev.entity_id = soi.product_id AND ea.attribute_code = 'barcode') barcode,
                                name,
                                qty_ordered,
                                base_price,
                                base_row_total
                            FROM 
                                sales_order_item soi
                            WHERE
                                order_id = :order_id
                            ;`,
                        },
                        {
                            order_id: ordHd.entity_id,
                        }
                    );

                    orders.push(ordHd);
                }

                resolve(orders);
            } catch (err) {
                reject(err);
            } finally {
                if (conn) conn.end();
            }
        });
    }

    async GetOrderInfo(orderId) {
        let conn;

        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    SELECT
                        so.entity_id,
                        so.increment_id,
                        so.state,
                        so.status,
                        so.base_subtotal,
                        so.base_grand_total,
                        so.customer_is_guest,
                        so.customer_email,
                        so.customer_firstname,
                        so.customer_middlename,
                        so.customer_lastname,
                        so.ecomteck_order_custom_attributes order_attributes,
                        soa.address_type,
                        soa.email,
                        soa.firstname,
                        soa.middlename,
                        soa.lastname,
                        soa.telephone
                    FROM 
                        sales_order so,
                        sales_order_address soa
                    WHERE
                        so.entity_id = soa.parent_id
                    AND
                        so.entity_id = :order_id
                    ;`,
                },
                {
                    order_id: orderId,
                }
            );
        } catch (err) {
            console.error(err);
        } finally {
            if (conn) conn.end();
        }
    }

    async GetItem(sku) {
        let conn;

        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    SELECT 
                        cpe.entity_id,
                        cpe.attribute_set_id,
                        cpe.type_id,
                        cpe.sku,
                        cpe.has_options,
                        cpe.required_options,
                        MAX( if( cpev.attribute_id = 73, cpev.value, 0 ) ) AS name,
                        MAX( if( cped.attribute_id = 77, cped.value, 0 ) ) AS price,
                        MAX( if( cped.attribute_id = 82, cped.value, 0 ) ) AS weight
                    FROM 
                        catalog_product_entity cpe,
                        catalog_product_entity_varchar cpev,
                        catalog_product_entity_decimal cped
                    WHERE	
                        cpev.entity_id = cpe.entity_id
                    AND
                        cped.entity_id = cpe.entity_id
                    AND
                        sku = :sku
                    GROUP BY
                        cpe.sku
                ;`,
                },
                {
                    sku: sku,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }

    async AddOrderItem(order_item) {
        let conn;

        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    INSERT INTO
                        sales_order_item
                    (
                        order_id,
                        parent_item_id,
                        quote_item_id,
                        store_id,
                        product_id,
                        product_type,
                        product_options,
                        weight,
                        is_virtual,
                        sku,
                        name,
                        is_qty_decimal,
                        qty_ordered,
                        price,
                        base_price,
                        original_price,
                        base_original_price,
                        row_total,
                        row_weight,
                        price_incl_tax,
                        base_price_incl_tax,
                        row_total_incl_tax,
                        base_row_total_incl_tax
                    )  
                    VALUES
                    (
                        :order_id,
                        :parent_item_id,
                        :quote_item_id,
                        :store_id,
                        :product_id,
                        :product_type,
                        :product_options,
                        :weight,
                        :is_virtual,
                        :sku,
                        :name,
                        :is_qty_decimal,
                        :qty_ordered,
                        :price,
                        :base_price,
                        :original_price,
                        :base_original_price,
                        :row_total,
                        :row_weight,
                        :price_incl_tax,
                        :base_price_incl_tax,
                        :row_total_incl_tax,
                        :base_row_total_incl_tax
                    )
                    ;`,
                },
                {
                    order_id: order_item.ORDER_HEAD_ID,
                    parent_item_id: "",
                    quote_item_id: "",
                    store_id: 1,
                    product_id: order_item.ITEM.entity_id,
                    product_type: order_item.ITEM.type_id,
                    product_options: "",
                    weight: order_item.ITEM.weight,
                    is_virtual: 0,
                    sku: order_item.ITEM.sku,
                    name: order_item.ITEM.name,
                    is_qty_decimal: 0,
                    qty_ordered: order_item.VERIFIED_QTY,
                    price: order_item.ITEM.price,
                    base_price: order_item.ITEM.price,
                    original_price: order_item.ITEM.price,
                    base_original_price: order_item.ITEM.price,
                    row_total: order_item.VERIFIED_QTY * order_item.ITEM.price,
                    row_weight: order_item.ITEM.weight * order_item.VERIFIED_QTY,
                    price_incl_tax: order_item.ITEM.price,
                    base_price_incl_tax: order_item.ITEM.price,
                    row_total_incl_tax:  order_item.ITEM.price * order_item.VERIFIED_QTY,
                    base_row_total_incl_tax: order_item.ITEM.price * order_item.VERIFIED_QTY,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }

    async UpdateOrderItem(orderItem) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    UPDATE
                        sales_order_item
                    SET
                        qty_ordered = :qty_ordered,
                        price = :price,
                        base_price = :base_price,
                        original_price = :original_price,
                        row_total = :row_total,
                        row_weight = :row_weight,
                        price_incl_tax = :price_incl_tax,
                        base_price_incl_tax = :base_price_incl_tax,
                        row_total_incl_tax = :row_total_incl_tax,
                        base_row_total_incl_tax = :base_row_total_incl_tax
                    WHERE
                        item_id = :item_id
                    ;`,
                },
                {
                    item_id: orderItem.ORDER_BODY_ID,
                    qty_ordered: orderItem.VERIFIED_QTY,
                    price: orderItem.ITEM.price,
                    base_price: orderItem.ITEM.price,
                    original_price: orderItem.ITEM.price,
                    row_total: orderItem.VERIFIED_QTY * orderItem.ITEM.price,
                    row_weight: orderItem.ITEM.weight * orderItem.VERIFIED_QTY,
                    price_incl_tax: orderItem.ITEM.price,
                    base_price_incl_tax: orderItem.ITEM.price,
                    row_total_incl_tax: orderItem.ITEM.price * orderItem.VERIFIED_QTY,
                    base_row_total_incl_tax: orderItem.ITEM.price * orderItem.VERIFIED_QTY,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }

    async CancelOrderItem(orderItem) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    UPDATE
                        sales_order_item
                    SET
                        qty_canceled = :qty_canceled,
                        qty_ordered = :qty_ordered,
                        price = 0,
                        base_price = 0,
                        original_price = 0,
                        row_total = 0,
                        row_weight = 0,
                        price_incl_tax = 0,
                        base_price_incl_tax = 0,
                        row_total_incl_tax = 0,
                        base_row_total_incl_tax = 0
                    WHERE
                        item_id = :item_id
                    ;`,
                },
                {
                    item_id: orderItem.ORDER_BODY_ID,
                    qty_canceled: orderItem.QTY,
                    qty_ordered: orderItem.QTY,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }

    async RemoveOrderItem(itemId) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    DELETE
                        sales_order_item
                    WHERE
                        item_id = :item_id
                    ;`,
                },
                {
                    item_id: itemId,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }

    UpdateOrder(orderId, grandTotal, subtotal) {
        return new Promise(async (resolve, reject) => {
            let conn;

            try {
                conn = await this.pool.getConnection();

                let update_so = await conn.query(
                    {
                        namedPlaceholders: true,
                        sql: `
                        UPDATE
                            sales_order
                        SET
                            subtotal = :subtotal,
                            base_subtotal = :base_subtotal,
                            base_grand_total = :base_grand_total,
                            grand_total = :grand_total,
                            base_total_due = :base_total_due,
                            total_due = :total_due,
                            base_subtotal_incl_tax = :base_subtotal_incl_tax,
                            subtotal_incl_tax = :subtotal_incl_tax
                        WHERE
                            entity_id = :order_id
                        ;`,
                    },
                    {
                        order_id: orderId,
                        subtotal: subtotal,
                        base_subtotal: subtotal,
                        base_grand_total: grandTotal,
                        grand_total: grandTotal,
                        base_total_due: grandTotal,
                        total_due: grandTotal,
                        base_subtotal_incl_tax: subtotal,
                        subtotal_incl_tax: subtotal,
                    }
                );

                let update_sog = await conn.query(
                    {
                        namedPlaceholders: true,
                        sql: `
                        UPDATE
                            sales_order_grid
                        SET
                            base_grand_total = :base_grand_total,
                            grand_total = :grand_total
                        WHERE
                            entity_id = :order_id
                        ;`,
                    },
                    {
                        order_id: orderId,
                        base_grand_total: grandTotal,
                        grand_total: grandTotal,
                    }
                );

                let update_sop = await conn.query(
                    {
                        namedPlaceholders: true,
                        sql: `
                        UPDATE
                            sales_order_payment
                        SET
                            base_amount_ordered = :base_amount_ordered,
                            amount_ordered = :amount_ordered
                        WHERE
                            parent_id = :order_id
                        ;`,
                    },
                    {
                        order_id: orderId,
                        base_amount_ordered: grandTotal,
                        amount_ordered: grandTotal,
                    }
                );

                resolve([update_so, update_sog, update_sop]);
            } catch (err) {
                console.error(err);
                reject(err);
            } finally {
                if (conn) conn.end();
            }
        });
    }

    async GetOrderTotal(orderId) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                        SELECT
                            (
                                SUM(soi.row_total) + so.base_shipping_amount
                            ) grand_total,
                            SUM(soi.row_total) subtotal
                        FROM
                            sales_order so,
                            sales_order_item soi
                        WHERE
                            so.entity_id = soi.order_id
                        AND
                            order_id = :order_id
                    ;`,
                },
                {
                    order_id: orderId,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }

    async CheckOrderItemExists(orderBodyId) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            return await conn.query(
                {
                    namedPlaceholders: true,
                    sql: `
                    SELECT
                        SUM(row_total) order_total
                    FROM
                        sales_order_item
                    WHERE
                        order_id = :order_id
                    ;`,
                },
                {
                    order_id: orderId,
                }
            );
        } catch (err) {
            throw err;
        } finally {
            if (conn) conn.end();
        }
    }
}

module.exports = MagentoAccess;
