import api from "@/lib/axios";
import { apiErrorMessage } from "@/lib/apiError";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// Loads Razorpay's checkout script once, and waits for it. Opening checkout before it has loaded
// would fail, because window.Razorpay would not exist yet.
const loadCheckoutScript = (): Promise<void> => {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT;
      document.body.appendChild(script);
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Could not load the payment window. Please check your connection and try again.")),
      { once: true },
    );
  });
};

export type CheckoutResult = "PAID" | "DISMISSED";

type Prefill = { name?: string | null; email?: string | null; contact?: string | null };

/**
 * Opens Razorpay for an order and waits until the buyer is done with it. Works for a new order and
 * for paying again later, because the backend reuses the order's Razorpay order until it is paid.
 *
 * Resolves PAID once the backend has confirmed the payment, or DISMISSED if the buyer closed the
 * window without paying. Throws with a message to show if the payment could not start, or if it
 * went through but could not be confirmed (for example because the order was cancelled meanwhile).
 */
export const payForOrder = async (orderId: string, description: string, prefill: Prefill): Promise<CheckoutResult> => {
  await loadCheckoutScript();
  const { data } = await api.post(`/payments/order/${orderId}/initiate`);
  const { providerOrderId, amount, currency } = data.data;

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount,
      currency,
      name: "CropLine",
      description,
      order_id: providerOrderId,
      handler: async (response) => {
        try {
          await api.post(`/payments/order/${orderId}/verify`, {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve("PAID");
        } catch (err) {
          reject(
            new Error(
              apiErrorMessage(err, "Payment was successful but verification failed. Please check your orders or contact support."),
            ),
          );
        }
      },
      modal: { ondismiss: () => resolve("DISMISSED") },
      prefill,
      theme: { color: "#1B5E20" },
    });
    checkout.open();
  });
};
