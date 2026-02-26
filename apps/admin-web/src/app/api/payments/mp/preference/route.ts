import { NextResponse } from "next/server";
import MercadoPagoConfig, { Preference } from "mercadopago";

export async function POST(req: Request) {
    try {
        const { items, payer_email, user_id, principal_id, additional_ids } = await req.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No items provided" }, { status: 400 });
        }

        if (!user_id) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            console.error("MP_ACCESS_TOKEN is missing");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        const client = new MercadoPagoConfig({ accessToken });
        const preference = new Preference(client);

        const url = new URL(req.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        const result = await preference.create({
            body: {
                items: items.map((item: any) => ({
                    id: String(item.id),
                    title: String(item.title),
                    unit_price: Number(item.price),
                    quantity: 1,
                    currency_id: "ARS",
                })),

                // Opcional: podés mandarlo, pero no es obligatorio
                payer: payer_email ? { email: payer_email } : undefined,

                payment_methods: {
                    excluded_payment_methods: [],
                    excluded_payment_types: [],
                    installments: 12,
                },

                back_urls: {
                    success: `${baseUrl}/profile?payment_status=success`,
                    failure: `${baseUrl}/profile?payment_status=failure`,
                    pending: `${baseUrl}/profile?payment_status=pending`,
                },
                auto_return: "approved",

                // Guardamos metadata para el webhook
                external_reference: JSON.stringify({
                    user_id,
                    principal_id,
                    additional_ids
                }),
            },
        });

        // Normalizar respuesta según versión del SDK
        const created = (result as any)?.response ?? result;

        console.log("Preference created:", created.id);
        console.log("Init Point:", created.init_point);
        console.log("Sandbox Init Point:", created.sandbox_init_point);

        if (!created?.init_point && !created?.sandbox_init_point) {
            console.error("MP response unexpected:", JSON.stringify(result, null, 2));
            return NextResponse.json(
                { error: "MP response missing init_point", details: result },
                { status: 502 }
            );
        }

        return NextResponse.json({
            id: created.id,
            init_point: created.init_point,
            sandbox_init_point: created.sandbox_init_point,
        });
    } catch (error: any) {
        // Si el SDK trae info extra, mostrala
        console.error("Error creating MP preference:", error);
        return NextResponse.json(
            { error: error?.message || "Error creating preference", details: error },
            { status: 500 }
        );
    }
}